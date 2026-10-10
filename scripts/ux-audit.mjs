import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const dir='audit-artifacts';
fs.mkdirSync(dir,{recursive:true});
const base='http://127.0.0.1:4173';
const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'ignore'});
let browser;
const findings=[];
function record(view,viewport,more){findings.push({viewport,view,...more});}
async function ready(){
  for(let i=0;i<100;i++){
    try{ const r=await fetch(base); if(r.ok)return; }catch{}
    await sleep(350);
  }
  throw new Error('Vite did not start');
}
async function scan(page,view,viewport){
  await page.waitForTimeout(230);
  const metrics=await page.evaluate(()=>{
    const vw=document.documentElement.clientWidth;
    const wide=Math.max(document.body.scrollWidth,document.documentElement.scrollWidth);
    const visibles=Array.from(document.querySelectorAll('button,[role="button"]'))
      .filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;})
      .map(e=>{const r=e.getBoundingClientRect();return {label:(e.getAttribute('aria-label')||e.textContent||e.getAttribute('title')||'').trim().replace(/\s+/g,' ').slice(0,55),width:Math.round(r.width),height:Math.round(r.height),size:parseFloat(getComputedStyle(e).fontSize)}});
    const textSizes=Array.from(document.querySelectorAll('p,span,label,small,dt,dd,strong'))
      .filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'})
      .map(e=>parseFloat(getComputedStyle(e).fontSize)).filter(n=>n>0);
    return {vw,scrollWidth:wide,overflowPx:Math.max(0,wide-vw),smallTouchTargets:visibles.filter(x=>x.width<44||x.height<44).slice(0,18),touchTargetCount:visibles.length,smallTouchTargetCount:visibles.filter(x=>x.width<44||x.height<44).length,smallTextCount:textSizes.filter(x=>x<12).length,textCount:textSizes.length,bodyFontPx:parseFloat(getComputedStyle(document.body).fontSize)};
  });
  let axe={violations:[]};
  try{
    const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    axe={violations:a.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodeCount:v.nodes.length,examples:v.nodes.slice(0,2).map(x=>x.target.join(' '))}))};
  }catch(e){axe={error:String(e)};}
  await page.screenshot({path:dir+'/'+viewport+'-'+view+'.png',fullPage:true});
  record(view,viewport,{...metrics,axe});
}
try {
  await ready();
  try{browser=await chromium.launch({headless:true,channel:'chrome',args:['--no-sandbox']});}
  catch{browser=await chromium.launch({headless:true,args:['--no-sandbox']});}
  for(const [name,width,height] of [['mobile320',320,700],['mobile375',375,812],['iphone390',390,844],['mobile430',430,932],['tablet768',768,1024],['desktop1280',1280,800]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<700,hasTouch:width<700});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'networkidle'});
    await scan(page,'home',name);
    if(width<=660){
      const mobileHome=await page.evaluate(()=>{
        const el=name=>document.querySelector(name)?.getBoundingClientRect();
        const hero=el('.hero-card'),quick=el('.mobile-quick-actions'),recent=el('.transactions-surface'),nav=el('.mobile-bottom-nav');
        return {correctHierarchy:!!(hero&&quick&&recent&&hero.top<quick.top&&quick.top<recent.top),quickActionsVisible:!!(quick&&quick.width>0),bottomNavVisible:!!(nav&&nav.width===innerWidth)};
      });
      await page.locator('.mobile-action-scan').click();
      const openedOCR=await page.locator('.modal .slip-panel').isVisible();
      await page.locator('.modal .modal-heading button').click();
      record('mobile-home-actions',name,{...mobileHome,openedOCR,pageErrors:errors});
    }
    const menu=['รายการทั้งหมด','รอตรวจสอบ','รายงาน','ตั้งค่า'];
    const views=['transactions','inbox','reports','settings'];
    for(let i=0;i<menu.length;i++){
      const buttons=i===3?page.locator('.header-settings'):page.locator(width<=660?'.mobile-bottom-nav button':'.sidebar nav .nav-item').nth(i+1);
      try{await buttons.click({timeout:2500});}
      catch(err){
        const obstruction=await buttons.evaluate(el=>{
          const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
          const hit=document.elementFromPoint(x,y);
          return {buttonLabel:el.getAttribute('aria-label')||el.textContent?.trim(),rect:{x:r.x,y:r.y,width:r.width,height:r.height},hitTag:hit?.tagName,hitClass:hit?.className,hitText:hit?.textContent?.trim().slice(0,50)};
        });
        record('navigation-obstruction',name,{from:i===0?'home':views[i-1],to:views[i],obstruction,error:String(err).slice(0,250)});
        console.log('NAVIGATION_OBSTRUCTION',JSON.stringify({viewport:name,to:views[i],obstruction}));
        await buttons.evaluate(el=>el.click());
      }
      await scan(page,views[i],name);
    }
    await page.locator(width<=660?'.mobile-bottom-nav button':'.sidebar nav .nav-item').nth(1).click();
    const add=page.locator(width<=660?'.mobile-fab':'.top-add');
    await add.click({timeout:3500});
    await scan(page,'entry-modal',name);
    await page.getByRole('button',{name:/สแกนสลิปโอนเงิน/}).click();
    await scan(page,'ocr-panel',name);
    const modal=await page.evaluate(()=>{
      const el=document.querySelector('.modal');if(!el)return null;
      const r=el.getBoundingClientRect();
      return {viewportHeight:innerHeight,modalHeight:Math.round(r.height),modalScrollHeight:el.scrollHeight,modalClientHeight:el.clientHeight,actionsInView:Array.from(el.querySelectorAll('.modal-footer button')).map(x=>{const r=x.getBoundingClientRect();return{label:x.textContent?.trim(),bottom:Math.round(r.bottom),viewportBottom:innerHeight};})};
    });
    record('entry-scroll',name,{modal,pageErrors:errors});
    await page.getByRole('button',{name:'ปิดการสแกน'}).click();
    await page.locator('#amount').fill('125.50');
    await page.locator('#note').fill('รายการทดสอบ UX Audit');
    await page.getByRole('button',{name:'บันทึกรายการ',exact:true}).click();
    await page.waitForTimeout(500);
    const state=await page.evaluate(()=>({modalOpen:!!document.querySelector('.modal'),formError:document.querySelector('.modal .error-message')?.textContent?.trim()||null,toast:document.querySelector('.toast')?.textContent?.trim()||null}));
    if(state.modalOpen) await page.locator('.modal .modal-heading button').first().evaluate(el=>el.click());
    await page.evaluate(()=>{
      const nav=innerWidth<=660?document.querySelector('.mobile-bottom-nav'):document.querySelector('.sidebar');
      const target=Array.from(nav?.querySelectorAll('button')||[]).find(x=>x.textContent?.includes('รายการทั้งหมด'));
      target?.click();
    });
    await page.waitForTimeout(180);
    const confirmed=await page.getByText('รายการทดสอบ UX Audit').count();
    record('save-smoke',name,{savedVisible:confirmed>0,saveState:state,pageErrors:errors});
    await page.locator('.header-settings').click();
    const sample={app:'ngoentoday',version:1,exportedAt:new Date().toISOString(),transactions:[],settings:{monthlyBudgetSatang:0}};
    await page.locator('input[accept=".json,application/json"]').setInputFiles({name:'audit-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sample))});
    const restoreDialog=page.getByRole('alertdialog');
    await restoreDialog.waitFor();
    const locked=await page.getByRole('button',{name:'ยืนยันแทนที่ข้อมูล'}).isDisabled();
    await page.getByRole('checkbox',{name:/ฉันเข้าใจ/}).check();
    const unlocked=await page.getByRole('button',{name:'ยืนยันแทนที่ข้อมูล'}).isEnabled();
    await restoreDialog.getByRole('button',{name:'ยกเลิก'}).click();
    record('restore-smoke',name,{initiallyDisabled:locked,enabledAfterAcknowledgement:unlocked,closed:await restoreDialog.count()===0,pageErrors:errors});
    await context.close();
  }
  fs.writeFileSync(dir+'/audit.json',JSON.stringify({date:new Date().toISOString(),base,results:findings},null,2));
  const short=findings.map(f=>({viewport:f.viewport,view:f.view,overflowPx:f.overflowPx,smallTouchTargetCount:f.smallTouchTargetCount,touchTargetCount:f.touchTargetCount,smallTextCount:f.smallTextCount,textCount:f.textCount,axe:f.axe?.violations?.map(x=>x.id+':'+x.nodeCount),savedVisible:f.savedVisible,initiallyDisabled:f.initiallyDisabled,enabledAfterAcknowledgement:f.enabledAfterAcknowledgement,closed:f.closed,modal:f.modal,pageErrors:f.pageErrors})); 
  console.log('AUDIT_SUMMARY_START');
  console.log(JSON.stringify(short,null,2));
  console.log('AUDIT_SUMMARY_END');
  const focus=findings.filter(x=>['mobile320','tablet768'].includes(x.viewport)&&['home','inbox','reports','settings','entry-modal','ocr-panel'].includes(x.view));
  console.log('AXE_DETAILS_START');
  console.log(JSON.stringify(focus.map(x=>({viewport:x.viewport,view:x.view,violations:x.axe?.violations,smallTouchTargets:x.smallTouchTargets})),null,2));
  console.log('AXE_DETAILS_END');
  const critical=findings.filter(x=>x.view==='navigation-obstruction'
    ||x.overflowPx>0
    ||(x.axe?.violations?.length||0)>0
    ||(x.view==='save-smoke'&&(!x.savedVisible||x.pageErrors?.length))
    ||(x.view==='restore-smoke'&&(!x.initiallyDisabled||!x.enabledAfterAcknowledgement||!x.closed||x.pageErrors?.length))
    ||(x.view==='mobile-home-actions'&&(!x.correctHierarchy||!x.quickActionsVisible||!x.bottomNavVisible||!x.openedOCR||x.pageErrors?.length))
  ).map(x=>({viewport:x.viewport,view:x.view,overflowPx:x.overflowPx,axe:x.axe?.violations?.map(v=>v.id),savedVisible:x.savedVisible,restore:[x.initiallyDisabled,x.enabledAfterAcknowledgement,x.closed]}));
  if(critical.length){console.error('UX_ACCEPTANCE_FAIL',JSON.stringify(critical));process.exitCode=1;}
  else console.log('UX_ACCEPTANCE_PASS: 6 viewports, Inbox, mobile quick OCR, save, restore, responsive and WCAG scans');
} catch (err) {
  console.error('UX AUDIT FAILURE',err);
  process.exitCode=1;
 } finally {
  fs.writeFileSync(dir+'/audit.json',JSON.stringify({date:new Date().toISOString(),base,results:findings},null,2));
  if(browser)await browser.close();
  server.kill('SIGTERM');
}

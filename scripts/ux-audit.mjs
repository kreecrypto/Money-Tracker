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
  for(const [name,width,height] of [['mobile320',320,700],['iphone390',390,844],['tablet768',768,1024],['desktop1280',1280,800]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<700,hasTouch:width<700});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'networkidle'});
    await scan(page,'home',name);
    const menu=['รายการทั้งหมด','รายงาน','ตั้งค่า'];
    const views=['transactions','reports','settings'];
    for(let i=0;i<menu.length;i++){
      const buttons=page.getByRole('button',{name:menu[i],exact:true});
      await buttons.last().click();
      await scan(page,views[i],name);
    }
    const add=page.getByRole('button',{name:'เพิ่มรายการ',exact:true});
    await add.last().click();
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
    await page.waitForTimeout(200);
    const confirmed=await page.getByText('รายการทดสอบ UX Audit').count();
    record('save-smoke',name,{savedVisible:confirmed>0,pageErrors:errors});
    await context.close();
  }
  fs.writeFileSync(dir+'/audit.json',JSON.stringify({date:new Date().toISOString(),base,results:findings},null,2));
  const short=findings.map(f=>({viewport:f.viewport,view:f.view,overflowPx:f.overflowPx,smallTouchTargetCount:f.smallTouchTargetCount,touchTargetCount:f.touchTargetCount,smallTextCount:f.smallTextCount,textCount:f.textCount,axe:f.axe?.violations?.map(x=>x.id+':'+x.nodeCount),savedVisible:f.savedVisible,modal:f.modal,pageErrors:f.pageErrors})); 
  console.log('AUDIT_SUMMARY_START');
  console.log(JSON.stringify(short,null,2));
  console.log('AUDIT_SUMMARY_END');
} catch (err) {
  console.error('UX AUDIT FAILURE',err);
  process.exitCode=1;
} finally {
  if(browser)await browser.close();
  server.kill('SIGTERM');
}

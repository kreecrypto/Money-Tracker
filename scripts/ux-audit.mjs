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
    const gridExpected=vw>=1200?12:vw>=768?8:4;
    const gridTracks=(selector)=>{
      const el=document.querySelector(selector);
      if(!el)return null;
      const style=getComputedStyle(el);
      return style.display==='grid'?style.gridTemplateColumns.split(/\s+/).filter(Boolean).length:0;
    };
    const gridMain=gridTracks('.main-content');
    const gridHome=gridTracks('.mt-home-screen');
    const gridSettings=gridTracks('.settings-grid');
    const gridReportMetrics=gridTracks('.reference-report-summary');
    const gridScannerActions=gridTracks('.ref-ocr-modal .slip-upload-box .slip-actions');
    const settingsCardMinWidth=Math.min(...Array.from(document.querySelectorAll('.settings-grid > .settings-card')).map(card=>card.getBoundingClientRect().width),Infinity);
    const wide=Math.max(document.body.scrollWidth,document.documentElement.scrollWidth);
    const visibles=Array.from(document.querySelectorAll('button,[role="button"]'))
      .filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;})
      .map(e=>{const r=e.getBoundingClientRect();return {label:(e.getAttribute('aria-label')||e.textContent||e.getAttribute('title')||'').trim().replace(/\s+/g,' ').slice(0,55),width:Math.round(r.width),height:Math.round(r.height),size:parseFloat(getComputedStyle(e).fontSize)}});
    const textSizes=Array.from(document.querySelectorAll('p,span,label,small,dt,dd,strong'))
      .filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'})
      .map(e=>parseFloat(getComputedStyle(e).fontSize)).filter(n=>n>0);
    return {vw,scrollWidth:wide,gridExpected,gridMain,gridHome,gridSettings,gridReportMetrics,gridScannerActions,settingsCardMinWidth,overflowPx:Math.max(0,wide-vw),smallTouchTargets:visibles.filter(x=>x.width<44||x.height<44).slice(0,18),touchTargetCount:visibles.length,smallTouchTargetCount:visibles.filter(x=>x.width<44||x.height<44).length,smallTextCount:textSizes.filter(x=>x<12).length,textCount:textSizes.length,bodyFontPx:parseFloat(getComputedStyle(document.body).fontSize)};
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
    // IndexedDB initialization is async: audit the real Home, not its temporary loading screen.
    await page.locator('.home-dashboard').waitFor({timeout:15000});
    await scan(page,'home',name);
    if(width<=660){
      const mobileHome=await page.evaluate(()=>{
        const el=name=>document.querySelector(name)?.getBoundingClientRect();
        const hero=el('.mt-home-balance'),cta=el('.mt-home-upload'),recent=el('.mt-home-recent'),nav=el('.mobile-bottom-nav');
        return {correctHierarchy:!!(hero&&cta&&recent&&hero.top<cta.top&&cta.top<recent.top),noDuplicateActions:document.querySelectorAll('.mt-home-shortcut-grid button').length===0,bottomNavVisible:!!(nav&&nav.width===innerWidth)};
      });
      await page.locator('.mobile-action-scan').click();
      const openedOCR=await page.locator('.modal .slip-panel').isVisible();
      await page.locator('.modal .modal-heading button').click();
      record('mobile-home-actions',name,{...mobileHome,openedOCR,
         quickActionCount:await page.locator('.mt-home-shortcut-grid button').count(),
         categoryIcons:await page.locator('.money-category-icon').count(),
         pageErrors:errors});
    }
    const menu=['สมุดบัญชี','ตรวจบัญชี','ตั้งค่า'];
    const views=['transactions','reports','settings'];
    for(let i=0;i<menu.length;i++){
      const buttons=page.locator(width<=660?'.mobile-bottom-nav button':'.sidebar .nav-item').nth(i+1);
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
      if(i===1){
        const tabs=page.locator('.accountant-report-disclosure>summary');
        const count=await tabs.count();
        const overview=await page.locator('.accountant-review').isVisible()
          && await page.locator('#report-trends').isHidden()
          && await page.locator('#report-budget').isHidden();
        await tabs.nth(0).click();
        const trendOnly=await page.locator('#report-trends').isVisible()
          && await page.locator('#report-budget').isHidden();
        await tabs.nth(1).click();
        const budgetOnly=await page.locator('#report-budget').isVisible();
        const categoryOnly=await page.locator('.category-surface').isVisible();
        const noOverlay=width>660 || await page.locator('.mobile-fab').isHidden();
        record('report-view-switch',name,{count,trendOnly,budgetOnly,categoryOnly,overview,noOverlay,pageErrors:errors});
      }
    }
    if(name==='iphone390'){
      // Money Manager-style grouped ledger and accessible filter recovery.
      await page.locator('.mobile-bottom-nav button').nth(1).click();
      const ledgerAvailable=await page.locator('.transaction-page').isVisible();
      await page.locator('.transaction-page input[aria-label="ค้นหารายการ"]').fill('ไม่พบรายการนี้แน่นอน');
      const resetVisible=await page.locator('.filter-reset').isVisible();
      await page.locator('.filter-reset').click();
      const searchReset=await page.locator('.transaction-page input[aria-label="ค้นหารายการ"]').inputValue()==='';
      record('competitive-ledger-smoke',name,{ledgerAvailable,resetVisible,searchReset,pageErrors:errors});

      // Local IndexedDB persistence check: pending draft survives a page reload,
      // can be corrected into a single ledger transaction, and disappears afterward.
      await page.evaluate(async()=>{
        const store=await import('/src/lib/storage.ts');
        await store.savePendingSlip({
          id:'audit-pending-25',name:'sample-kplus.jpg',
          createdAt:Date.now(),updatedAt:Date.now(),
          amountSatang:2500,date:'2026-10-11',time:'17:10',
          recipient:'ร้านค้าตัวอย่าง',direction:null,method:'bank',category:'อื่น ๆ',
          directionReason:'ต้องตรวจประเภทรายการ',
          reason:'OCR ระบุประเภทไม่ได้',kind:'slip',
        });
      });
      await page.reload({waitUntil:'networkidle'});
      const homeBadge=await page.locator('.pending-home-alert').isVisible();
      await page.locator('.mobile-bottom-nav button').nth(1).click();
      await page.locator('.accountant-ledger-tabs button').nth(1).click();
      const pendingBefore=await page.locator('.pending-slip-card').count();
      await page.getByRole('button',{name:'ตรวจและแก้ไข'}).click();
      const pendingReviewChrome=await page.evaluate(()=>{
        const visible=(selector)=>Array.from(document.querySelectorAll(selector)).some(el=>{
          const r=el.getBoundingClientRect(),style=getComputedStyle(el);
          return r.width>0&&r.height>0&&style.display!=='none'&&style.visibility!=='hidden';
        });
        return {fabHidden:!visible('.mobile-fab'),bottomNavHidden:!visible('.mobile-bottom-nav')};
      });
      await scan(page,'pending-slip-review-form',name);
      await page.locator('.pending-slip-form select').first().selectOption('expense');
      await page.getByRole('button',{name:'บันทึกรายการนี้'}).click();
      await page.waitForTimeout(250);
      const pendingAfter=await page.locator('.pending-slip-card').count();
      await page.getByRole('button',{name:'บันทึกแล้ว'}).click();
      const savedVisible=await page.getByText('ร้านค้าตัวอย่าง').count()>0;
      record('pending-queue-smoke',name,{homeBadge,pendingBefore,pendingAfter,savedVisible,
        ...pendingReviewChrome,pageErrors:errors});
      await page.locator('.mobile-bottom-nav button').nth(1).click();
    }
    // The mobile scan shortcut intentionally lives on the Saved ledger only.
    if(width<=660)await page.locator('.mobile-bottom-nav button').nth(1).click();
    const add=page.locator(width<=660?'.mobile-fab':'.top-add');
    await add.click({timeout:3500});
    const slipDefault=await page.locator('.modal .slip-panel').isVisible();
    const uploadPrimary=await page.getByRole('button',{name:'เลือกรูป',exact:true}).isVisible();
    const autoSaveNext=await page.getByText('2 อ่านข้อมูลจากสลิป').isVisible() && await page.getByText('3 บันทึกหรือรอตรวจ').isVisible();
    const multiSelectable=await page.locator('input[aria-label="เลือกรูปสลิปหลายรูป"]').evaluate(el=>el instanceof HTMLInputElement&&el.multiple);
    const batchLimitVisible=await page.getByText(/สูงสุด 20 รูป/).isVisible();
    const uploadControls=await page.evaluate(()=>{
      const buttons=Array.from(document.querySelectorAll('.slip-upload-box .slip-actions .btn'));
      return buttons.map(el=>{
        const r=el.getBoundingClientRect();
        return {width:Math.round(r.width),height:Math.round(r.height),bottom:Math.round(r.bottom)};
      });
    });
    const compactUploadButtons=uploadControls.length===2&&uploadControls.every(b=>b.height>=44&&b.height<=58);
    const reviewButtonCount=await page.getByRole('button',{name:/ตรวจทานและบันทึก/}).count();
    record('slip-first-default',name,{slipDefault,uploadPrimary,autoSaveNext,multiSelectable,batchLimitVisible,compactUploadButtons,uploadControls,reviewButtonCount,pageErrors:errors});
    await scan(page,'slip-first-entry',name);
    await page.getByRole('button',{name:'กรอกเอง',exact:true}).click();
    const manualAvailable=await page.locator('#amount').isVisible();
    record('manual-entry-alternative',name,{manualAvailable,pageErrors:errors});
    await scan(page,'manual-entry',name);
    const modal=await page.evaluate(()=>{
      const el=document.querySelector('.modal');if(!el)return null;
      const r=el.getBoundingClientRect();
      return {viewportHeight:innerHeight,modalHeight:Math.round(r.height),modalScrollHeight:el.scrollHeight,modalClientHeight:el.clientHeight,actionsInView:Array.from(el.querySelectorAll('.modal-footer button')).map(x=>{const r=x.getBoundingClientRect();return{label:x.textContent?.trim(),bottom:Math.round(r.bottom),viewportBottom:innerHeight};})};
    });
    record('entry-scroll',name,{modal,pageErrors:errors});
    await page.locator('#amount').fill('125.50');
    await page.locator('#note').fill('รายการทดสอบ UX Audit');
    await page.getByRole('button',{name:'บันทึกรายการ',exact:true}).click();
    await page.waitForTimeout(500);
    const state=await page.evaluate(()=>({modalOpen:!!document.querySelector('.modal'),formError:document.querySelector('.modal .error-message')?.textContent?.trim()||null,toast:document.querySelector('.toast')?.textContent?.trim()||null}));
    if(state.modalOpen) await page.locator('.modal .modal-heading button').first().evaluate(el=>el.click());
    await page.evaluate(()=>{
      const nav=innerWidth<=660?document.querySelector('.mobile-bottom-nav'):document.querySelector('.sidebar');
      const target=Array.from(nav?.querySelectorAll('button')||[]).find(x=>['รายการ','รายการทั้งหมด'].includes(x.textContent?.trim()||''));
      target?.click();
    });
    await page.waitForTimeout(180);
    const confirmed=await page.getByText('รายการทดสอบ UX Audit').count();
    const groupedDateVisible=await page.locator('.transaction-day-heading').count()>0;
    record('save-smoke',name,{savedVisible:confirmed>0,groupedDateVisible,saveState:state,pageErrors:errors});
    await page.evaluate(()=>{
      const nav=innerWidth<=660?document.querySelector('.mobile-bottom-nav'):document.querySelector('.sidebar');
      Array.from(nav?.querySelectorAll('button')||[]).find(x=>x.textContent?.includes('ตั้งค่า')||x.getAttribute('aria-label')==='ตั้งค่า')?.click();
    });
    const sample={app:'ngoentoday',version:1,exportedAt:new Date().toISOString(),transactions:[],settings:{monthlyBudgetSatang:0}};
    await page.locator('input[accept=".json,application/json"]').setInputFiles({name:'audit-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sample))});
    const restoreDialog=page.getByRole('alertdialog');
    await restoreDialog.waitFor();
    const locked=await page.getByRole('button',{name:'ยืนยันแทนที่ข้อมูล'}).isDisabled();
    await page.getByRole('checkbox',{name:/ฉันเข้าใจ/}).check();
    const unlocked=await page.getByRole('button',{name:'ยืนยันแทนที่ข้อมูล'}).isEnabled();
    await restoreDialog.getByRole('button',{name:'ยกเลิก'}).click();
    record('restore-smoke',name,{initiallyDisabled:locked,enabledAfterAcknowledgement:unlocked,closed:await restoreDialog.count()===0,pageErrors:errors});

    // The destructive flow is exercised against a disposable audit browser only.
    // Verify deliberate confirmation and that no local records/pairing survive.
    await page.locator('.data-delete-btn').click();
    const deleteDialog=page.locator('.local-reset-modal');
    await deleteDialog.waitFor();
    const deletionLocked=await deleteDialog.locator('.btn-danger').isDisabled();
    await scan(page,'local-reset-dialog',name);
    await deleteDialog.locator('#local-reset-confirm').fill('ลบข้อมูล');
    const deletionUnlocked=await deleteDialog.locator('.btn-danger').isEnabled();
    await deleteDialog.locator('.btn-danger').click();
    await page.locator('.home-dashboard').waitFor({timeout:10000});
    const wiped=await page.evaluate(async()=>{
      const store=await import('/src/lib/storage.ts');
      return {transactions:(await store.loadTransactions()).length,
        pending:(await store.loadPendingSlips()).length,
        paired:localStorage.getItem('money-tracker-iphone-review-token-v1')!==null};
    });
    record('local-reset-smoke',name,{
      initiallyDisabled:deletionLocked,enabledAfterAcknowledgement:deletionUnlocked,
      wiped,dialogClosed:await deleteDialog.count()===0,pageErrors:errors
    });
    await context.close();
  }
  fs.writeFileSync(dir+'/audit.json',JSON.stringify({date:new Date().toISOString(),base,results:findings},null,2));
  const short=findings.map(f=>({viewport:f.viewport,view:f.view,overflowPx:f.overflowPx,smallTouchTargetCount:f.smallTouchTargetCount,touchTargetCount:f.touchTargetCount,smallTextCount:f.smallTextCount,textCount:f.textCount,axe:f.axe?.violations?.map(x=>x.id+':'+x.nodeCount),savedVisible:f.savedVisible,initiallyDisabled:f.initiallyDisabled,enabledAfterAcknowledgement:f.enabledAfterAcknowledgement,closed:f.closed,modal:f.modal,pageErrors:f.pageErrors})); 
  console.log('AUDIT_SUMMARY_START');
  console.log(JSON.stringify(short,null,2));
  console.log('AUDIT_SUMMARY_END');
  const focus=findings.filter(x=>['mobile320','iphone390','tablet768'].includes(x.viewport)&&['home','reports','settings','transactions','pending-slip-review-form','slip-first-entry','manual-entry'].includes(x.view));
  console.log('AXE_DETAILS_START');
  console.log(JSON.stringify(focus.map(x=>({viewport:x.viewport,view:x.view,violations:x.axe?.violations,smallTouchTargets:x.smallTouchTargets})),null,2));
  console.log('AXE_DETAILS_END');
  const critical=findings.filter(x=>x.view==='navigation-obstruction'
    ||x.overflowPx>0
    ||x.gridMain!==x.gridExpected
    ||(x.gridHome!==null&&x.gridHome!==x.gridExpected)
    ||(x.gridSettings!==null&&x.gridSettings!==x.gridExpected)
    ||(x.gridReportMetrics!==null&&x.gridReportMetrics!==x.gridExpected)
    ||(x.gridScannerActions!==null&&x.gridScannerActions!==x.gridExpected)
    ||(x.view==='settings'&&x.vw>=768&&x.vw<=930&&x.settingsCardMinWidth<400)
    ||(x.axe?.violations?.length||0)>0
    ||(x.view==='slip-first-default'&&(!x.slipDefault||!x.uploadPrimary||!x.autoSaveNext||!x.multiSelectable||!x.batchLimitVisible||!x.compactUploadButtons||x.reviewButtonCount>0||x.pageErrors?.length))
    ||(x.view==='manual-entry-alternative'&&(!x.manualAvailable||x.pageErrors?.length))
    ||(x.view==='save-smoke'&&(!x.savedVisible||!x.groupedDateVisible||x.pageErrors?.length))
    ||(x.view==='pending-queue-smoke'&&(!x.homeBadge||x.pendingBefore!==1||x.pendingAfter!==0||!x.savedVisible||!x.fabHidden||!x.bottomNavHidden||x.pageErrors?.length))
    ||(x.view==='restore-smoke'&&(!x.initiallyDisabled||!x.enabledAfterAcknowledgement||!x.closed||x.pageErrors?.length))
    ||(x.view==='local-reset-smoke'&&(!x.initiallyDisabled||!x.enabledAfterAcknowledgement||!x.dialogClosed||x.wiped?.transactions!==0||x.wiped?.pending!==0||x.wiped?.paired||x.pageErrors?.length))
    ||(x.view==='mobile-home-actions'&&(!x.correctHierarchy||x.quickActionCount!==0||!x.noDuplicateActions||!x.bottomNavVisible||!x.openedOCR||x.pageErrors?.length))
    ||(x.view==='report-view-switch'&&(x.count!==2||!x.trendOnly||!x.budgetOnly||!x.categoryOnly||!x.overview||!x.noOverlay||x.pageErrors?.length))
    ||(x.view==='competitive-ledger-smoke'&&(!x.ledgerAvailable||!x.resetVisible||!x.searchReset||x.pageErrors?.length))
  ).map(x=>({viewport:x.viewport,view:x.view,overflowPx:x.overflowPx,axe:x.axe?.violations?.map(v=>v.id),savedVisible:x.savedVisible,restore:[x.initiallyDisabled,x.enabledAfterAcknowledgement,x.closed]}));
  if(critical.length){console.error('UX_ACCEPTANCE_FAIL',JSON.stringify(critical));process.exitCode=1;}
  else console.log('UX_ACCEPTANCE_PASS: 6 viewport, minimal home, slip-first, manual fallback, save, restore, responsive and WCAG scans');
} catch (err) {
  console.error('UX AUDIT FAILURE',err);
  process.exitCode=1;
 } finally {
  fs.writeFileSync(dir+'/audit.json',JSON.stringify({date:new Date().toISOString(),base,results:findings},null,2));
  if(browser)await browser.close();
  server.kill('SIGTERM');
}

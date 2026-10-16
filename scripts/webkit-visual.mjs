import {webkit} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const base='http://127.0.0.1:4173';
const directory='audit-artifacts';
fs.mkdirSync(directory,{recursive:true});
const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'ignore'});
let browser;
const findings=[];
try{
  let ready=false;
  for(let i=0;i<110;i++){
    try{if((await fetch(base)).ok){ready=true;break;}}catch{}
    await delay(300);
  }
  if(!ready)throw new Error('Local app did not become ready');
  browser=await webkit.launch({headless:true});
  for(const [label,width,height] of [['safari375',375,812],['safari390',390,844],['safari430',430,932]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base,{waitUntil:'networkidle'});
    await page.locator('.hero-card').waitFor({timeout:15000});
    // Only a disposable browser context receives synthetic amounts.
    await page.evaluate(async()=>{
      const {saveTransaction}=await import('/src/lib/storage.ts');
      const {todayLocal}=await import('/src/lib/finance.ts');
      const day=todayLocal();
      await saveTransaction({id:'safari-fixture-income',type:'income',amountSatang:3240000,date:day,category:'เงินเดือน',note:'เงินเข้าทดสอบ',method:'bank',createdAt:Date.now()-5000});
      await saveTransaction({id:'safari-fixture-expense',type:'expense',amountSatang:775000,date:day,category:'อาหารและเครื่องดื่ม',note:'อาหารทดสอบ',method:'bank',createdAt:Date.now()});
    });
    await page.reload({waitUntil:'networkidle'});
    await page.locator('.mt-home-transaction').first().waitFor({timeout:10000});
    const home=await page.evaluate(()=>{
      const rect=(selector)=>document.querySelector(selector)?.getBoundingClientRect();
      const hero=rect('.mt-home-balance'),cta=rect('.mt-home-upload'),quick=rect('.mt-home-shortcuts'),recent=rect('.mt-home-recent'),navigation=rect('.mobile-bottom-nav');
      const icons=Array.from(document.querySelectorAll('.mobile-bottom-nav button svg')).map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};});
      return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),order:!!(hero&&cta&&quick&&recent&&hero.top<cta.top&&cta.top<quick.top&&quick.top<recent.top),
        actionCount:document.querySelectorAll('.mt-home-shortcut-grid button').length,navCount:document.querySelectorAll('.mobile-bottom-nav button').length,
        navVisible:!!(navigation&&navigation.top>=0&&navigation.bottom<=innerHeight+2),icons};
    });
    await page.screenshot({path:`${directory}/${label}-home.png`,fullPage:true});
    // The V2 prototype month menu must not be clipped by the green card.
    await page.locator('.mt-home-month-picker').click();
    const monthOptions=await page.locator('.mt-home-month-popover [role="option"]').count();
    const menuUnclipped=await page.locator('.mt-home-month-popover').evaluate(el=>{
      const r=el.getBoundingClientRect();
      return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;
    });
    await page.keyboard.press('Escape');
    const monthCloses=await page.locator('.mt-home-month-popover').count()===0;
    await page.locator('.mt-home-transaction').first().click();
    const detailsOpen=await page.locator('.mt-home-detail[open]').isVisible();
    await page.locator('.mt-home-detail-done').click();
    const detailsClose=await page.locator('.mt-home-detail[open]').count()===0;
    await page.locator('.mobile-bottom-nav button').nth(1).click();
    const transactions=await page.locator('.transaction-financial-summary>div').count();
    const list=await page.locator('.transaction-page').isVisible();
    await page.screenshot({path:`${directory}/${label}-transactions.png`,fullPage:true});
    await page.locator('.mt-search-field input').fill('nonexistent-transaction-987654');
    const searchEmpty=await page.getByText('ไม่พบรายการตามเงื่อนไข').isVisible();
    await page.locator('.mt-search-field input').fill('');
    await page.locator('.mt-segmented-filters button').nth(1).click();
    const incomeFiltered=await page.locator('.mt-transactions-screen .transaction-row').count()===1;
    await page.locator('.mt-segmented-filters button').nth(0).click();
    const allTransactions=await page.locator('.mt-transactions-screen .transaction-row').count()===2;
    await page.locator('.mobile-fab').click();
    const scanner=await page.locator('.slip-upload-box').isVisible();
    const scannerColors=await page.evaluate(()=>{
      const title=document.querySelector('.ref-ocr-modal .slip-upload-box>strong');
      const glyph=document.querySelector('.ref-ocr-modal .slip-upload-icon');
      return {title:title?getComputedStyle(title).color:null,glyph:glyph?getComputedStyle(glyph).color:null};
    });
    const readableScanner=['title','glyph'].every(k=>{
      const value=scannerColors[k];
      if(!value)return false;
      const rgb=value.match(/\d+/g)?.slice(0,3).map(Number)||[];
      return rgb.length===3&&rgb[0]<110&&rgb[1]<140&&rgb[2]<110;
    });
    await page.screenshot({path:`${directory}/${label}-slip-upload.png`,fullPage:true});
    await page.locator('.modal-heading button').click();
    await page.locator('.mobile-bottom-nav button').nth(2).click();
    const reportsOverview=await page.locator('#report-spending .spending-donut').isVisible()
       &&await page.locator('#report-budget').isVisible()
       &&await page.locator('#report-trends').isVisible();
    await page.screenshot({path:`${directory}/${label}-reports-overview.png`,fullPage:true});
    await page.locator('.ref-report-tabs button').nth(1).click();
    const categoryView=await page.locator('#report-spending').isVisible()
       &&await page.locator('#report-budget').count()===0
       &&await page.locator('#report-trends').count()===0;
    await page.locator('.ref-report-tabs button').nth(2).click();
    const trendsOnly=await page.locator('#report-trends').isVisible()&&await page.locator('#report-budget').count()===0;
    const noReportsFab=await page.locator('.mobile-fab').isHidden();
    await page.screenshot({path:`${directory}/${label}-report-trends.png`,fullPage:true});
    await page.locator('.mobile-bottom-nav button').nth(3).click();
    const settings=await page.getByText('เกี่ยวกับแอป').isVisible();
    await page.screenshot({path:`${directory}/${label}-settings.png`,fullPage:true});
    findings.push({label,home,monthOptions,menuUnclipped,monthCloses,detailsOpen,detailsClose,transactions,list,searchEmpty,incomeFiltered,allTransactions,reportsOverview,categoryView,scanner,scannerColors,readableScanner,trendsOnly,noReportsFab,settings,errors});
    await context.close();
  }
  fs.writeFileSync(`${directory}/webkit-report.json`,JSON.stringify(findings,null,2));
  console.log('WEBKIT_SAFARI_VISUAL_RESULTS',JSON.stringify(findings));
  const failed=findings.filter(f=>f.home.overflow>1||!f.home.order||f.home.actionCount!==4||f.home.navCount!==4||
    !f.home.navVisible||f.home.icons.some(icon=>icon.width<20||icon.height<20)||f.monthOptions!==13||!f.menuUnclipped||!f.monthCloses||!f.detailsOpen||!f.detailsClose||!f.searchEmpty||!f.incomeFiltered||!f.allTransactions||!f.reportsOverview||!f.categoryView||f.transactions!==2||!f.list||!f.scanner||!f.readableScanner||!f.trendsOnly||!f.noReportsFab||!f.settings||f.errors.length);
  if(failed.length){console.error('WEBKIT_SAFARI_VISUAL_FAIL',JSON.stringify(failed));process.exitCode=1;}
  else console.log('WEBKIT_SAFARI_VISUAL_PASS: 3 phone sizes, balance, donut, icons, tabbar, scan, transactions, settings');
}catch(error){
  console.error('WEBKIT_SAFARI_AUDIT_ERROR',error);
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}

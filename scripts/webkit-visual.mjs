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
    await page.locator('.spending-donut').waitFor({timeout:10000});
    const home=await page.evaluate(()=>{
      const rect=(selector)=>document.querySelector(selector)?.getBoundingClientRect();
      const hero=rect('.hero-card'),quick=rect('.mobile-quick-actions'),spending=rect('.home-spending-card'),recent=rect('.transactions-surface'),navigation=rect('.mobile-bottom-nav');
      const icons=Array.from(document.querySelectorAll('.mobile-bottom-nav button svg')).map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};});
      return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),order:!!(hero&&quick&&spending&&recent&&hero.top<quick.top&&quick.top<spending.top&&spending.top<recent.top),
        actionCount:document.querySelectorAll('.mobile-quick-actions button').length,navCount:document.querySelectorAll('.mobile-bottom-nav button').length,
        navVisible:!!(navigation&&navigation.top>=0&&navigation.bottom<=innerHeight+2),icons};
    });
    await page.screenshot({path:`${directory}/${label}-home.png`,fullPage:true});
    await page.locator('.mobile-bottom-nav button').nth(1).click();
    const transactions=await page.locator('.transaction-financial-summary>div').count();
    const list=await page.locator('.transaction-page').isVisible();
    await page.screenshot({path:`${directory}/${label}-transactions.png`,fullPage:true});
    await page.locator('.mobile-fab').click();
    const scanner=await page.locator('.slip-upload-box').isVisible();
    await page.screenshot({path:`${directory}/${label}-slip-upload.png`,fullPage:true});
    await page.locator('.modal-heading button').click();
    await page.locator('.mobile-bottom-nav button').nth(3).click();
    const settings=await page.getByText('เกี่ยวกับแอป').isVisible();
    await page.screenshot({path:`${directory}/${label}-settings.png`,fullPage:true});
    findings.push({label,home,transactions,list,scanner,settings,errors});
    await context.close();
  }
  fs.writeFileSync(`${directory}/webkit-report.json`,JSON.stringify(findings,null,2));
  console.log('WEBKIT_SAFARI_VISUAL_RESULTS',JSON.stringify(findings));
  const failed=findings.filter(f=>f.home.overflow>1||!f.home.order||f.home.actionCount!==4||f.home.navCount!==4||
    !f.home.navVisible||f.home.icons.some(icon=>icon.width<20||icon.height<20)||f.transactions!==2||!f.list||!f.scanner||!f.settings||f.errors.length);
  if(failed.length){console.error('WEBKIT_SAFARI_VISUAL_FAIL',JSON.stringify(failed));process.exitCode=1;}
  else console.log('WEBKIT_SAFARI_VISUAL_PASS: 3 phone sizes, balance, donut, icons, tabbar, scan, transactions, settings');
}catch(error){
  console.error('WEBKIT_SAFARI_AUDIT_ERROR',error);
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
}

/** WebKit-on-Linux iPhone-sized mobile smoke. NOT real iOS Safari, Shortcuts, VoiceOver or bank OCR QA. */
import {webkit} from 'playwright';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';

const dir='audit-artifacts/iphone-webkit';
fs.mkdirSync(dir,{recursive:true});
const base='http://127.0.0.1:4178';
const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','4178','--strictPort'],{
  stdio:'ignore',env:{...process.env,VITE_IPHONE_BRIDGE_URL:'https://iphone-bridge.test'}
});
const results=[];
let browser;
async function ready(){
  for(let i=0;i<90;i++){
    try{if((await fetch(base,{signal:AbortSignal.timeout(1000)})).ok)return;}catch{}
    await sleep(300);
  }
  throw Error('QA Vite server did not become ready');
}
function ensure(condition,label){if(!condition)throw Error('WEBKIT_QA_FAILED: '+label);}
try{
  await ready();
  browser=await webkit.launch({headless:true});
  for(const width of [320,390,430]){
    const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'th-TH'});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base,{waitUntil:'networkidle'});
    await page.locator('.mobile-bottom-nav').waitFor({timeout:8000});
    const overflow=await page.evaluate(()=>Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-document.documentElement.clientWidth);
    ensure(overflow<=0,'horizontal overflow '+width+': '+overflow);
    await page.screenshot({path:dir+'/home-'+width+'.png',fullPage:true});
    await page.locator('.mobile-bottom-nav button').nth(2).click();
    await page.screenshot({path:dir+'/inbox-'+width+'.png',fullPage:true});
    await page.locator('.mobile-bottom-nav button').nth(0).click();
    await page.locator('.mobile-action-scan').click();
    ensure(await page.locator('.modal .slip-panel').isVisible(),'scanner modal inaccessible at '+width);
    if(width===390){
      await page.locator('.slip-panel input[aria-label="เลือกรูปสลิป"]').setInputFiles({
        name:'synthetic-invalid.heic',mimeType:'image/heic',buffer:Buffer.from('00000018667479706865696300000000','hex')
      });
      await page.locator('.slip-panel .error-message').waitFor({state:'visible',timeout:10000});
      const message=(await page.locator('.slip-panel .error-message').textContent())||'';
      ensure(/HEIC|Safari|JPG/.test(message),'HEIC fallback message missing in WebKit');
      await page.screenshot({path:dir+'/heic-fallback-'+width+'.png',fullPage:true});
    }
    ensure(errors.length===0,'JavaScript errors at '+width+': '+errors.join(';').slice(0,200));
    results.push({engine:'Playwright WebKit Linux',viewport:width,overflowPx:overflow,inboxNavigation:true,scannerOpened:true,jsErrorCount:errors.length,heicFallbackTested:width===390,passed:true});
    await context.close();
  }
  console.log('WEBKIT_MOBILE_SMOKE_PASS (emulation only, not physical iOS 26)',JSON.stringify(results));
}catch(e){
  process.exitCode=1;
  console.error('WEBKIT_MOBILE_SMOKE_FAILED',e instanceof Error?e.message:String(e));
}finally{
  fs.writeFileSync(dir+'/results.json',JSON.stringify({timestamp:new Date().toISOString(),realDeviceVerified:false,results},null,2));
  if(browser)await browser.close();
  server.kill('SIGTERM');
}

import {webkit} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const base='http://127.0.0.1:4173';
const directory='audit-artifacts';
fs.mkdirSync(directory,{recursive:true});
const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'ignore'});
let demoServer;
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
  for(const [label,width,height] of [['safari320',320,700],['safari375',375,812],['safari390',390,844],['safari430',430,932]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base,{waitUntil:'networkidle'});
    await page.locator('.mt-finance-calendar').waitFor({timeout:15000});
    // Only a disposable browser context receives synthetic amounts.
    await page.evaluate(async()=>{
      const {saveTransaction}=await import('/src/lib/storage.ts');
      const {todayLocal}=await import('/src/lib/finance.ts');
      const day=todayLocal();
      await saveTransaction({id:'safari-fixture-income',type:'income',amountSatang:3240000,date:day,category:'เงินเดือน',note:'เงินเข้าทดสอบ',sender:'ผู้โอนทดสอบ',method:'bank',createdAt:Date.now()-5000});
      await saveTransaction({id:'safari-fixture-expense',type:'expense',amountSatang:775000,date:day,category:'อาหารและเครื่องดื่ม',note:'อาหารทดสอบ',method:'bank',createdAt:Date.now()});
    });
    await page.reload({waitUntil:'networkidle'});
    await page.locator('.mt-home-transaction').first().waitFor({timeout:10000});
    const home=await page.evaluate(()=>{
      const rect=(selector)=>document.querySelector(selector)?.getBoundingClientRect();
      const calendar=rect('.mt-finance-calendar'),day=rect('.mt-home-day-detail'),cta=rect('.mobile-fab'),navigation=rect('.mobile-bottom-nav');
      const icons=Array.from(document.querySelectorAll('.mobile-bottom-nav button svg')).map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};});
      const gridTracks=selector=>getComputedStyle(document.querySelector(selector)).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
      const pageGrid=gridTracks('.main-content');
      const homeGrid=gridTracks('.mt-home-screen');
      const onlyCalendarAndLedger=!document.querySelector('.mt-home-balance,.mt-home-upload,.mt-home-recent,.mt-home-below,.accounting-secretary');
      return {overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),order:!!(calendar&&day&&cta&&calendar.bottom<day.top&&cta.width>=44),onlyCalendarAndLedger,calendarDays:document.querySelectorAll('.mt-calendar-day:not([disabled])').length,
        actionCount:document.querySelectorAll('.mt-home-shortcut-grid button').length,navCount:document.querySelectorAll('.mobile-bottom-nav button').length,
        navVisible:!!(navigation&&navigation.top>=0&&navigation.bottom<=innerHeight+2),pageGrid,homeGrid,icons};
    });

    // At 320px, retain 44px date targets but make the last weekday discoverable.
    const calendarAccess=await page.locator('.mt-calendar-scroll').evaluate(el=>({
      overflows:el.scrollWidth>el.clientWidth+1,
      initial:el.scrollLeft
    }));
    let calendarCanNavigate=true;
    if(calendarAccess.overflows){
      const hintVisible=await page.locator('.mt-calendar-scroll-actions').isVisible();
      const next=page.getByRole('button',{name:'เลื่อนปฏิทินไปทางขวา'});
      const previous=page.getByRole('button',{name:'เลื่อนปฏิทินไปทางซ้าย'});
      const ready=await next.isEnabled();
      await next.click();
      const advanced=await page.locator('.mt-calendar-scroll').evaluate(el=>el.scrollLeft>1);
      await previous.click();
      const restored=await page.locator('.mt-calendar-scroll').evaluate(el=>el.scrollLeft<=1);
      calendarCanNavigate=hintVisible&&ready&&advanced&&restored;
    }
    const brandLoaded=await page.locator('.mt-home-brand-icon img').evaluate(img=>img.complete&&img.naturalWidth>0);
    await page.screenshot({path:`${directory}/${label}-home.png`,fullPage:true});
    // Verify same-day incoming/outgoing and an actual tap, not just calendar visibility.
    const today=await page.evaluate(async()=>(await import('/src/lib/finance.ts')).todayLocal());
    const todayCell=page.locator('.mt-calendar-day[data-date="'+today+'"]');
    const figures=todayCell.locator('.mt-calendar-day-amounts');
    const calendarBoth=await figures.locator('.is-income,.is-expense').count()===2;
    const calendarFiguresVisible=await figures.isVisible();
    const calendarFiguresText=await figures.innerText();
    const calendarFiguresNumeric=calendarFiguresText.includes('+')&&calendarFiguresText.includes('−')&&/\d/.test(calendarFiguresText);
    await todayCell.click();
    const calendarSelected=await todayCell.getAttribute('aria-pressed')==='true';
    const calendarDetailText=await page.locator('.mt-home-day-detail').innerText();
    const calendarDetail=calendarDetailText.includes('32,400.00')&&calendarDetailText.includes('7,750.00');
    // The calendar heading has the only month-changing control on Home.
    const calendarMonthBefore=await page.locator('.mt-calendar-month-label').textContent();
    await page.locator('.mt-home-month-picker').click();
    await page.locator('.mt-home-month-popover [role="option"]').nth(5).click();
    const calendarPreviousMonth=(await page.locator('.mt-calendar-month-label').textContent())!==calendarMonthBefore;
    await page.locator('.mt-home-month-picker').click();
    await page.locator('.mt-home-month-popover [role="option"]').nth(7).click();
    const calendarMonthRestored=(await page.locator('.mt-calendar-month-label').textContent())===calendarMonthBefore;

    // The V2 prototype month menu must not be clipped by the green card.
    await page.locator('.mt-home-month-picker').click();
    const monthOptions=await page.locator('.mt-home-month-popover [role="option"]').count();
    await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='option');
    const focusedMonthBefore=await page.locator('.mt-home-month-popover [role="option"]:focus').textContent();
    await page.keyboard.press('ArrowDown');
    const focusedMonthAfter=await page.locator('.mt-home-month-popover [role="option"]:focus').textContent();
    const arrowNavigatesMonth=focusedMonthBefore!==focusedMonthAfter;
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
    const monthLabel=(await page.locator('.month-picker span').textContent())?.trim();
    const ledgerMonthCorrect=(await page.locator('.transaction-month-summary summary').textContent()).includes(monthLabel);
    const searchInput=page.locator('.transaction-page input[aria-label="ค้นหารายการ"]');
    await searchInput.fill('ผู้โอนทดสอบ');
    const ledgerSenderSearch=await page.locator('.transaction-page .transaction-open').count()===1;
    await searchInput.fill('');
    const ledgerRow=page.locator('.transaction-page .transaction-open').first();
    await ledgerRow.click();
    const ledgerDetailOpen=await page.locator('.mt-home-detail[open]').isVisible();
    await page.locator('.mt-home-detail-done').click();
    const ledgerDetailClosed=await page.locator('.mt-home-detail[open]').count()===0;
    const ledgerFocusRestored=await ledgerRow.evaluate(el=>document.activeElement===el);
    const ledgerMoneySingleLine=await page.locator('.transaction-page .transaction-end b').evaluateAll(elements=>
      elements.length>=2&&elements.every(el=>{
        const style=getComputedStyle(el),rect=el.getBoundingClientRect(),row=el.closest('.transaction-row')?.getBoundingClientRect();
        return style.whiteSpace==='nowrap'&&rect.right<innerWidth+2&&(!row||row.right<innerWidth+2)&&
          rect.height<=(parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.6)*1.25;
      })
    );
    await page.screenshot({path:`${directory}/${label}-transactions.png`,fullPage:true});
    await page.locator('.mobile-fab').click();
    const scanner=await page.locator('.slip-upload-box').isVisible();
    const compactUploadButtons=await page.locator('.slip-upload-box .slip-actions .btn').evaluateAll(buttons=>
      buttons.length===2&&buttons.every(button=>{
        const rect=button.getBoundingClientRect();
        return rect.height>=44&&rect.height<=58;
      })
    );
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
    const slipArtLoaded=await page.locator('.reference-slip-art').evaluate(img=>img.complete&&img.naturalWidth>0);
    await page.screenshot({path:`${directory}/${label}-slip-upload.png`,fullPage:true});
    await page.locator('.modal-heading button').click();
    await page.locator('.mobile-bottom-nav button').nth(2).click();
    const reportOverview=await page.locator('.accountant-review-totals>div').count()===2
      &&await page.locator('.reference-report-summary .metric').count()===0
      &&await page.locator('.reference-overview-trends').isVisible()
      &&await page.locator('.ref-report-spending').isVisible();
    await page.screenshot({path:`${directory}/${label}-report-overview.png`,fullPage:true});
    await page.locator('.ref-report-tabs button').nth(1).click();
    const reportCategory=page.locator('.report-category-breakdown summary').first();
    const hasCategory=await reportCategory.isVisible();
    if(hasCategory)await reportCategory.click();
    const reportDrilldown=hasCategory&&await page.locator('.report-category-breakdown[open] .report-category-expense-row').count()>0&&await page.locator('.report-category-breakdown[open] .report-category-subgroup').count()>0;
    await page.screenshot({path:`${directory}/${label}-report-category-details.png`,fullPage:true});
    await page.locator('.ref-report-tabs button').nth(2).click();
    const trendsOnly=await page.locator('#report-trends').isVisible()&&await page.locator('#report-budget').count()===0;
    const noReportsFab=await page.locator('.mobile-fab').isHidden();
    await page.screenshot({path:`${directory}/${label}-report-trends.png`,fullPage:true});
    await page.locator('.mobile-bottom-nav button').nth(3).click();
    const settings=await page.locator('#settings-about h3').isVisible();
    const settingsDirectory=await page.locator('.reference-settings-link').count()===7;
    const settingsAnchors=await page.locator('.reference-settings-link').evaluateAll(links=>links.every(link=>{
      const target=link.getAttribute('href');
      return target?.startsWith('#')&&!!document.querySelector(target);
    }));
    const noSettingsFab=await page.locator('.mobile-fab').count()===0;
    await page.screenshot({path:`${directory}/${label}-settings.png`,fullPage:true});
    // Universal design acceptance: control has a visible pressed state,
    // text actually grows, Home remains in the viewport, and reload persists.
    await page.getByRole('button',{name:'ตัวอักษรใหญ่'}).click();
    const largeSetting=await page.evaluate(()=>{
      const text=document.querySelector('.reading-preference-card > p');
      const large=document.querySelector('.reading-preference-options button[aria-pressed="true"]');
      return {active:document.documentElement.dataset.readingSize==='large',
        fontSize:text?parseFloat(getComputedStyle(text).fontSize):0,
        selected:!!large&&large.textContent?.includes('ตัวอักษรใหญ่')};
    });
    await page.locator('.mobile-bottom-nav button').first().click();
    const largeHome=await page.evaluate(()=>{
      const main=document.querySelector('.mt-home-transaction-text strong');
      const nav=Array.from(document.querySelectorAll('.mobile-bottom-nav button'));
      const vw=document.documentElement.clientWidth;
      return {overflow:Math.max(0,document.documentElement.scrollWidth-vw),
        textSize:main?parseFloat(getComputedStyle(main).fontSize):0,
        navigation:nav.length===4&&nav.every(el=>el.getBoundingClientRect().height>=44)};
    });
    await page.screenshot({path:`${directory}/${label}-home-large-text.png`,fullPage:true});
    await page.reload({waitUntil:'networkidle'});
    const savedReadingMode=await page.evaluate(()=>
      document.documentElement.dataset.readingSize==='large'&&
      localStorage.getItem('ngoentoday-reading-size-v1')==='large'
    );
    await page.locator('.mobile-fab').click();
    const largeScanner=await page.locator('.slip-upload-box .slip-actions .btn').evaluateAll(buttons=>
      buttons.length===2&&buttons.every(button=>{
        const height=button.getBoundingClientRect().height;
        return height>=44&&height<=58;
      })
    );
    await page.locator('.modal-heading button').click();
    findings.push({label,home,calendarCanNavigate,calendarBoth,calendarFiguresVisible,calendarFiguresNumeric,calendarSelected,calendarDetail,calendarPreviousMonth,calendarMonthRestored,monthOptions,arrowNavigatesMonth,menuUnclipped,monthCloses,detailsOpen,detailsClose,transactions,list,ledgerMonthCorrect,ledgerSenderSearch,ledgerDetailOpen,ledgerDetailClosed,ledgerFocusRestored,ledgerMoneySingleLine,brandLoaded,scanner,slipArtLoaded,compactUploadButtons,scannerColors,readableScanner,reportOverview,reportDrilldown,trendsOnly,noReportsFab,settings,settingsDirectory,settingsAnchors,noSettingsFab,largeSetting,largeHome,savedReadingMode,largeScanner,errors});
    await context.close();
  }
  // Exercise the *same* compile-time Preview flag as Vercel, using a disposable WebKit context.
  demoServer=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','4174','--strictPort'],{
    stdio:'ignore',env:{...process.env,VERCEL_ENV:'preview'}
  });
  const demoBase='http://127.0.0.1:4174';
  let demoReady=false;
  for(let attempt=0;attempt<100;attempt++){
    try{if((await fetch(demoBase)).ok){demoReady=true;break;}}catch{}
    await delay(250);
  }
  if(!demoReady)throw new Error('Preview demo dev server did not become ready');
  const demoContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const demoPage=await demoContext.newPage();
  const demoErrors=[];
  demoPage.on('pageerror',error=>demoErrors.push(error.message));
  await demoPage.goto(demoBase,{waitUntil:'networkidle'});
  await demoPage.getByText('DEMO · ข้อมูลตัวอย่างเท่านั้น').waitFor({timeout:12000});
  const demoHomeRows=await demoPage.locator('.mt-home-transaction').count();
  await demoPage.locator('.mobile-bottom-nav button').nth(1).click();
  const demoAllRows=await demoPage.locator('.transaction-open').count();
  const searchInput=demoPage.locator('.transaction-page input[aria-label="ค้นหารายการ"]');
  await searchInput.fill('บริษัทตัวอย่าง');
  const demoSenderRows=await demoPage.locator('.transaction-open').count();
  const demoSearchFocus=await searchInput.evaluate(el=>document.activeElement===el);
  await demoPage.locator('.transaction-open').first().click();
  const demoDetails=await demoPage.locator('.mt-home-detail[open]').isVisible();
  await demoPage.locator('.mt-home-detail-done').click();
  const demoDetailsClosed=await demoPage.locator('.mt-home-detail[open]').count()===0;
  const demoReadOnly=await demoPage.locator('.transaction-actions,.mobile-row-actions').count()===0;
  await demoPage.locator('.mobile-bottom-nav button').nth(2).click();

  const demoReports=await demoPage.locator('.accountant-review').isVisible();
  const demoReportsTabs=await demoPage.locator('.ref-report-tabs button').count()===4;
  await demoPage.locator('.ref-report-tabs button').nth(2).click();
  const demoTrend=await demoPage.locator('#report-trends .bars-chart').isVisible();
  await demoPage.locator('.ref-report-tabs button').nth(1).click();
  const demoCategories=await demoPage.locator('.report-panels').isVisible();
  const demoCategoryRow=demoPage.locator('.report-category-breakdown summary').first();
  const demoCategoryAvailable=await demoCategoryRow.isVisible();
  if(demoCategoryAvailable)await demoCategoryRow.click();
  const demoCategoryDetails=demoCategoryAvailable&&await demoPage.locator('.report-category-breakdown[open] .report-category-expense-row').count()>0;
  await demoPage.screenshot({path:`${directory}/preview-report-category-details.png`,fullPage:true});
  await demoPage.locator('.ref-report-tabs button').nth(3).click();
  const demoBudget=await demoPage.locator('#report-budget').isVisible();
  await demoPage.locator('.mobile-bottom-nav button').nth(3).click();
  const demoSettings=await demoPage.locator('.settings-grid > .settings-card').count()>=6;
  const demoSettingsLinks=await demoPage.locator('.reference-settings-index a').count()===7;
  const demoReading=await demoPage.locator('#settings-reading .reading-preference-options button').count()===2;
  const demoNoDangerousButtons=await demoPage.locator('#settings-data button:not([disabled])').count()===0;
  await demoPage.locator('#settings-reading .reading-preference-options button').nth(1).click();
  const demoLargeText=await demoPage.evaluate(()=>document.documentElement.dataset.readingSize==='large');
  const demoNoFinanceStorage=await demoPage.evaluate(async()=>{
    const names=await indexedDB.databases();
    return !names.some(db=>db.name==='ngoentoday-db');
  });

  await demoPage.screenshot({path:`${directory}/preview-demo-safari390.png`,fullPage:true});
  const demoEvidence={demoHomeRows,demoAllRows,demoSenderRows,demoSearchFocus,demoDetails,demoDetailsClosed,demoReadOnly,demoReports,demoReportsTabs,demoTrend,demoCategories,demoCategoryDetails,demoBudget,demoSettings,demoSettingsLinks,demoReading,demoNoDangerousButtons,demoLargeText,demoNoFinanceStorage,demoErrors};
  findings.push({label:'preview-demo-safari390',...demoEvidence});
  await demoContext.close();
  if(demoHomeRows<2||demoAllRows<5||demoSenderRows!==1||!demoSearchFocus||!demoDetails||!demoDetailsClosed||!demoReadOnly||!demoReports||!demoReportsTabs||!demoTrend||!demoCategories||!demoCategoryDetails||!demoBudget||!demoSettings||!demoSettingsLinks||!demoReading||!demoNoDangerousButtons||!demoLargeText||!demoNoFinanceStorage||demoErrors.length)
    throw new Error('WEBKIT_PREVIEW_DEMO_FAIL '+JSON.stringify(demoEvidence));
  console.log('WEBKIT_PREVIEW_DEMO_PASS',JSON.stringify(demoEvidence));
  fs.writeFileSync(`${directory}/webkit-report.json`,JSON.stringify(findings,null,2));
  console.log('WEBKIT_SAFARI_VISUAL_RESULTS',JSON.stringify(findings));
  const failed=findings.filter(f=>f.label!=='preview-demo-safari390').filter(f=>f.home.overflow>1||!f.calendarCanNavigate||!f.ledgerMoneySingleLine||!f.home.order||!f.home.onlyCalendarAndLedger||f.home.calendarDays<28||f.home.actionCount!==0||!f.calendarBoth||!f.calendarFiguresVisible||!f.calendarFiguresNumeric||!f.calendarSelected||!f.calendarDetail||!f.calendarPreviousMonth||!f.calendarMonthRestored||f.home.navCount!==4||
    f.home.pageGrid!==4||f.home.homeGrid!==4||
    !f.home.navVisible||f.home.icons.some(icon=>icon.width<20||icon.height<20)||f.monthOptions!==13||!f.arrowNavigatesMonth||!f.menuUnclipped||!f.monthCloses||!f.detailsOpen||!f.detailsClose||f.transactions!==2||!f.list||!f.ledgerMonthCorrect||!f.ledgerSenderSearch||!f.ledgerDetailOpen||!f.ledgerDetailClosed||!f.ledgerFocusRestored||!f.brandLoaded||!f.slipArtLoaded||!f.reportOverview||!f.reportDrilldown||!f.settingsDirectory||!f.settingsAnchors||!f.scanner||!f.compactUploadButtons||!f.readableScanner||!f.trendsOnly||!f.noReportsFab||!f.settings||!f.noSettingsFab||!f.largeSetting.active||!f.largeSetting.selected||f.largeSetting.fontSize<16||f.largeHome.overflow>1||f.largeHome.textSize<16||!f.largeHome.navigation||!f.savedReadingMode||!f.largeScanner||f.errors.length);
  if(failed.length){console.error('WEBKIT_SAFARI_VISUAL_FAIL',JSON.stringify(failed));process.exitCode=1;}
  else console.log('WEBKIT_SAFARI_VISUAL_PASS: 4 phone sizes, essential home, icons, tabbar, scan, transactions, settings');
}catch(error){
  console.error('WEBKIT_SAFARI_AUDIT_ERROR',error);
  process.exitCode=1;
}finally{
  if(browser)await browser.close();
  server.kill('SIGTERM');
  demoServer?.kill('SIGTERM');
}

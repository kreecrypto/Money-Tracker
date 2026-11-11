import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const source=(file:string)=>readFileSync(join(process.cwd(),file),'utf8');
const home=source('src/HomeScreen.tsx');
const app=source('src/App.tsx');
const calendar=source('src/FinanceCalendar.tsx');
const calendarCss=source('src/finance-calendar.css');
const homeCss=source('src/home-screen.css');
const mobileCss=source('src/mobile-first.css');

describe('Home UI audit regressions',()=>{
  it('shows only calendar then the complete selected-day ledger on Home',()=>{
    const page=home.slice(home.indexOf('return <div className="home-dashboard mt-home-screen"'));
    expect(page.indexOf('<FinanceCalendar')).toBeLessThan(page.indexOf('className="mt-home-day-detail"'));
    for(const removed of ['mt-home-summary','mt-home-recent','mt-home-upload','{advisorySlot}','{reportSlot}']){
      expect(page).not.toContain(removed);
    }
    expect(home).toContain('daily.map(tx=>');
    expect(home).not.toContain('daily.slice(0,4)');
    expect(app).toContain("{view==='reports'&&<>");
    expect(app).toContain('<AccountingSecretary items={items}');
    expect(homeCss).toContain('.home-dashboard.mt-home-screen > *{order:0!important}');
  });
  it('shows the correct empty-state date context and does not duplicate selected-day transactions',()=>{
    expect(home).toContain('ไม่มีรายการที่บันทึกในวันที่เลือก');
    expect(home).not.toContain('วันนี้ยังไม่มีรายการที่บันทึกแล้ว');
    expect(home).toContain('recent.filter(item=>item.date===activeDate)');
    expect(home).not.toContain('recentOthers');
    expect(home).toContain('({daily.length} รายการ)');
    expect(app).toContain("view==='home'||(view==='transactions'&&!inboxTab&&!slipInboxTab)");
    expect(home).toContain('mt-home-desktop-upload');
  });
  it('uses a single month change control and retains full-value accessible calendar labels',()=>{
    expect(calendar).not.toContain('onMonthChange');
    expect(calendar).toContain('mt-calendar-month-label');
    expect(calendar).toContain('monthControl:ReactNode');
    expect(home).toContain('monthControl={<MonthChooser');
    expect(calendar).toContain('aria-label={description}');
    expect(calendar).toContain('baht(cell.incomeSatang)');
    expect(calendar).toContain('baht(cell.expenseSatang)');
  });
  it('supports distinct Today, arrow movement, the full-width calendar and honest empty detail',()=>{
    expect(calendar).toContain("aria-current={isToday?'date':undefined}");
    expect(calendar).toContain("cell.inCurrentMonth&&cell.date===today");
    expect(calendar).toContain('aria-controls="mt-home-selected-day-detail"');
    expect(calendar).toContain('onKeyDown={event=>');
    expect(calendar).toContain('keyboardCalendarDate(grid,cell.date,event.key)');
    expect(calendar).toContain('className="mt-calendar-viewport"');
    expect(calendar).not.toContain('mt-calendar-scroll-actions');
    expect(home).toContain('onToday={()=>');
    expect(home).toContain("selectedDate.startsWith(month+'-')?selectedDate:month+'-01'");
    expect(home).toContain('className="mt-home-empty" role="status"');
    expect(calendarCss).toContain('.mt-calendar-day.is-today');
    expect(calendarCss).not.toContain('text-overflow:clip');
  });
  it('keeps numeric income and expense visible in phone calendar cells',()=>{
    expect(calendar).not.toContain('mt-calendar-day-indicators');
    expect(calendar).toContain('mt-calendar-day-amounts');
    expect(calendar).toContain('+{compactCalendarBaht(cell.incomeSatang)}');
    expect(calendar).toContain('−{compactCalendarBaht(cell.expenseSatang)}');
    expect(calendarCss).toContain('.mt-calendar-day{min-height:74px');
    expect(calendarCss).toContain('.mt-calendar-day-amounts{display:flex');
    expect(calendarCss).toContain('grid-template-columns:repeat(7,minmax(0,1fr));gap:2px');
    expect(calendarCss).not.toContain('minmax(52px,1fr)');
    expect(calendarCss).toContain('.mt-calendar-viewport{width:100%;min-width:0}');
    expect(mobileCss).toContain('.slip-attention input,.slip-attention select{font-size:16px}');
  });
});

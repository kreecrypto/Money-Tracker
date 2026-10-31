import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const source=(file:string)=>readFileSync(join(process.cwd(),file),'utf8');
const home=source('src/HomeScreen.tsx');
const app=source('src/App.tsx');
const calendar=source('src/FinanceCalendar.tsx');
const calendarCss=source('src/finance-calendar.css');
const mobileCss=source('src/mobile-first.css');

describe('Home UI audit regressions',()=>{
  it('orders financial summary, next actions and upload before the calendar',()=>{
    const page=home.slice(home.indexOf('return <div className="home-dashboard mt-home-screen"'));
    const positions=[
      'className="summary-grid mt-home-summary"',
      '{advisorySlot}',
      'className="ref-home-upload',
      '{reportSlot}',
      '<FinanceCalendar',
      'className="mt-home-day-detail"',
      'className="surface transactions-surface mt-home-recent"'
    ].map(marker=>page.indexOf(marker));
    expect(positions.every(x=>x>=0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a,b)=>a-b));
    expect(app).toContain('advisorySlot={<div className="mt-home-below">');
  });
  it('shows the correct empty-state date context and does not duplicate selected-day transactions',()=>{
    expect(home).toContain('ไม่มีรายการที่บันทึกในวันที่เลือก');
    expect(home).not.toContain('วันนี้ยังไม่มีรายการที่บันทึกแล้ว');
    expect(home).toContain('recent.filter(item=>item.date!==activeDate)');
    expect(home).toContain('recentOthers.length>0&&<section');
    expect(home).toContain('recentOthers.slice(0,4)');
  });
  it('uses a single month change control and retains full-value accessible calendar labels',()=>{
    expect(calendar).not.toContain('onMonthChange');
    expect(calendar).toContain('mt-calendar-month-label');
    expect(calendar).toContain('aria-label={description}');
    expect(calendar).toContain('baht(cell.incomeSatang)');
    expect(calendar).toContain('baht(cell.expenseSatang)');
  });
  it('keeps mobile calendar selectable and avoids unreadable small financial labels',()=>{
    expect(calendar).toContain('mt-calendar-day-indicators');
    expect(calendarCss).toMatch(/@media\(max-width:660px\)\{[\s\S]*?\.mt-calendar-day\{min-height:48px/);
    expect(calendarCss).toContain('.mt-calendar-day-amounts{display:none}');
    expect(calendarCss).toContain('.mt-calendar-day-indicators{display:flex}');
    expect(mobileCss).toContain('.slip-attention input,.slip-attention select{font-size:16px}');
  });
});

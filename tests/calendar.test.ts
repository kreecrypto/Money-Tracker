import {describe,expect,it} from 'vitest';
import {calendarMonthGrid,compactCalendarBaht} from '../src/lib/calendar';
import type {Transaction} from '../src/lib/finance';

const tx=(id:string,date:string,type:'income'|'expense',amountSatang:number):Transaction=>({
  id,date,type,amountSatang,category:type==='income'?'เงินเดือน':'อาหารและเครื่องดื่ม',
  note:'ทดสอบ',method:'bank',createdAt:0
});

describe('calendar-first finance view',()=>{
  it('sums saved income and expense separately with integer satang, without counting other months',()=>{
    const days=calendarMonthGrid('2026-10',[
      tx('1','2026-10-15','income',125025),
      tx('2','2026-10-15','expense',45050),
      tx('3','2026-10-15','expense',1200),
      tx('4','2026-09-15','income',999999)
    ]);
    const day=days.find(x=>x.date==='2026-10-15');
    expect(day).toMatchObject({incomeSatang:125025,expenseSatang:46250,count:3});
    expect(days.filter(x=>x.inCurrentMonth).length).toBe(31);
    expect(days.filter(x=>x.inCurrentMonth).reduce((total,x)=>total+x.incomeSatang,0)).toBe(125025);
    expect(days.filter(x=>x.inCurrentMonth).reduce((total,x)=>total+x.expenseSatang,0)).toBe(46250);
    expect(days.every(x=>!x.inCurrentMonth||x.date.startsWith('2026-10-'))).toBe(true);
  });
  it('renders week-aligned 35/42 day calendar including leap year February',()=>{
    const october=calendarMonthGrid('2026-10',[]);
    expect(october.length).toBe(35);
    expect(october[4].date).toBe('2026-10-01');
    expect(calendarMonthGrid('2028-02',[]).filter(x=>x.inCurrentMonth)).toHaveLength(29);
    expect(calendarMonthGrid('2028-02',[]).length%7).toBe(0);
  });
  it('keeps compact labels separate from full-precision satang totals',()=>{
    expect(compactCalendarBaht(125000)).toBe('1.3k');
    expect(compactCalendarBaht(45050)).toBe('450.5');
    expect(calendarMonthGrid('invalid',[])).toEqual([]);
  });
});

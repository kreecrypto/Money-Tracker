import {describe,expect,it} from 'vitest';
import {dailyTotals,groupTransactionsByDay,dateSectionLabel} from '../src/lib/spendingInsights';
import type {Transaction} from '../src/lib/finance';

const transaction=(id:string,date:string,type:'income'|'expense',amountSatang:number,time?:string):Transaction=>({
  id,date,type,amountSatang,time,category:type==='income'?'เงินเดือน':'อาหารและเครื่องดื่ม',
  note:'',method:'bank',createdAt:Date.parse(date+'T12:00:00')+(time?Number(time.slice(0,2))*60:0),
});

describe('scan-first finance summary and grouped transactions',()=>{
  const entries=[
    transaction('today-expense','2026-10-14','expense',12345,'10:20'),
    transaction('today-income','2026-10-14','income',200000,'09:30'),
    transaction('yesterday-expense','2026-10-13','expense',7950,'23:00'),
    transaction('second-today-expense','2026-10-14','expense',100,'08:15'),
  ];
  it('calculates daily income and expenses in satang without counting other dates',()=>{
    expect(dailyTotals(entries,'2026-10-14')).toEqual({count:3,income:200000,expense:12445});
    expect(dailyTotals(entries,'2026-10-13')).toEqual({count:1,income:0,expense:7950});
    expect(dailyTotals(entries,'2026-10-12')).toEqual({count:0,income:0,expense:0});
  });
  it('shows newest day and time first without mutating the stored order',()=>{
    const before=entries.map(x=>x.id);
    const groups=groupTransactionsByDay(entries);
    expect(groups.map(g=>g.date)).toEqual(['2026-10-14','2026-10-13']);
    expect(groups[0].items.map(x=>x.id)).toEqual(['today-expense','today-income','second-today-expense']);
    expect(groups[1].items.map(x=>x.id)).toEqual(['yesterday-expense']);
    expect(entries.map(x=>x.id)).toEqual(before);
  });
  it('formats today, yesterday and previous days with explicit labels',()=>{
    const formatter=(s:string)=>'วันที่ '+s;
    expect(dateSectionLabel('2026-10-14','2026-10-14','2026-10-13',formatter)).toBe('วันนี้');
    expect(dateSectionLabel('2026-10-13','2026-10-14','2026-10-13',formatter)).toBe('เมื่อวาน');
    expect(dateSectionLabel('2026-10-12','2026-10-14','2026-10-13',formatter)).toBe('วันที่ 2026-10-12');
  });
});

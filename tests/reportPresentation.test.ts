import {describe,it,expect} from 'vitest';
import {savedExpenseSubtype,groupedExpenseSubtypes,reportDailyCashOut,reportShortMonthYear} from '../src/lib/reportPresentation';
import type {Transaction} from '../src/lib/finance';

const tx=(id:string,category:string,amountSatang:number,note:string,type:'expense'|'income'='expense'):Transaction=>({
  id,category,amountSatang,note,type,date:'2026-11-03',method:'bank',createdAt:1
});

describe('Reports presentation with financial safety',()=>{
  it('uses explicit subtype only and does not guess from merchant words',()=>{
    expect(savedExpenseSubtype('หมวดย่อย: กาแฟ\nลาเต้')).toBe('กาแฟ');
    expect(savedExpenseSubtype('ค่ายอด | หมวดย่อย: เติมน้ำมัน')).toBe('เติมน้ำมัน');
    expect(savedExpenseSubtype('กาแฟที่ร้านดัง')).toBe('ยังไม่ระบุประเภทย่อย');
  });
  it('reconciles subcategories in exact integer satang without counting incoming or other categories',()=>{
    const data=[
      tx('food','อาหารและเครื่องดื่ม',19901,'หมวดย่อย: อาหาร\nข้าว'),
      tx('coffee','อาหารและเครื่องดื่ม',8500,'หมวดย่อย: กาแฟ'),
      tx('coffee2','อาหารและเครื่องดื่ม',7055,'หมวดย่อย: กาแฟ'),
      tx('uncertain','อาหารและเครื่องดื่ม',505,''),
      tx('income','อาหารและเครื่องดื่ม',900000,'หมวดย่อย: กาแฟ','income'),
      tx('fuel','เดินทาง',32050,'หมวดย่อย: เติมน้ำมัน'),
    ];
    const grouped=groupedExpenseSubtypes(data,'อาหารและเครื่องดื่ม');
    expect(grouped.map(g=>[g.name,g.amountSatang,g.items.length])).toEqual([
      ['อาหาร',19901,1],['กาแฟ',15555,2],['ยังไม่ระบุประเภทย่อย',505,1]
    ]);
    expect(grouped.reduce((sum,g)=>sum+g.amountSatang,0)).toBe(35961);
    expect(grouped.every(g=>Number.isSafeInteger(g.amountSatang))).toBe(true);
    expect(grouped.flatMap(g=>g.items).map(t=>t.id).sort()).toEqual(['coffee','coffee2','food','uncertain']);
  });
  it('labels daily averages according to the period, not always days elapsed',()=>{
    expect(reportDailyCashOut(310000,'2026-10','2026-11-03')).toEqual({amountSatang:10000,label:'เงินออกเฉลี่ยต่อวัน (ทั้งเดือน)'});
    expect(reportDailyCashOut(30000,'2026-11','2026-11-03')).toEqual({amountSatang:10000,label:'เงินออกเฉลี่ยต่อวัน (ถึงวันนี้)'});
    expect(reportDailyCashOut(0,'2026-12','2026-11-03').amountSatang).toBe(0);
  });
  it('disambiguates the year in cross-year six-month trends',()=>{
    const dec=reportShortMonthYear('2025-12');
    const jan=reportShortMonthYear('2026-01');
    expect(dec).toMatch(/68/);
    expect(jan).toMatch(/69/);
    expect(dec).not.toBe(jan);
  });
});

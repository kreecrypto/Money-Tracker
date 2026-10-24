import {describe,expect,it} from 'vitest';
import type {Transaction} from '../src/lib/finance';
import {secretaryAnswer} from '../src/lib/accountingSecretary';

const tx=(id:string,date:string,type:'income'|'expense',amountSatang:number,category?:string):Transaction=>({
  id,date,type,amountSatang,category:category||(type==='income'?'เงินเดือน':'อาหารและเครื่องดื่ม'),
  method:'bank',note:'',createdAt:1,
});
const data:Transaction[]=[
  tx('income','2026-10-24','income',250000),
  tx('coffee','2026-10-24','expense',12550),
  tx('food','2026-10-23','expense',29900),
  tx('travel','2026-10-24','expense',5700,'เดินทาง'),
  tx('other-month','2026-09-30','expense',999900,'เดินทาง'),
];

describe('read-only accounting secretary',()=>{
  it('answers today from the exact local date without counting yesterday',()=>{
    const result=secretaryAnswer('today',data,'2026-10','2026-10-24',0,null);
    expect(result.detail).toContain('3 รายการ');
    expect(result.detail).toContain('2,500.00');
    expect(result.detail).toContain('182.50');
    expect(result.detail).not.toContain('299.00');
    expect(result.source).toContain('ไม่ใช่ยอดคงเหลือในธนาคาร');
  });
  it('reports selected month, not a different month or bank balance',()=>{
    const result=secretaryAnswer('month',data,'2026-10','2026-10-24',0,null);
    expect(result.detail).toContain('4 รายการ');
    expect(result.detail).toContain('481.50');
    expect(result.detail).not.toContain('9,999.00');
  });
  it('uses the real highest expense category in the selected month',()=>{
    const result=secretaryAnswer('category',data,'2026-10','2026-10-24',0,null);
    expect(result.detail).toContain('อาหารและเครื่องดื่ม');
    expect(result.detail).toContain('424.50');
  });
  it('does not fabricate amounts or categories when there are no saved records',()=>{
    const empty=secretaryAnswer('today',[],'2026-10','2026-10-24',0,null);
    const noExpenses=secretaryAnswer('category',[tx('only-income','2026-10-24','income',100)],'2026-10','2026-10-24',0,null);
    expect(empty.detail).toContain('ยังไม่มีรายการ');
    expect(noExpenses.detail).toContain('ยังไม่มีรายจ่าย');
  });
  it('keeps local and iPhone pending separate and treats unknown iPhone count as unknown',()=>{
    const unknown=secretaryAnswer('pending',data,'2026-10','2026-10-24',2,null);
    expect(unknown.detail).toContain('สลิปรอตรวจในเครื่อง 2 รายการ');
    expect(unknown.detail).toContain('ยังไม่มีข้อมูลจำนวนรายการรอตรวจจาก iPhone');
    const known=secretaryAnswer('pending',data,'2026-10','2026-10-24',1,3);
    expect(known.detail).toContain('รายการรอตรวจจาก iPhone 3 รายการ');
    expect(known.detail).toContain('ยังไม่รวมรายการรอตรวจ');
  });
  it('does not change transaction data',()=>{
    const before=JSON.stringify(data);
    secretaryAnswer('month',data,'2026-10','2026-10-24',0,0);
    expect(JSON.stringify(data)).toBe(before);
  });
});

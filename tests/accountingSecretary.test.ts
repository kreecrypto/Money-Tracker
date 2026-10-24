import {describe,expect,it} from 'vitest';
import type {Transaction} from '../src/lib/finance';
import {secretaryAnswer,secretaryBriefing} from '../src/lib/accountingSecretary';

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

describe('accounting secretary answers (read-only)',()=>{
  it('calculates a precise today summary and signed satang amounts without yesterday',()=>{
    const result=secretaryAnswer('today',data,'2026-09','2026-10-24',0,null);
    expect(result.detail).toContain('3 รายการ');
    expect(result.metrics).toEqual([
      {label:'รายรับ',value:'+฿2,500.00',kind:'income'},
      {label:'รายจ่าย',value:'−฿182.50',kind:'expense'},
      {label:'สุทธิจากรายการ',value:'+฿2,317.50',kind:'net'},
    ]);
    expect(result.source).toContain('ไม่ใช่ยอดเงินคงเหลือในธนาคาร');
  });
  it('reports the selected month including income minus expense, never another month',()=>{
    const result=secretaryAnswer('month',data,'2026-10','2026-10-24',0,null);
    expect(result.detail).toContain('4 รายการ');
    expect(result.metrics.find(x=>x.label==='รายจ่าย')?.value).toBe('−฿481.50');
    expect(result.metrics.find(x=>x.label==='สุทธิจากรายการ')?.value).toBe('+฿2,018.50');
    expect(result.metrics.some(x=>x.value.includes('9,999'))).toBe(false);
  });
  it('uses saved expense category and real share of the chosen month',()=>{
    const result=secretaryAnswer('category',data,'2026-10','2026-10-24',0,null);
    expect(result.detail).toContain('อาหารและเครื่องดื่ม');
    expect(result.metrics).toEqual([
      {label:'รายจ่ายของหมวด',value:'฿424.50',kind:'expense'},
      {label:'สัดส่วนของรายจ่าย',value:'88%'},
    ]);
    expect(secretaryAnswer('category',data,'2026-09','2026-10-24',0,null).detail).toContain('เดินทาง');
  });
  it('does not invent figures in empty or income-only months',()=>{
    const empty=secretaryAnswer('today',[],'2026-10','2026-10-24',0,null);
    const noExpenses=secretaryAnswer('category',[tx('only-income','2026-10-24','income',100)],'2026-10','2026-10-24',0,null);
    expect(empty.detail).toContain('ยังไม่มีรายการ');
    expect(empty.metrics).toEqual([]);
    expect(noExpenses.detail).toContain('ยังไม่มีรายจ่าย');
    expect(noExpenses.metrics).toEqual([]);
  });
  it('keeps local Pending and iPhone Pending separate, never substituting zero for unknown',()=>{
    const unknown=secretaryAnswer('pending',data,'2026-10','2026-10-24',2,null);
    expect(unknown.metrics).toEqual([
      {label:'สลิปรอตรวจในเครื่อง',value:'2 รายการ'},
      {label:'รายการรอตรวจจาก iPhone',value:'ยังไม่มีข้อมูล'},
    ]);
    expect(secretaryAnswer('pending',data,'2026-10','2026-10-24',1,3).metrics[1].value).toBe('3 รายการ');
    expect(unknown.detail).toContain('ไม่รวมในยอดรายรับ–รายจ่าย');
  });
  it('prioritizes real review work and never counts Pending in recorded totals',()=>{
    const brief=secretaryBriefing(data,'2026-10-24',2,3);
    expect(brief.needsReview).toBe(true);
    expect(brief.title).toContain('5 รายการ');
    expect(secretaryAnswer('month',data,'2026-10','2026-10-24',2,3).metrics[1].value).toBe('−฿481.50');
  });
  it('describes actual saved daily activity, otherwise shows an honest empty prompt',()=>{
    expect(secretaryBriefing(data,'2026-10-24',0,null).title).toContain('3 รายการ');
    expect(secretaryBriefing(data,'2026-10-24',0,null).detail).toContain('฿182.50');
    expect(secretaryBriefing(data,'2026-10-25',0,0).title).toContain('ยังไม่มีรายการ');
    expect(secretaryBriefing([],'2026-10-25',0,null).title).toContain('เริ่มจดบัญชี');
  });
  it('never mutates saved transactions',()=>{
    const before=JSON.stringify(data);
    for(const question of ['today','month','category','pending'] as const){
      secretaryAnswer(question,data,'2026-10','2026-10-24',1,null);
    }
    secretaryBriefing(data,'2026-10-24',0,0);
    expect(JSON.stringify(data)).toBe(before);
  });
});

import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import ReportExpenseDetails,{matchingExpenseCategories} from '../src/ReportExpenseDetails';
import {expenseByCategory,summarize,type Transaction} from '../src/lib/finance';

const tx=(id:string,type:Transaction['type'],category:string,amountSatang:number,note:string,receipt?:Transaction['receipt']):Transaction=>({
  id,type,category,amountSatang,note,method:'bank',date:'2026-11-01',time:'12:30',createdAt:1,
  recipient:'ร้านตัวอย่าง',receipt
});

describe('Report expenses by category',()=>{
  const items=[
    tx('a','expense','อาหารและเครื่องดื่ม',18500,'หมวดย่อย: อาหาร\nข้าวกลางวัน',{
      source:'generic',items:[{name:'ข้าวผัด',quantity:1,lineTotalSatang:18500}],paidSatang:18500,itemsComplete:true
    }),
    tx('b','expense','อาหารและเครื่องดื่ม',6900,'หมวดย่อย: กาแฟ\nลาเต้'),
    tx('c','expense','อื่น ๆ',150000,'เติมเงิน Wallet'),
    tx('d','expense','ผ่อนชำระ/หนี้',300000,'จ่ายบัตรเครดิต'),
    tx('e','income','เงินเดือน',3000000,'เงินเดือน'),
    tx('f','income','อาหารและเครื่องดื่ม',999900,'ทดสอบไม่ควรนับเป็นค่าใช้จ่าย')
  ];
  it('shows every saved expense, excludes income, and preserves exact satang totals',()=>{
    const categories=expenseByCategory(items);
    expect(categories.reduce((sum,x)=>sum+x.total,0)).toBe(summarize(items).expense);
    expect(categories.find(x=>x.name==='อาหารและเครื่องดื่ม')?.total).toBe(25400);
    const html=renderToStaticMarkup(createElement(ReportExpenseDetails,{items,categories}));
    for(const term of ['ข้าวกลางวัน','กาแฟ','ลาเต้','ข้าวผัด','อาหาร','ยังไม่ระบุประเภทย่อย','เติม Wallet: เป็นเงินออก','ชำระหนี้: ยังไม่ได้แยก','รายการในใบเสร็จไม่ถูกบวกซ้ำ'])expect(html).toContain(term);
    expect(html).not.toContain('ทดสอบไม่ควรนับเป็นค่าใช้จ่าย');
    expect((html.match(/class="report-category-expense-row"/g)||[]).length).toBe(4);
    expect((html.match(/class="report-category-subgroup"/g)||[]).length).toBe(4);
    expect(html).toContain('฿69.00');
  });
  it('searches saved Thai payees and explicit subtypes without counting incoming money',()=>{
    const categories=expenseByCategory(items);
    const all=matchingExpenseCategories(items,categories,'');
    expect(all.reduce((sum,match)=>sum+match.total,0)).toBe(summarize(items).expense);
    const byName=matchingExpenseCategories(items,categories,'อาหารและเครื่องดื่ม');
    expect(byName).toHaveLength(1);
    expect(byName[0].partial).toBe(false);
    expect(byName[0].total).toBe(25400);
    const bySubtype=matchingExpenseCategories(items,categories,'กาแฟ');
    expect(bySubtype).toHaveLength(1);
    expect(bySubtype[0].partial).toBe(true);
    expect(bySubtype[0].entries.map(item=>item.id)).toEqual(['b']);
    expect(bySubtype[0].total).toBe(6900);
    expect(matchingExpenseCategories(items,categories,'ทดสอบไม่ควรนับเป็นค่าใช้จ่าย')).toEqual([]);
    expect(matchingExpenseCategories(items,categories,'ไม่มีรายการนี้')).toEqual([]);
  });
  it('offers a labelled search without changing the source transaction rows',()=>{
    const categories=expenseByCategory(items);
    const html=renderToStaticMarkup(createElement(ReportExpenseDetails,{items,categories}));
    expect(html).toContain('aria-label="ค้นหาหมวดหรือรายการเงินออก"');
    expect(html).toContain('report-category-progress');
    expect(html).toContain('4 รายการเงินออก');
    expect(html).not.toContain('ข้อมูลตัวอย่าง');
  });
  it('shows no invented expenses when data is empty',()=>{
    const html=renderToStaticMarkup(createElement(ReportExpenseDetails,{items:[],categories:[]}));
    expect(html).not.toContain('report-category-expense-row');
  });
});

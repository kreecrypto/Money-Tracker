import {describe,expect,it} from 'vitest';
import {accountantAudit,accountantBucketFor} from '../src/lib/accountantAudit';
import type {Transaction} from '../src/lib/finance';

const record=(id:string,amountSatang:number,category:string,note='',type:'income'|'expense'='expense',
  recipient='ร้านทดสอบ',time='12:00'):Transaction=>({
  id,date:'2026-10-25',time,amountSatang,category,note,type,recipient,method:'bank',createdAt:1
});
describe('Accountant read-only cash movement review',()=>{
  it('separates debt, wallet top-ups, unidentified and categorized cash out exactly in satang',()=>{
    const transactions=[
      record('debt',20001,'ผ่อนชำระ/หนี้','หมวดย่อย: ชำระบัตรเครดิต'),
      record('topup',1050,'อื่น ๆ','เติมเงิน K PLUS (Gmail) | หมวดย่อย: เติมเงิน e-Wallet/มือถือ'),
      record('person',2505,'อื่น ๆ','หมวดย่อย: โอนให้บุคคล/วัตถุประสงค์ไม่ระบุ'),
      record('food',990,'อาหารและเครื่องดื่ม','หมวดย่อย: อาหาร/ร้านอาหาร'),
      record('fine',100,'อื่น ๆ','หมวดย่อย: ค่าปรับ'),
      record('income',50000,'เงินเดือน','','income'),
    ];
    const before=JSON.stringify(transactions);
    const r=accountantAudit(transactions);
    expect(r.income).toEqual({amountSatang:50000,count:1});
    expect(r.outflow).toEqual({amountSatang:24646,count:5});
    expect(r.debtPayments).toEqual({amountSatang:20001,count:1});
    expect(r.walletTopups).toEqual({amountSatang:1050,count:1});
    expect(r.needsClassification).toEqual({amountSatang:2505,count:1});
    expect(r.otherCategorized).toEqual({amountSatang:1090,count:2});
    expect(r.debtPayments.amountSatang+r.walletTopups.amountSatang+
      r.needsClassification.amountSatang+r.otherCategorized.amountSatang).toBe(r.outflow.amountSatang);
    expect(JSON.stringify(transactions)).toBe(before);
  });
  it('does not infer top-ups solely from recipient name or a generic note',()=>{
    const r=accountantAudit([record('wallet',1200,'อื่น ๆ','ร้านทรูมันนี่')]);
    expect(r.walletTopups.count).toBe(0);
    expect(r.needsClassification.amountSatang).toBe(1200);
  });
  it('flags only comparable close-time entries without automatically deleting them',()=>{
    const inputs=[
      record('a',20000000,'อื่น ๆ','','expense','ร้าน ก','11:02'),
      record('b',20000000,'อื่น ๆ','','expense','ร้าน ก','11:03'),
      record('c',20000000,'อื่น ๆ','','expense','ร้าน ข','11:03'),
      record('d',20000000,'อื่น ๆ','','expense','ร้าน ก','11:20'),
      record('e',20000000,'อื่น ๆ','','expense','','11:03'),
    ];
    const r=accountantAudit(inputs);
    expect(r.possibleDuplicatePairs).toBe(1);
    expect(r.outflow.count).toBe(5);
  });
  it('uses the same deterministic group for the report and the transaction drill-down',()=>{
    const items=[
      record('debt',1100,'ผ่อนชำระ/หนี้','ชำระบัตรเครดิต'),
      record('wallet',2200,'อื่น ๆ','หมวดย่อย: เติมเงิน e-Wallet/มือถือ'),
      record('unknown',3300,'อื่น ๆ','โอนโดยไม่ทราบประเภท'),
      record('known',4400,'สุขภาพ',''),
      record('fine',50,'อื่น ๆ','หมวดย่อย: ค่าปรับ'),
      record('income',9900,'เงินเดือน','','income'),
    ];
    const summary=accountantAudit(items);
    for(const key of ['debtPayments','walletTopups','needsClassification','otherCategorized'] as const){
      const matches=items.filter(item=>accountantBucketFor(item)===key);
      expect(matches.reduce((sum,item)=>sum+item.amountSatang,0)).toBe(summary[key].amountSatang);
      expect(matches.length).toBe(summary[key].count);
    }
    expect(accountantBucketFor(items[5])).toBeNull();
    expect(summary.outflow.amountSatang).toBe(11050);
  });
  it('does not silently treat a saved unlabeled transfer as a categorized expense',()=>{
    const unknown=record('u',30000,'อื่น ๆ','ธนาคารโอนเงิน', 'expense','บัญชีส่วนบุคคล');
    expect(accountantBucketFor(unknown)).toBe('needsClassification');
  });
  it('works for empty and incoming-only months without inventing a bank balance',()=>{
    expect(accountantAudit([])).toEqual({
      income:{amountSatang:0,count:0},outflow:{amountSatang:0,count:0},
      debtPayments:{amountSatang:0,count:0},walletTopups:{amountSatang:0,count:0},
      needsClassification:{amountSatang:0,count:0},otherCategorized:{amountSatang:0,count:0},
      possibleDuplicatePairs:0
    });
    expect(accountantAudit([record('i',555,'เงินเดือน','','income')]).outflow.count).toBe(0);
  });
});

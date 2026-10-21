import {describe,expect,it} from 'vitest';
import {matchesTransactionSearch} from '../src/lib/transactionSearch';
import type {Transaction} from '../src/lib/finance';

const income:Transaction={
  id:'income-1',type:'income',amountSatang:125000,date:'2026-10-18',time:'10:30',
  category:'เงินคืน',note:'',sender:'บริษัท ตัวอย่าง จำกัด',recipient:'นาย ผู้รับ',
  method:'bank',createdAt:1,
};

describe('transaction search matches human-visible information',()=>{
  it('finds incoming transfers by sender instead of only the stored payee',()=>{
    expect(matchesTransactionSearch(income,'บริษัท ตัวอย่าง')).toBe(true);
    expect(matchesTransactionSearch(income,'นาย ผู้รับ')).toBe(true);
  });
  it('matches an expense recipient and category',()=>{
    const expense={...income,id:'expense-1',type:'expense' as const,sender:undefined,
      recipient:'ร้านกาแฟ',category:'อาหารและเครื่องดื่ม'};
    expect(matchesTransactionSearch(expense,'ร้านกาแฟ')).toBe(true);
    expect(matchesTransactionSearch(expense,'อาหาร')).toBe(true);
    expect(matchesTransactionSearch(expense,'ไม่มีอยู่จริง')).toBe(false);
  });
  it('preserves blank queries, dates and receipt-item lookup',()=>{
    expect(matchesTransactionSearch(income,'   ')).toBe(true);
    expect(matchesTransactionSearch(income,'10:30')).toBe(true);
    const receipt={...income,receipt:{source:'seven_eleven' as const,
      items:[{name:'นมจืด',quantity:1,lineTotalSatang:2000}],paidSatang:2000,itemsComplete:true}};
    expect(matchesTransactionSearch(receipt,'นมจืด')).toBe(true);
  });
});

import {describe,it,expect} from 'vitest';
import {toSatang,summarize,monthly,expenseByCategory,lastMonths,isValidTransaction,transactionDisplayName,type Transaction} from '../src/lib/finance';
import {toCsv,createBackup,parseBackup} from '../src/lib/backup';
const e:Transaction={id:'a',type:'expense',amountSatang:12550,category:'อาหารและเครื่องดื่ม',note:'ข้าว',date:'2026-10-10',method:'cash',createdAt:1};
const i:Transaction={...e,id:'b',type:'income',category:'เงินเดือน',amountSatang:2500000};
describe('finance math',()=>{
 it('parses satang exactly',()=>{expect(toSatang('1,234.50')).toBe(123450);expect(toSatang('0.01')).toBe(1);expect(toSatang('1.999')).toBe(null);expect(toSatang('0')).toBe(null);expect(toSatang('-3')).toBe(null);});
 it('sums income and expenses',()=>expect(summarize([e,i])).toEqual({income:2500000,expense:12550,net:2487450}));
 it('filters by month',()=>expect(monthly([e,{...i,date:'2026-09-10'}],'2026-10')).toHaveLength(1));
 it('sorts categories',()=>expect(expenseByCategory([e,{...e,id:'c',category:'เดินทาง',amountSatang:30000}])[0].name).toBe('เดินทาง'));
 it('handles year rollover',()=>expect(lastMonths(3,new Date(2026,0,5)).map(x=>x.key)).toEqual(['2025-11','2025-12','2026-01']));
 it('displays the payer for incoming transactions and retains the printed payee',()=>{
   const transfer={...i,sender:'ผู้โอนเงิน',recipient:'ผู้รับเงิน'};
   expect(transactionDisplayName(transfer)).toBe('ผู้โอนเงิน');
   expect(transactionDisplayName({...transfer,type:'expense'})).toBe('ผู้รับเงิน');
   expect(transactionDisplayName({...i,sender:undefined,recipient:undefined,note:'รับเงิน'})).toBe('รับเงิน');
 });
});
describe('backup',()=>{
 it('roundtrips',()=>expect(parseBackup(createBackup([e],{monthlyBudgetSatang:20000})).transactions).toEqual([e]));
 it('roundtrips four extracted K PLUS fields without changing legacy backups',()=>{
   const receipt={...e,id:'receipt-1',date:'2026-10-12',time:'13:15',amountSatang:294800,recipient:'SYNPHAET BANGNA CO.,LTD.',method:'bank' as const};
   const restored=parseBackup(createBackup([receipt,e],{monthlyBudgetSatang:20000})).transactions;
   expect(restored).toEqual([receipt,e]);
   expect(toCsv([receipt])).toContain('"13:15"');
   expect(toCsv([receipt])).toContain('"SYNPHAET BANGNA CO.,LTD."');
   expect(isValidTransaction(e)).toBe(true);
 });
 it('rejects malformed clock time and payee payloads',()=>{
   expect(isValidTransaction({...e,time:'25:99'})).toBe(false);
   expect(isValidTransaction({...e,recipient:12})).toBe(false);
   expect(isValidTransaction({...e,recipient:'x'.repeat(161)})).toBe(false);
 });
 it('rejects invalid transaction',()=>expect(isValidTransaction({...e,amountSatang:-10})).toBe(false));
 it('rejects duplicated ids',()=>expect(()=>parseBackup(createBackup([e,e],{monthlyBudgetSatang:0}))).toThrow());
 it('guards spreadsheet formulas',()=>expect(toCsv([{...e,note:'=HYPERLINK("bad")'}])).toContain("'=HYPERLINK"));
});

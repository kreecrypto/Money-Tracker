import {describe,it,expect} from 'vitest';
import {toSatang,summarize,monthly,expenseByCategory,lastMonths,isValidTransaction,type Transaction} from '../src/lib/finance';
import {toCsv,createBackup,parseBackup} from '../src/lib/backup';
const e:Transaction={id:'a',type:'expense',amountSatang:12550,category:'อาหารและเครื่องดื่ม',note:'ข้าว',date:'2026-10-10',method:'cash',createdAt:1};
const i:Transaction={...e,id:'b',type:'income',category:'เงินเดือน',amountSatang:2500000};
describe('finance math',()=>{
 it('parses satang exactly',()=>{expect(toSatang('1,234.50')).toBe(123450);expect(toSatang('0.01')).toBe(1);expect(toSatang('1.999')).toBe(null);expect(toSatang('0')).toBe(null);expect(toSatang('-3')).toBe(null);});
 it('sums income and expenses',()=>expect(summarize([e,i])).toEqual({income:2500000,expense:12550,net:2487450}));
 it('filters by month',()=>expect(monthly([e,{...i,date:'2026-09-10'}],'2026-10')).toHaveLength(1));
 it('sorts categories',()=>expect(expenseByCategory([e,{...e,id:'c',category:'เดินทาง',amountSatang:30000}])[0].name).toBe('เดินทาง'));
 it('handles year rollover',()=>expect(lastMonths(3,new Date(2026,0,5)).map(x=>x.key)).toEqual(['2025-11','2025-12','2026-01']));
});
describe('backup',()=>{
 it('roundtrips',()=>expect(parseBackup(createBackup([e],{monthlyBudgetSatang:20000})).transactions).toEqual([e]));
 it('rejects invalid transaction',()=>expect(isValidTransaction({...e,amountSatang:-10})).toBe(false));
 it('rejects duplicated ids',()=>expect(()=>parseBackup(createBackup([e,e],{monthlyBudgetSatang:0}))).toThrow());
 it('guards spreadsheet formulas',()=>expect(toCsv([{...e,note:'=HYPERLINK("bad")'}])).toContain("'=HYPERLINK"));
});

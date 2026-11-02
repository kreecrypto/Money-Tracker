import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
import {matchesTransactionSearch,type Transaction} from '../src/lib/finance';

const sample:Transaction={
  id:'test-1',type:'income',amountSatang:12500,category:'งานเสริม',
  note:'รายรับเดือนนี้',sender:'คุณมะลิ',recipient:'บัญชีตัวเอง',
  date:'2026-11-01',time:'09:30',method:'bank',createdAt:1,
  receipt:{source:'generic',receiptId:'INV-123',storeName:'ร้านตัวอย่าง',items:[{name:'กาแฟ',quantity:1,lineTotalSatang:12500}],paidSatang:12500,itemsComplete:true}
};
const source=(file:string)=>readFileSync(join(process.cwd(),file),'utf8');

describe('Transactions monthly ledger UX regressions',()=>{
  it('searches both displayed incoming sender and recipient, keeping existing metadata search',()=>{
    for(const term of ['คุณมะลิ','บัญชีตัวเอง','งานเสริม','เดือนนี้','09:30','INV-123','กาแฟ','ธนาคาร','  คุณมะลิ  ']){
      expect(matchesTransactionSearch(sample,term)).toBe(true);
    }
    expect(matchesTransactionSearch(sample,'ไม่มีชื่อ')).toBe(false);
    expect(matchesTransactionSearch(sample,'  ')).toBe(true);
    expect(matchesTransactionSearch({...sample,type:'expense'},'คุณมะลิ')).toBe(true);
  });

  it('uses selected month, clears all empty filters and avoids duplicate past-day headings',()=>{
    const app=source('src/App.tsx');
    expect(app).toContain('<summary>สรุปยอดรายรับ–รายจ่าย {monthText(month)}</summary>');
    expect(app).toContain("add={selected.length===0?openAdd:()=>{setSearch('');setFilter('all');setReviewBucket(null);}}");
    expect(app).toContain('label===formatted?formatted:');
  });

  it('reuses Home transaction details with keyboard-friendly main action and independent edit/delete',()=>{
    const app=source('src/App.tsx');
    const home=source('src/HomeScreen.tsx');
    const css=source('src/cute-kawaii-preview.css');
    expect(home).toContain('export function TransactionDetail');
    expect(app).toContain('className="transaction-open"');
    expect(app).toContain('{detail&&<TransactionDetail value={entry}');
    expect(app).toContain('className="mobile-row-actions"');
    expect(app).toContain('onEdit(entry)');
    expect(app).toContain('onDelete(entry)');
    expect(css).toContain('.transaction-page .transaction-open:focus-visible');
    expect(css).toContain('background:transparent;border:0;border-radius:0;padding-inline:0;');
  });
});

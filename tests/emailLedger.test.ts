import {describe,it,expect} from 'vitest';
import {csvRows,parseEmailLedgerCsv,partitionEmailLedger,isLikelyEmailDuplicate,emailLedgerEvidence,emailLedgerCategory,emailLedgerExplanation} from '../src/lib/emailLedger';
import type {Transaction} from '../src/lib/finance';

const headers=['วันที่','เวลา','ประเภทธุรกรรม','ผู้รับเงิน/ร้านค้า','รายละเอียดชี้แจง','หมวดหมู่','จำนวนเงิน','ค่าธรรมเนียม','สถานะ','รวมรายจ่าย','เลขอ้างอิง','Gmail URL'];
const record=(row:string[])=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',');
const makeCsv=(entries:string[][])=>'\uFEFF'+[record(headers),...entries.map(record)].join('\r\n');
const entry=(overrides:Partial<Record<number,string>>={})=>{
  const row=['2026-10-25','13:34','จ่าย QR','ร้านทดสอบ','ซื้อกาแฟ, เครื่องดื่ม','อาหาร/เครื่องดื่ม','125.50','0.00','ยืนยันรายจ่าย','125.50','TEST202610250001','https://mail.google.com/mail/u/0/#all/abc123'];
  for(const [k,v] of Object.entries(overrides))if(v!==undefined)row[Number(k)]=v;
  return row;
};

describe('private email ledger import',()=>{
  it('parses quoted comma, CRLF and multiline CSV cells',()=>{
    expect(csvRows('a,b\r\n"x,y","one\ntwo"')).toEqual([['a','b'],['x,y','one\ntwo']]);
    expect(csvRows('"quote ""inside""",last')).toEqual([['quote "inside"','last']]);
  });
  it('imports only confirmed expenses, keeps original category and evidence',()=>{
    const excluded=entry({8:'หลักฐานประกอบ',10:'DOCREF000001',9:'0'});
    const result=parseEmailLedgerCsv(makeCsv([entry(),excluded]),1234);
    expect(result.confirmed).toHaveLength(1);
    expect(result.excluded).toHaveLength(1);
    const t=result.confirmed[0];
    expect(t.id).toBe('email-TEST202610250001');
    expect(t.amountSatang).toBe(12550);
    expect(t.type).toBe('expense');
    expect(t.category).toBe('อาหารและเครื่องดื่ม');
    expect(t.createdAt).toBe(1235);
    expect(emailLedgerCategory(t)).toBe('อาหาร/เครื่องดื่ม');
    expect(emailLedgerEvidence(t.note)).toBe('https://mail.google.com/mail/u/0/#all/abc123');
    expect(emailLedgerExplanation(t)).toContain('ซื้อกาแฟ, เครื่องดื่ม');
    expect(emailLedgerExplanation(t)).not.toContain('Gmail:');
  });
  it('top-up is tracked as expense using an existing category',()=>{
    const t=parseEmailLedgerCsv(makeCsv([entry({5:'เติมเงิน/Wallet'})])).confirmed[0];
    expect(t.type).toBe('expense');
    expect(t.category).toBe('อื่น ๆ');
    expect(emailLedgerCategory(t)).toBe('เติมเงิน/Wallet');
  });
  it('same reference or same minute and amount is not double-counted',()=>{
    const a=entry(),b=entry({10:'TEST202610250002',1:'13:35'});
    const parsed=parseEmailLedgerCsv(makeCsv([a,b]));
    const one=parsed.confirmed[0];
    const same:Transaction={...one,id:'slip-existing',note:'เดิม'};
    expect(partitionEmailLedger(parsed.confirmed,[same]).ready).toHaveLength(1);
    expect(partitionEmailLedger(parsed.confirmed,[same]).duplicates).toHaveLength(1);
    expect(partitionEmailLedger(parsed.confirmed,[one]).ready).toHaveLength(1);
    expect(parseEmailLedgerCsv(makeCsv([a,a])).excluded[0].status).toBe('เลขอ้างอิงซ้ำในไฟล์');
  });
  it('rejects mismatched, unsafe or unverified financial records',()=>{
    expect(()=>parseEmailLedgerCsv(makeCsv([entry({9:'124.50'})]))).toThrow();
    expect(()=>parseEmailLedgerCsv(makeCsv([entry({7:'2.00'})]))).toThrow();
    expect(()=>parseEmailLedgerCsv(makeCsv([entry({0:'2026-02-30'})]))).toThrow();
    expect(()=>parseEmailLedgerCsv(makeCsv([entry({11:'https://mail.google.com.evil.example/path'})]))).toThrow();
    expect(()=>parseEmailLedgerCsv(makeCsv([entry({10:''})]))).toThrow();
    expect(emailLedgerEvidence('Gmail: https://mail.google.com.evil.example/path')).toBeUndefined();
  });
  it('separates income collisions and catches missing-time payee duplicates',()=>{
    const tx=parseEmailLedgerCsv(makeCsv([entry()])).confirmed[0];
    expect(isLikelyEmailDuplicate(tx,{...tx,id:'different-income',type:'income'})).toBe(false);
    const prior={...tx,id:'older-slip',time:undefined,note:'รายการธนาคารเดิม'};
    expect(isLikelyEmailDuplicate(tx,prior)).toBe(true);
    expect(isLikelyEmailDuplicate(tx,{...prior,id:'other-payee',recipient:'ร้านอื่น'})).toBe(false);
    expect(isLikelyEmailDuplicate(tx,{...tx,id:'reference-prefix',amountSatang:999, note:'เลขอ้างอิง: TEST202610250001XYZ'})).toBe(false);
  });
  it('never treats pending transfers as confirmed expenses',()=>{
    const result=parseEmailLedgerCsv(makeCsv([entry({8:'รอตรวจประเภท',9:'0'})]));
    expect(result.confirmed).toHaveLength(0);
    expect(result.excluded[0].status).toBe('รอตรวจประเภท');
  });
});

import {describe,expect,it} from 'vitest';
import {parseSlipText,mergeSlipOcrReadings} from '../src/lib/slip';
import {classifySlipByOwner,normalizedAccountHolderName,parseAccountHolderNames} from '../src/lib/slipIdentity';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';

const own='นาย สมชาย ใจดี';
const transfer=(sender:string,recipient:string)=>parseSlipText([
  'โอนเงินสำเร็จ',
  'วันที่ 12 ต.ค. 69 10:35',
  'จาก '+sender,
  'ถึง '+recipient,
  'จำนวนเงิน 500.00 บาท',
].join('\n'));

describe('OCR transfer classification by account holder name',()=>{
  it('extracts the real sender and recipient from the same OCR slip',()=>{
    const parsed=transfer(own,'นางสาว กานดา ดีมาก');
    expect(parsed.sender).toBe(own);
    expect(parsed.recipient).toBe('นางสาว กานดา ดีมาก');
  });
  it('sender is me -> expense',()=>{
    const resolved=classifySlipByOwner(transfer(own,'นางสาว กานดา ดีมาก'),[own]);
    expect(resolved.selfTransfer).toBe(false);
    expect(resolved.slip.direction).toBe('expense');
    expect(prepareAutoSlip(resolved.slip,[],'test',1).status).toBe('ready');
  });
  it('recipient is me -> income (even on the senders K PLUS success slip)',()=>{
    const resolved=classifySlipByOwner(transfer('นาย คนโอน ใจดี',own),[own]);
    expect(resolved.slip.direction).toBe('income');
    const ready=prepareAutoSlip(resolved.slip,[],'test',1);
    expect(ready.status).toBe('ready');
    if(ready.status==='ready')expect(ready.transaction.type).toBe('income');
  });
  it('both parties use my aliases -> exclude internal transfer',()=>{
    const resolved=classifySlipByOwner(transfer(own,'Mr. Somchai Jaidee'),[own,'Somchai Jaidee']);
    expect(resolved.selfTransfer).toBe(true);
    expect(resolved.slip.direction).toBeNull();
  });
  it('other-to-other or missing configured names -> must be reviewed',()=>{
    expect(classifySlipByOwner(transfer('นาย A Example','นาง B Example'),[own]).slip.direction).toBeNull();
    expect(classifySlipByOwner(transfer(own,'นาย คนรับ ใจดี'),[]).slip.direction).toBeNull();
  });
  it('missing sender does not become automatic income even when recipient is me',()=>{
    const missing=parseSlipText('โอนเงินสำเร็จ\nวันที่ 12 ต.ค. 69 10:35\nถึง '+own+'\nจำนวนเงิน 500.00 บาท');
    const resolved=classifySlipByOwner(missing,[own]);
    expect(resolved.slip.direction).toBeNull();
  });
  it('does not use substring aliases or titles alone',()=>{
    expect(normalizedAccountHolderName('น.ส. สมชาย ใจดี')).toBe(normalizedAccountHolderName(own));
    expect(classifySlipByOwner(transfer('สมชาย','นางสาว กานดา ดีมาก'),[own]).slip.direction).toBeNull();
  });
  it('keeps explicit retail and bill expense rules',()=>{
    const bill=parseSlipText('จ่ายบิลสำเร็จ\nวันที่ 12 ต.ค. 69 10:35\nจาก '+own+'\nถึง ร้านกาแฟ\nจำนวนเงิน 100.00 บาท');
    expect(classifySlipByOwner(bill,[]).slip.direction).toBe('expense');
    const retail={...transfer(own,'นางสาว กานดา ดีมาก'),source:'seven_eleven' as const};
    expect(classifySlipByOwner(retail,[own]).slip.direction).toBeNull();
  });
  it('never overrides wallet top-up risk checks',()=>{
    const slip={...transfer(own,'G-Wallet'),direction:null,directionReason:'เติมเงินเข้า e-Wallet อาจเป็นการโอนภายใน'};
    expect(classifySlipByOwner(slip,[own]).slip.direction).toBeNull();
  });
  it('preserves sender disagreements between two OCR attempts',()=>{
    const merged=mergeSlipOcrReadings(transfer(own,'นางสาว กานดา ดีมาก'),
      transfer('นาย คนโอน คนอื่น','นางสาว กานดา ดีมาก'));
    expect(merged.sender).toBeNull();
    expect(merged.warnings.some(w=>w.includes('ชื่อผู้ส่งต่างกัน'))).toBe(true);
  });
  it('accepts aliases only as full names, with duplicates removed',()=>{
    expect(parseAccountHolderNames('นาย สมชาย ใจดี\nสมชาย ใจดี\nMr. Somchai Jaidee')).toEqual([own,'Mr. Somchai Jaidee']);
    expect(()=>parseAccountHolderNames(Array.from({length:11},(_,i)=>'Name '+i).join('\n'))).toThrow();
  });
});

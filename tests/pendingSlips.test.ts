import {describe,expect,it} from 'vitest';
import {makePendingSlip,isValidPendingSlip,pendingFingerprintMatch,pendingToSlipFields,matchingPendingBySlipHash} from '../src/lib/pendingSlips';
import {parseSlipText} from '../src/lib/slip';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';

const sample=()=>parseSlipText([
  'โอนเงินสำเร็จ','11 ต.ค. 69 21:09 น.','ธ.กสิกรไทย','xxx-x-x0000-x',
  'นาย ตัวอย่าง ผู้รับ','ธ.กสิกรไทย','xxx-x-x1111-x',
  'จำนวน:','0.01 บาท','ค่าธรรมเนียม: 0.00 บาท',
  'เลขที่รายการ: TESTREF20261011000001',
].join('\n'));

describe('persistent local slip review draft',()=>{
  it('never retains full OCR text or uploaded photos',()=>{
    const slip=sample();
    slip.rawText+='\nPRIVATE_BULK_OCR_TEXT_123456';
    slip.imageHash='a'.repeat(64);
    const pending=makePendingSlip(slip,'sample-slip.jpg','ชื่อผู้รับไม่ชัด','draft-1',101);
    expect(isValidPendingSlip(pending)).toBe(true);
    expect(JSON.stringify(pending)).not.toContain('PRIVATE_BULK_OCR_TEXT');
    expect(Object.keys(pending)).not.toContain('rawText');
    expect(Object.keys(pending)).not.toContain('image');
    expect(pending.imageHash).toBe('a'.repeat(64));
    expect(pending.amountSatang).toBe(1);
    expect(pending.date).toBe('2026-10-11');
    expect(pending.receiptRef).toBe('TESTREF20261011000001');
  });

  it('recognizes duplicate pending slips via SHA256 or a reference',()=>{
    const p=makePendingSlip(sample(),'a.png','needs review','a',1000);
    const copy={...p,id:'b'};
    expect(pendingFingerprintMatch(p,copy)).toBe(true);
    expect(pendingFingerprintMatch(p,{...copy,imageHash:'b'.repeat(64),receiptRef:'DIFFERENT'})).toBe(false);
    expect(pendingFingerprintMatch(p,{...p,id:'new',receiptRef:p.receiptRef})).toBe(true);
  });

  it('restores correctable fields without restoring private OCR text',()=>{
    const draft=makePendingSlip(sample(),'a.png','needs review','a',1000);
    const slip=pendingToSlipFields(draft);
    expect(slip.rawText).toBe('');
    expect(slip.warnings).toEqual([]);
    expect(slip.amountSatang).toBe(1);
    expect(slip.receipt?.source).toBe('kplus');
    expect(slip.receipt?.receiptId).toBe(draft.receiptRef);
  });

  it('requires explicit direction before saving and preserves one-satang amounts',()=>{
    const draft=makePendingSlip(sample(),'a.png','needs review','a',1000);
    const noDirection=pendingToSlipFields({...draft,direction:null});
    expect(prepareAutoSlip(noDirection,[],'tx-1',1200).status).toBe('incomplete');
    const expense=pendingToSlipFields({...draft,direction:'expense',category:'อื่น ๆ'});
    const result=prepareAutoSlip(expense,[],'tx-1',1200);
    expect(result.status).toBe('ready');
    if(result.status==='ready')expect(result.transaction.amountSatang).toBe(1);
  });

  it('pending a wallet top-up for missing date does not lose its expense category',()=>{
    const slip=parseSlipText('เติมเงินสำเร็จ\nธ.กสิกรไทย\nxxx-x-x0000-x\nพร้อมเพย์ อี-วอลเล็ต /\nG-Wallet\nจำนวน: 150.00 บาท');
    const draft=makePendingSlip(slip,'topup.png','อ่านวันที่ไม่ได้','topup');
    expect(draft.kind).toBe('wallet_topup');
    expect(draft.direction).toBe('expense');
    expect(prepareAutoSlip(pendingToSlipFields(draft),[],'new',Date.now()).status).toBe('incomplete');
    expect(pendingToSlipFields(draft).directionReason).toContain('เติมเงินเข้า e-Wallet');
  });

  it('clears only exact-hash stale pending drafts after a successful re-upload',()=>{
    const old=makePendingSlip(sample(),'same.png','needs review','old');
    const another=makePendingSlip(sample(),'another.png','needs review','another');
    old.imageHash='a'.repeat(64);
    another.imageHash='b'.repeat(64);
    expect(matchingPendingBySlipHash([old,another],'a'.repeat(64))).toEqual(['old']);
    expect(matchingPendingBySlipHash([old,another],'c'.repeat(64))).toEqual([]);
    expect(matchingPendingBySlipHash([old,another],undefined)).toEqual([]);
  });

  it('rejects malformed snapshots and arbitrary private payloads',()=>{
    const p=makePendingSlip(sample(),'a.png','incomplete','id',100);
    expect(isValidPendingSlip({...p,imageHash:'not-sha'})).toBe(false);
    expect(isValidPendingSlip({...p,amountSatang:-1})).toBe(false);
    expect(isValidPendingSlip({...p,time:'99:99'})).toBe(false);
    expect(isValidPendingSlip({...p,kind:'payment'})).toBe(false);
  });
});

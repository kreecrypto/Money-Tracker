import {describe,it,expect} from 'vitest';
import {parseSlipText} from '../src/lib/slip';
import {classifyByAccountNames,extractSlipParties,normalizeAccountName,sanitizeOwnerNames} from '../src/lib/slipIdentity';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';
import {createBackup,parseBackup} from '../src/lib/backup';

const incomingKPlus=[
  'โอนเงินสำเร็จ','13 ต.ค. 69 18:42 น.',
  'นาย ผู้โอน ตัวอย่าง','ธ.กสิกรไทย','xxx-x-x0000-x',
  'นาย สมชาย ใจดี','รหัสพร้อมเพย์','xxx-xxx-1234',
  'จำนวน:','125.00 บาท','ค่าธรรมเนียม:','0.00 บาท',
].join('\n');

describe('OCR ownership: sender vs recipient is relative to my account',()=>{
  it('recognizes incoming money from a forwarded K PLUS sender-side slip',()=>{
    const slip=parseSlipText(incomingKPlus,[],['สมชาย ใจดี']);
    expect(slip.sender).toBe('นาย ผู้โอน ตัวอย่าง');
    expect(slip.recipient).toBe('นาย สมชาย ใจดี');
    expect(slip.direction).toBe('income');
    expect(slip.directionReason).toContain('ชื่อผู้รับ');
    const decision=prepareAutoSlip(slip,[],'incoming-test',Date.now());
    expect(decision.status).toBe('ready');
    if(decision.status==='ready')expect(decision.transaction.type).toBe('income');
  });

  it('recognizes expense when the payer matches my name',()=>{
    const slip=parseSlipText(incomingKPlus,[],['นาย ผู้โอน ตัวอย่าง']);
    expect(slip.direction).toBe('expense');
    expect(slip.directionReason).toContain('ชื่อผู้ส่ง');
  });

  it('classifies both fully labelled parties without a K PLUS layout',()=>{
    const raw='โอนเงินสำเร็จ\nวันที่ 13 ต.ค. 69 18:42 น.\nผู้โอน: น.ส. กานดา ตัวอย่าง\nผู้รับ: ร้าน โชคดี\nจำนวนเงิน 125.00 บาท';
    const slip=parseSlipText(raw,[],['นางสาว กานดา ตัวอย่าง']);
    expect(slip.sender).toBe('น.ส. กานดา ตัวอย่าง');
    expect(slip.recipient).toBe('ร้าน โชคดี');
    expect(slip.direction).toBe('expense');
  });

  it('does not count transfers between two of my own accounts as cash flow',()=>{
    const slip=parseSlipText('โอนเงินสำเร็จ\nวันที่ 13 ต.ค. 69 18:42 น.\nผู้โอน: นาย สมชาย ใจดี\nผู้รับ: สมชาย ใจดี\nจำนวนเงิน 100.00 บาท',[],['สมชาย ใจดี']);
    expect(slip.direction).toBeNull();
    expect(slip.directionReason).toContain('โอนระหว่างบัญชี');
    expect(prepareAutoSlip(slip,[],'own-transfer',Date.now()).status).toBe('incomplete');
  });

  it('refuses to infer cash flow if neither party is the configured account holder',()=>{
    const slip=parseSlipText('โอนเงินสำเร็จ\nวันที่ 13 ต.ค. 69 18:42 น.\nผู้โอน: นาย กานต์ สมมติ\nผู้รับ: นางสาว สุดา ทดสอบ\nจำนวนเงิน 100.00 บาท',[],['สมชาย ใจดี']);
    expect(slip.direction).toBeNull();
    expect(slip.directionReason).toContain('ไม่ตรง');
  });

  it('requires sender and recipient, never relying on an outgoing K PLUS heading alone after configuration',()=>{
    const slip=parseSlipText('จ่ายบิลสำเร็จ\nวันที่ 13 ต.ค. 69 18:42 น.\nผู้รับ: ร้านกาแฟ\nจำนวนเงิน 100.00 บาท',[],['สมชาย ใจดี']);
    expect(slip.direction).toBeNull();
    expect(slip.directionReason).toContain('ไม่ครบ');
  });

  it('preserves legacy explicit direction when no personal identity is configured',()=>{
    expect(parseSlipText(incomingKPlus).direction).toBe('expense');
  });

  it('does not fuzzy-match substrings, similarly spelled names, or short aliases',()=>{
    expect(normalizeAccountName('น.ส. กานดา ตัวอย่าง')).toBe(normalizeAccountName('นางสาว กานดา ตัวอย่าง'));
    const res=classifyByAccountNames({sender:'สมชาย ใจดีมาก',recipient:'ร้านกาแฟ'},['สมชาย ใจดี']);
    expect(res.direction).toBeNull();
    expect(sanitizeOwnerNames(['นาย','นาย สมชาย ใจดี','สมชาย ใจดี','นางสาว กานดา ตัวอย่าง'])).toEqual([
      'นาย สมชาย ใจดี','นางสาว กานดา ตัวอย่าง',
    ]);
  });

  it('avoids accepting account numbers as names in neighbouring lines',()=>{
    const parties=extractSlipParties(['ผู้โอน','xxx-x-x0000-x','ผู้รับ: นาย สมชาย ใจดี']);
    expect(parties.sender).toBeNull();
    expect(parties.recipient).toBe('นาย สมชาย ใจดี');
  });

  it('includes account-holder names in backup while accepting older backups without them',()=>{
    const now={monthlyBudgetSatang:100000,ownerNames:['นาย สมชาย ใจดี']};
    const restored=parseBackup(createBackup([],now));
    expect(restored.settings.ownerNames).toEqual(['นาย สมชาย ใจดี']);
    const legacy=JSON.stringify({app:'ngoentoday',version:1,transactions:[],settings:{monthlyBudgetSatang:0}});
    expect(parseBackup(legacy).settings.ownerNames).toEqual([]);
  });
});

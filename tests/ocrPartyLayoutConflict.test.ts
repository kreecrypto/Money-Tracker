import {describe,expect,it} from 'vitest';
import {parseSlipText} from '../src/lib/slip';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';

/** Fictional OCR text/word rows only. No actual bank image or identity. */
const slip=[
  'โอนเงินออกสำเร็จ',
  'วันที่ 14 ต.ค. 69 13:45 น.',
  'ผู้โอน: นาย สมชาย ทดสอบ',
  'ผู้รับ: ร้านกาแฟตัวอย่าง',
  'จำนวนเงิน: 90.00 บาท',
].join('\n');

describe('OCR text vs spatial party consistency',()=>{
  it('does not auto-save when OCR rows disagree on the sender',()=>{
    const parsed=parseSlipText(slip,['ผู้โอน: นาย สมชาย คนอื่น','ผู้รับ: ร้านกาแฟตัวอย่าง']);
    expect(parsed.sender).toBeNull();
    expect(parsed.amountSatang).toBe(9000);
    expect(parsed.warnings.some(w=>w.includes('ชื่อผู้โอนขัดแย้ง'))).toBe(true);
    expect(prepareAutoSlip(parsed,[],'sender-conflict',1).status).toBe('incomplete');
  });

  it('does not auto-save when OCR rows disagree on the recipient',()=>{
    const parsed=parseSlipText(slip,['ผู้โอน: นาย สมชาย ทดสอบ','ผู้รับ: ร้านกาแฟอีกแห่ง']);
    expect(parsed.recipient).toBeNull();
    expect(parsed.warnings.some(w=>w.includes('ชื่อผู้รับขัดแย้ง'))).toBe(true);
    expect(prepareAutoSlip(parsed,[],'recipient-conflict',1).status).toBe('incomplete');
  });

  it('accepts equivalent spelling of a name and unchanged counterparty',()=>{
    const parsed=parseSlipText(slip,['ผู้โอน: สมชาย ทดสอบ','ผู้รับ: ร้านกาแฟตัวอย่าง']);
    expect(parsed.sender).toBe('นาย สมชาย ทดสอบ');
    expect(parsed.recipient).toBe('ร้านกาแฟตัวอย่าง');
    expect(parsed.warnings.some(w=>w.includes('ขัดแย้ง'))).toBe(false);
    expect(prepareAutoSlip(parsed,[],'same-parties',1).status).toBe('ready');
  });

  it('keeps existing OCR behavior when visual party rows are unavailable',()=>{
    const parsed=parseSlipText(slip);
    expect(parsed.amountSatang).toBe(9000);
    expect(prepareAutoSlip(parsed,[],'no-layout',1).status).toBe('ready');
  });
});


/** Fictional K PLUS unlabelled recipient blocks in both OCR representations. */
const kPlusRows=(payee:string|null)=>[
  'โอนเงินสำเร็จ',
  'วันที่ 14 ต.ค. 69 13:45 น.',
  'นาย ตัวอย่าง ผู้ส่ง',
  'ธ.กสิกรไทย',
  'xxx-x-x0000-x',
  ...(payee?[payee,'รหัสพร้อมเพย์','xxx-xxx-1234']:[]),
  'จำนวน: 90.00 บาท',
  'เลขที่รายการ: TESTREF20261014001',
];

describe('K PLUS unlabelled payee text-vs-layout safety',()=>{
  it('routes conflicting K PLUS payees to Pending instead of auto-saving a wrong recipient',()=>{
    const parsed=parseSlipText(kPlusRows('ร้านกาแฟตัวอย่าง').join('\n'),
      kPlusRows('ร้านอาหารตัวอย่าง'));
    expect(parsed.recipient).toBeNull();
    expect(parsed.warnings.some(w=>w.includes('ชื่อผู้รับขัดแย้ง'))).toBe(true);
    expect(prepareAutoSlip(parsed,[],'kplus-disagreement',1).status).toBe('incomplete');
  });

  it('keeps equivalent K PLUS recipient names ready with cosmetic spacing differences',()=>{
    const parsed=parseSlipText(kPlusRows('ร้านกาแฟ ตัวอย่าง').join('\n'),
      kPlusRows('ร้านกาแฟตัวอย่าง'));
    expect(parsed.recipient).toBe('ร้านกาแฟ ตัวอย่าง');
    expect(parsed.warnings.some(w=>w.includes('ขัดแย้ง'))).toBe(false);
    expect(prepareAutoSlip(parsed,[],'kplus-agreement',1).status).toBe('ready');
  });

  it('retains visual K PLUS payee recovery when text contains no readable payee',()=>{
    const parsed=parseSlipText(kPlusRows(null).join('\n'),
      kPlusRows('ร้านกาแฟตัวอย่าง'));
    expect(parsed.recipient).toBe('ร้านกาแฟตัวอย่าง');
    expect(prepareAutoSlip(parsed,[],'kplus-visual-only',1).status).toBe('ready');
  });
});

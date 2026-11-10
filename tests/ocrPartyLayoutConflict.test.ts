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

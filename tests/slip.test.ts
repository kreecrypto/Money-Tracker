import {describe,it,expect} from 'vitest';
import {parseSlipText,normalizeSlipOcrText,needsSlipOcrRecovery,mergeSlipOcrReadings,inferSlipDirection} from '../src/lib/slip';

describe('Thai bank transfer slip parser',()=>{
  it('reads a Thai transfer with Buddhist Era year and ignores reference & fee',()=>{
    const result=parseSlipText('โอนเงินสำเร็จ\nวันที่ 10 ต.ค. 2569 15:40\nถึง นาย สมชาย ใจดี\nเลขอ้างอิง 123456789012345\nจำนวนเงิน\n1,234.50 บาท\nค่าธรรมเนียม 0.00 บาท');
    expect(result.amountSatang).toBe(123450);
    expect(result.date).toBe('2026-10-10');
    expect(result.time).toBe('15:40');
    expect(result.recipient).toBe('นาย สมชาย ใจดี');
  });
  it('reads English amount and ISO date',()=>{
    const result=parseSlipText('Bank transfer\nDate: 2026-10-09 08:00\nTo: Coffee House\nAmount: THB 129.75');
    expect(result.amountSatang).toBe(12975);
    expect(result.date).toBe('2026-10-09');
    expect(result.time).toBe('08:00');
    expect(result.recipient).toBe('Coffee House');
  });
  it('handles numeric BE dates and Thai digits',()=>{
    expect(parseSlipText('วันที่ ๑๐/๑๐/๒๕๖๙\nยอดโอน: ๕๐๐.๐๐ บาท').amountSatang).toBe(50000);
    expect(parseSlipText('วันที่ ๑๐/๑๐/๒๕๖๙\nยอดโอน: ๕๐๐.๐๐ บาท').date).toBe('2026-10-10');
    expect(parseSlipText('วันที่ 10/10/69\nAmount: 500').date).toBe('2026-10-10');
  });
  it('does not turn account numbers or references into amounts',()=>{
    const result=parseSlipText('โอนไปยัง\nเลขบัญชี 1234567890\nรหัสอ้างอิง 999888777\nค่าธรรมเนียม 15.00 บาท');
    expect(result.amountSatang).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  it('refuses ambiguous currencies without amount label',()=>{
    expect(parseSlipText('฿100.00\n฿200.00').amountSatang).toBeNull();
  });
  it('accepts explicit labelled amounts with fee lines present',()=>{
    expect(parseSlipText('ยอดเงิน 1,550.00\nค่าธรรมเนียม 5.00 บาท\nยอดคงเหลือ 10,000.00').amountSatang).toBe(155000);
  });
  it('does not emit invalid dates or undocumented amount guesses',()=>{
    expect(parseSlipText('วันที่ 31/02/2569\nยอดเงิน ไม่ชัดเจน').date).toBeNull();
    expect(parseSlipText('วันที่ 31/02/2569\nยอดเงิน ไม่ชัดเจน').amountSatang).toBeNull();
  });
  it('returns empty fields for blank OCR',()=>{
    const result=parseSlipText('');
    expect(result.amountSatang).toBeNull();
    expect(result.date).toBeNull();
    expect(result.recipient).toBeNull();
  });

  it('extracts exactly the four core fields from a K PLUS bill-payment layout',()=>{
    const screenshotStyle=[
      'จ่ายบิลสำเร็จ',
      '12 ต.ค. 69 13:15 น.',
      'นาย ผู้ชำระเงิน',
      'ธ.กสิกรไทย',
      'xxx-x-x0000-x',
      'SYNPHAET BANGNA',
      'CO.,LTD.',
      '000000000000000',
      'SAMPLE-BILL-REFERENCE',
      'จำนวน:',
      '2,948.00 บาท',
      'ค่าธรรมเนียม: 0.00 บาท',
      'เลขที่รายการ: SAMPLE-TRANSACTION-REF'
    ].join('\n');
    const result=parseSlipText(screenshotStyle);
    expect(result.date).toBe('2026-10-12');
    expect(result.time).toBe('13:15');
    expect(result.amountSatang).toBe(294800);
    expect(result.recipient).toBe('SYNPHAET BANGNA CO.,LTD.');
    expect(result.warnings).toEqual([]);
  });
  it('does not misidentify the payer as the recipient when the biller block is missing',()=>{
    const result=parseSlipText('จ่ายบิลสำเร็จ\n12 ต.ค. 69 13:15 น.\nนาย ผู้ชำระเงิน\nธ.กสิกรไทย\nจำนวน: 2,948.00 บาท');
    expect(result.recipient).toBeNull();
    expect(result.warnings.some(x=>x.includes('ชื่อผู้รับ'))).toBe(true);
  });
  it('does not treat fees or transaction references as payment times',()=>{
    const result=parseSlipText('วันที่ 12 ต.ค. 69\nจำนวน: 2,948.00 บาท\nค่าธรรมเนียม 0.00 บาท\nเลขที่รายการ SAMPLE-TRANSACTION-REF');
    expect(result.time).toBeNull();
    expect(result.amountSatang).toBe(294800);
  });
  it('rejects out-of-range clock times',()=>{
    expect(parseSlipText('วันที่ 12 ต.ค. 69 24:90 น.').time).toBeNull();
    expect(parseSlipText('วันที่ 12 ต.ค. 69 เวลา 23:59 น.').time).toBe('23:59');
  });

  it('normalizes decomposed Thai sara am without modifying the original OCR transcript',()=>{
    const raw='จ่ายบิลสําเร็จ\nจํานวน:\n2,948.00 บาท';
    expect(normalizeSlipOcrText(raw)).toContain('จ่ายบิลสำเร็จ');
    const result=parseSlipText(raw);
    expect(result.amountSatang).toBe(294800);
    expect(result.rawText).toBe(raw);
  });
  it('extracts all four fields from anonymized OCR output of the sample K PLUS image',()=>{
    const raw=[
      'จ่ายบิลสําเร็จ',
      '12 ต.ค. 69 13:15 น.',
      'นาย ผู้โอน',
      'ธ.กสิกรไทย',
      'ง   XXX-X-X0000-x',
      '๐ SYNPHAET BANGNA',
      'CO.,LTD.',
      '000000000000000',
      'SAMPLE-BILL-REFERENCE',
      'จํานวน:',
      '2,948.00 บาท',
      'ค่าธรรมเนียม:',
      '0.00 บาท',
      'เลขที่รายการ:',
      'SAMPLE-TRANSACTION-REF'
    ].join('\n');
    const result=parseSlipText(raw);
    expect(result).toMatchObject({
      date:'2026-10-12',time:'13:15',amountSatang:294800,
      recipient:'SYNPHAET BANGNA CO.,LTD.'
    });
    expect(needsSlipOcrRecovery(result)).toBe(false);
  });
  it('uses recovered OCR only for missing information and does not fabricate other values',()=>{
    const first=parseSlipText('วันที่ 12 ต.ค. 69 13:15 น.\nจํานวน:\n2,948.00 บาท');
    const second=parseSlipText('จ่ายบิลสําเร็จ\nธ.กสิกรไทย\nXXX-X-X0000-x\nSYNPHAET BANGNA\nCO.,LTD.\nจํานวน:\n2,948.00 บาท');
    expect(needsSlipOcrRecovery(first)).toBe(true);
    const merged=mergeSlipOcrReadings(first,second);
    expect(merged).toMatchObject({date:'2026-10-12',time:'13:15',amountSatang:294800,recipient:'SYNPHAET BANGNA CO.,LTD.'});
    expect(merged.warnings).toEqual([]);
  });
  it('does not silently choose conflicting OCR amounts',()=>{
    const first=parseSlipText('ยอดเงิน: 2,948.00 บาท\nวันที่ 12 ต.ค. 69 13:15 น.');
    const second=parseSlipText('ยอดเงิน: 2,943.00 บาท\nวันที่ 12 ต.ค. 69 13:15 น.');
    const merged=mergeSlipOcrReadings(first,second);
    expect(merged.amountSatang).toBeNull();
    expect(merged.warnings.some(x=>x.includes('จำนวนเงิน'))).toBe(true);
  });
  it('ignores noisy account and fee lines while recovering a multi-line recipient',()=>{
    const result=parseSlipText('จ่ายบิลสําเร็จ\n12 ต.ค. 69 13:15 น.\nธ.กสิกรไทย\nXXX-X-X0000-x\nSYNPHAET BANGNA\nCO.,LTD.\n000000000000000\nจํานวน:\n2,948.00 บาท\nค่าธรรมเนียม:\n0.00 บาท');
    expect(result.recipient).toBe('SYNPHAET BANGNA CO.,LTD.');
    expect(result.amountSatang).toBe(294800);
  });

  it('recognizes the K PLUS bill-payment sample as an expense with explicit evidence',()=>{
    const result=parseSlipText('จ่ายบิลสำเร็จ\n12 ต.ค. 69 13:15 น.\nชื่อผู้จ่าย\nxxx-x-x0000-x\nSYNPHAET BANGNA\nCO.,LTD.\nจำนวน:\n2,948.00 บาท');
    expect(result.direction).toBe('expense');
    expect(result.directionReason).toContain('จ่ายบิล');
  });
  it.each([
    'จ่ายบิลสําเร็จ\n12 ต.ค. 69',
    'ชำระเงินสำเร็จ\nยอดเงิน 120.00 บาท',
    'โอนออกสำเร็จ\nวันที่ 12 ต.ค. 69',
    'เงินออกจากบัญชี\nจำนวนเงิน 50.00 บาท',
    'Bill payment complete\nDate: 2026-10-12',
  ])('classifies explicit outgoing signals as expense: %s',text=>{
    expect(inferSlipDirection(text).direction).toBe('expense');
  });
  it.each([
    'รับโอนเงินสำเร็จ\n12 ต.ค. 69 13:15 น.',
    'รับเงินสำเร็จ\nยอดเงิน 200.00 บาท',
    'ได้รับเงิน\nวันที่ 12 ต.ค. 69',
    'เงินเข้าบัญชี\nยอดเงิน 500.00 บาท',
    'Incoming transfer\nDate: 2026-10-12',
  ])('classifies explicit incoming signals as income: %s',text=>{
    expect(inferSlipDirection(text).direction).toBe('income');
  });
  it.each([
    'โอนเงินสำเร็จ\nถึง ร้านกาแฟ\nจำนวนเงิน 60.00 บาท',
    'โอนเงินสำเร็จ\nเลขอ้างอิง 12345678',
    'Bank transfer\nTo: Coffee House\nAmount THB 129.75',
    'วันที่ 12 ต.ค. 69\nจำนวนเงิน 100.00 บาท',
  ])('does not guess direction from generic or incomplete transfer slips: %s',text=>{
    const result=inferSlipDirection(text);
    expect(result.direction).toBeNull();
    expect(result.directionReason).toContain('โปรดเลือก');
  });
  it('rejects contradictory cashflow labels instead of choosing a direction',()=>{
    const result=inferSlipDirection('จ่ายบิลสำเร็จ\nเงินเข้าบัญชี\nวันที่ 12 ต.ค. 69');
    expect(result.direction).toBeNull();
    expect(result.directionReason).toContain('ทั้งเงินเข้าและเงินออก');
  });
  it('recovers direction from a second OCR pass when the first missed the header',()=>{
    const first=parseSlipText('วันที่ 12 ต.ค. 69 13:15 น.\nจำนวนเงิน 100.00 บาท');
    const second=parseSlipText('รับเงินสำเร็จ\nวันที่ 12 ต.ค. 69 13:15 น.\nจำนวนเงิน 100.00 บาท');
    const combined=mergeSlipOcrReadings(first,second);
    expect(combined.direction).toBe('income');
    expect(combined.directionReason).toContain('รับเงิน');
  });
  it('rejects conflicting income/expense classifications across OCR passes',()=>{
    const first=parseSlipText('จ่ายบิลสำเร็จ\nวันที่ 12 ต.ค. 69 13:15 น.\nยอดเงิน 100.00 บาท');
    const second=parseSlipText('รับเงินสำเร็จ\nวันที่ 12 ต.ค. 69 13:15 น.\nยอดเงิน 100.00 บาท');
    const combined=mergeSlipOcrReadings(first,second);
    expect(combined.direction).toBeNull();
    expect(combined.warnings.some(w=>w.includes('ประเภทรายรับรายจ่าย'))).toBe(true);
  });
  it('does not treat a payee label containing the word income as evidence of money received',()=>{
    const result=inferSlipDirection('โอนเงินสำเร็จ\nผู้รับ: เงินเข้าบัญชี จำกัด\nวันที่ 12 ต.ค. 69\nจำนวนเงิน 100.00 บาท');
    expect(result.direction).toBeNull();
  });
});

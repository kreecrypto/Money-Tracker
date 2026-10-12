import {describe,it,expect} from 'vitest';
import {parseSlipText} from '../src/lib/slip';

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
      'xxx-x-x5839-x',
      'SYNPHAET BANGNA',
      'CO.,LTD.',
      '000002206186967',
      '471554458KK8GX000000',
      'จำนวน:',
      '2,948.00 บาท',
      'ค่าธรรมเนียม: 0.00 บาท',
      'เลขที่รายการ: 016285131509APM16324'
    ].join('\\n');
    const result=parseSlipText(screenshotStyle);
    expect(result.date).toBe('2026-10-12');
    expect(result.time).toBe('13:15');
    expect(result.amountSatang).toBe(294800);
    expect(result.recipient).toBe('SYNPHAET BANGNA CO.,LTD.');
    expect(result.warnings).toEqual([]);
  });
  it('does not misidentify the payer as the recipient when the biller block is missing',()=>{
    const result=parseSlipText('จ่ายบิลสำเร็จ\\n12 ต.ค. 69 13:15 น.\\nนาย ผู้ชำระเงิน\\nธ.กสิกรไทย\\nจำนวน: 2,948.00 บาท');
    expect(result.recipient).toBeNull();
    expect(result.warnings.some(x=>x.includes('ชื่อผู้รับ'))).toBe(true);
  });
  it('does not treat fees or transaction references as payment times',()=>{
    const result=parseSlipText('วันที่ 12 ต.ค. 69\\nจำนวน: 2,948.00 บาท\\nค่าธรรมเนียม 0.00 บาท\\nเลขที่รายการ 016285131509APM16324');
    expect(result.time).toBeNull();
    expect(result.amountSatang).toBe(294800);
  });
  it('rejects out-of-range clock times',()=>{
    expect(parseSlipText('วันที่ 12 ต.ค. 69 24:90 น.').time).toBeNull();
    expect(parseSlipText('วันที่ 12 ต.ค. 69 เวลา 23:59 น.').time).toBe('23:59');
  });
});

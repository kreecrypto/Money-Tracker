import {describe,it,expect} from 'vitest';
import {parseSlipText} from '../src/lib/slip';

describe('Thai bank transfer slip parser',()=>{
  it('reads a Thai transfer with Buddhist Era year and ignores reference & fee',()=>{
    const result=parseSlipText('โอนเงินสำเร็จ\nวันที่ 10 ต.ค. 2569 15:40\nถึง นาย สมชาย ใจดี\nเลขอ้างอิง 123456789012345\nจำนวนเงิน\n1,234.50 บาท\nค่าธรรมเนียม 0.00 บาท');
    expect(result.amountSatang).toBe(123450);
    expect(result.date).toBe('2026-10-10');
    expect(result.recipient).toBe('นาย สมชาย ใจดี');
  });
  it('reads English amount and ISO date',()=>{
    const result=parseSlipText('Bank transfer\nDate: 2026-10-09 08:00\nTo: Coffee House\nAmount: THB 129.75');
    expect(result.amountSatang).toBe(12975);
    expect(result.date).toBe('2026-10-09');
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
});

import {describe,expect,it} from 'vitest';
import {parseSlipText} from '../src/lib/slip';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';
import {isLowOcrConfidence,requiresLowConfidenceReview} from '../src/lib/ocrConfidence';
import {receiptRecoveryScale} from '../src/lib/slipImage';

const kplus=(extra:string,amount='125.50 บาท')=>[
  'จ่ายบิลสำเร็จ',
  '14 ต.ค. 69 08:21 น.',
  'นาย ตัวอย่าง ผู้จ่าย',
  'ธ.กสิกรไทย',
  'xxx-x-x0000-x',
  'ร้านกาแฟ ทดสอบ',
  'จำนวน:',
  amount,
  extra,
].filter(Boolean).join('\n');

describe('financially safe K PLUS OCR fallbacks',()=>{
  it('accepts consistent repeated amount labels',()=>{
    const slip=parseSlipText(kplus('ยอดชำระ 125.50 บาท'));
    expect(slip.amountSatang).toBe(12550);
    expect(slip.warnings.some(x=>x.includes('ขัดแย้ง'))).toBe(false);
    expect(prepareAutoSlip(slip,[],'same-amount',Date.now()).status).toBe('ready');
  });

  it('requires review when two payment labels disagree on one slip',()=>{
    const slip=parseSlipText(kplus('ยอดชำระ 128.50 บาท'));
    expect(slip.amountSatang).toBeNull();
    expect(slip.warnings.some(x=>x.includes('ขัดแย้ง'))).toBe(true);
    expect(prepareAutoSlip(slip,[],'conflict-amount',Date.now()).status).toBe('incomplete');
  });

  it('does not steal a number after an unrelated text line to fill a blank amount',()=>{
    const slip=parseSlipText(kplus('ค่าธรรมเนียม 0.00 บาท','อ่านไม่ชัด\nรหัสรายการ\n99.00 บาท'));
    expect(slip.amountSatang).toBeNull();
    expect(prepareAutoSlip(slip,[],'missing-amount',Date.now()).status).toBe('incomplete');
  });

  it('does not classify an item count as the transaction amount',()=>{
    const slip=parseSlipText(kplus('ค่าธรรมเนียม 0.00 บาท','3 ชิ้น'));
    expect(slip.amountSatang).toBeNull();
  });

  it('continues to support one satang even when a fee is printed below it',()=>{
    const slip=parseSlipText(kplus('ค่าธรรมเนียม: 0.00 บาท','0.01 บาท'));
    expect(slip.amountSatang).toBe(1);
    expect(prepareAutoSlip(slip,[],'one-satang',Date.now()).status).toBe('ready');
  });

  it('sends low-confidence readings to review unless a strong second pass agrees',()=>{
    const first=parseSlipText(kplus('ค่าธรรมเนียม 0.00 บาท'));
    const same=parseSlipText(kplus('ค่าธรรมเนียม 0.00 บาท'));
    const altered=parseSlipText(kplus('ค่าธรรมเนียม 0.00 บาท','125.51 บาท'));
    expect(isLowOcrConfidence(34)).toBe(true);
    expect(isLowOcrConfidence(80)).toBe(false);
    expect(requiresLowConfidenceReview(first,same,34,88)).toBe(false);
    expect(requiresLowConfidenceReview(first,same,34,40)).toBe(true);
    expect(requiresLowConfidenceReview(first,null,34,null)).toBe(true);
    expect(requiresLowConfidenceReview(first,altered,34,88)).toBe(true);
    expect(requiresLowConfidenceReview(first,altered,92,88)).toBe(false);
  });

  it('stops auto save when no trustworthy second OCR result exists',()=>{
    const slip=parseSlipText(kplus('ค่าธรรมเนียม 0.00 บาท'));
    slip.warnings.push('OCR ความมั่นใจต่ำและยังยืนยันข้อมูลได้ไม่ครบ กรุณาตรวจจากภาพก่อนบันทึก');
    const decision=prepareAutoSlip(slip,[],'low-confidence',Date.now());
    expect(decision.status).toBe('incomplete');
    if(decision.status==='incomplete')expect(decision.reason).toContain('ความมั่นใจต่ำ');
  });

  it('upscales narrow images but stays within bounded OCR canvas dimensions',()=>{
    const narrow=receiptRecoveryScale(500,1000);
    expect(narrow).toBeGreaterThan(1.35);
    expect(500*narrow).toBeLessThanOrEqual(1800);
    expect(1000*narrow).toBeLessThanOrEqual(2100);
    const large=receiptRecoveryScale(4000,6000);
    expect(4000*large).toBeLessThanOrEqual(1800);
    expect(6000*large).toBeLessThanOrEqual(2100);
    expect(4000*6000*large*large).toBeLessThanOrEqual(2_700_001);
  });
});

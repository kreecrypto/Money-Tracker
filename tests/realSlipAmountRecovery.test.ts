import {describe,expect,it} from 'vitest';
import {parseSlipText,needsSlipOcrRecovery} from '../src/lib/slip';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';

/** Fictional bank layout only; no private source screenshots or identifiers. */
const payment=(moneySection:string)=>[
  'จ่ายบิลสำเร็จ',
  '14 ต.ค. 69 13:45 น.',
  'นาย ทดสอบ ผู้ส่ง',
  'ธ.กสิกรไทย',
  'xxx-x-x0000-x',
  'FOOD PATIO ร้านค้าทดสอบ',
  '000000001234567',
  moneySection,
  'ค่าธรรมเนียม 0.00 บาท',
  'เลขที่รายการ: TESTPAY20261014000000001',
].join('\n');

describe('real-world K PLUS amount formatting recovery',()=>{
  it.each([
    ['merged fee caption','จำนวน: 80.00 บาท ค่าธรรมเนียม 0.00 บาท',8000],
    ['fee before amount caption','ค่าธรรมเนียม 0.00 บาท จำนวน: 85.00 บาท',8500],
    ['spaced OCR decimal','จำนวน: ฿ 30 . 00 บาท',3000],
    ['Thai decimal comma with two cent digits','จำนวน: 45,50 บาท',4550],
    ['standalone currency marker','จำนวน:\n฿\n155.00',15500],
    ['currency suffixed inline','จำนวนเงิน: 1,150.25 บาท เลขที่รายการ: TESTPAY20261014000000001',115025],
  ])('reads %s without using fees or reference numbers',(_name,text,expected)=>{
    const slip=parseSlipText(payment(text));
    expect(slip.amountSatang).toBe(expected);
    expect(slip.recipient).toBe('FOOD PATIO ร้านค้าทดสอบ');
    expect(slip.date).toBe('2026-10-14');
    expect(slip.time).toBe('13:45');
    expect(prepareAutoSlip(slip,[],String(expected),Date.now()).status).toBe('ready');
  });

  it('recovers a labelled total from visual OCR boxes when text flow is broken',()=>{
    const text=payment('จำนวน:\nอ่านไม่ชัด');
    const first=parseSlipText(text);
    expect(first.amountSatang).toBeNull();
    const recovered=parseSlipText(text,['จ่ายบิลสำเร็จ','จำนวน: 79.00 บาท','ค่าธรรมเนียม 0.00 บาท']);
    expect(recovered.amountSatang).toBe(7900);
    expect(needsSlipOcrRecovery(recovered)).toBe(false);
  });

  it('does not overwrite a conflicting OCR amount with visual layout guesses',()=>{
    const slip=parseSlipText(payment('จำนวน: 79.00 บาท'),['จำนวน: 97.00 บาท']);
    expect(slip.amountSatang).toBeNull();
    expect(slip.warnings.some(w=>w.includes('ขัดแย้ง'))).toBe(true);
    expect(prepareAutoSlip(slip,[],'conflicting',Date.now()).status).toBe('incomplete');
  });

  it('ignores fee-only figures and references when the paid amount is unavailable',()=>{
    const slip=parseSlipText(payment('จำนวน:\nอ่านไม่ชัด\nรหัสอ้างอิง\n99.00 บาท'));
    expect(slip.amountSatang).toBeNull();
    expect(prepareAutoSlip(slip,[],'unreadable',Date.now()).status).toBe('incomplete');
  });

  it('never promotes a fee caption or QR reference as an amount by itself',()=>{
    const slip=parseSlipText('จ่ายบิลสำเร็จ\nค่าธรรมเนียม 60.00 บาท\nเลขอ้างอิง 222.00 บาท');
    expect(slip.amountSatang).toBeNull();
  });
});

import {describe,expect,it} from 'vitest';
import {parseSlipText,needsSlipOcrRecovery,describeMissingSlipAmount} from '../src/lib/slip';
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
  it.each([['NTT DATA bill',30],['FOOD PATIO lunch',90],['FOOD PATIO snack',30],['PromptPay transfer',50]] as const)('recovers %s amount when OCR joins fee caption to the next visual row',(_label,baht)=>{
    const text=payment('จำนวน:\n'+baht.toFixed(2)+' บาท ค่าธรรมเนียม: 0.00 บาท');
    expect(parseSlipText(text).amountSatang).toBe(baht*100);
  });

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

  it.each([30,90,50])('recovers %i baht when K PLUS OCR separates number and currency',baht=>{
    const amount=baht.toFixed(2);
    const slip=parseSlipText(payment('จำนวน:\n'+amount+'\nบาท'));
    expect(slip.amountSatang).toBe(baht*100);
  });

  it.each([30,50,90])('recovers %i baht when OCR places baht marker before the value',baht=>{
    const amount=baht.toFixed(2);
    for(const prefix of ['บาท ', 'บาท']){
      const slip=parseSlipText(payment('จำนวน:\n'+prefix+amount));
      expect(slip.amountSatang).toBe(baht*100);
    }
  });

  it.each([
    ['bare amount heading', 'จำนวน\n30.00 บาท', 3000],
    ['bare heading with split currency', 'จำนวน\n50.00\nบาท', 5000],
    ['isolated OCR number and currency', 'จำนวน\n฿\n90.00', 9000],
  ])('recovers %s in K PLUS text',(_name,amountText,expected)=>{
    const slip=parseSlipText(payment(amountText));
    expect(slip.amountSatang).toBe(expected);
  });

  it('recovers a bare amount heading in spatial OCR rows',()=>{
    const slip=parseSlipText(payment('จำนวน\nอ่านไม่ชัด'),['จำนวน','90.00','บาท','ค่าธรรมเนียม: 0.00 บาท']);
    expect(slip.amountSatang).toBe(9000);
  });

  it('refuses fee and reference amounts after a bare heading',()=>{
    const slip=parseSlipText(payment('จำนวน\nค่าธรรมเนียม: 50.00 บาท\nเลขที่รายการ: 9000'));
    expect(slip.amountSatang).toBeNull();
  });

  it('explains unreadable text, missing amount labels, and disagreement separately',()=>{
    const empty=parseSlipText('');
    expect(describeMissingSlipAmount(empty,null)).toContain('ตัวอักษร');
    const noLabel=parseSlipText('วันที่ 14 ต.ค. 69\nชื่อร้านทดสอบ');
    expect(describeMissingSlipAmount(noLabel,null)).toContain('ไม่พบหัวข้อ');
    const first=parseSlipText(payment('จำนวน: 30.00 บาท'));
    const second=parseSlipText(payment('จำนวน: 90.00 บาท'));
    expect(describeMissingSlipAmount(first,second)).toContain('สองรอบไม่ตรงกัน');
  });

  it('recovers a right-aligned amount from layout when OCR text places unrelated text after the label',()=>{
    const text=payment('จำนวน:\nอ่านไม่ชัด');
    const slip=parseSlipText(text,['จำนวน:','30.00','บาท','ค่าธรรมเนียม: 0.00 บาท']);
    expect(slip.amountSatang).toBe(3000);
  });

  it('never uses a fee or reference as a missing right-aligned amount',()=>{
    const slip=parseSlipText(payment('จำนวน:\nค่าธรรมเนียม: 50.00 บาท\nเลขที่รายการ: 9000'));
    expect(slip.amountSatang).toBeNull();
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

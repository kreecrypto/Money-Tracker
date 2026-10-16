import {describe,expect,it} from 'vitest';
import {parseSlipText,needsSlipOcrRecovery,mergeSlipOcrReadings} from '../src/lib/slip';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';

/**
 * Seven additional privacy-safe K PLUS OCR layout fixtures.
 * Structure/amount boundaries are modeled on user examples but bank account
 * identifiers, payee identities and references are deliberately fictional.
 * Do not upload the source bank screenshots to the public repository.
 */
const cases=[
  {kind:'โอนเงินสำเร็จ',when:'11 ต.ค. 69 21:09 น.',
    beneficiary:['น.ส. ตัวอย่าง ปาลวัฒน์','ธ.กสิกรไทย','xxx-x-x6721-x'],
    recipient:'น.ส. ตัวอย่าง ปาลวัฒน์',amount:'0.01',satang:1,time:'21:09'},
  {kind:'โอนเงินสำเร็จ',when:'11 ต.ค. 69 17:10 น.',
    beneficiary:['นาย ตัวอย่าง สุขใจ','ธ.กสิกรไทย','xxx-x-x7995-x'],
    recipient:'นาย ตัวอย่าง สุขใจ',amount:'25.00',satang:2500,time:'17:10'},
  {kind:'จ่ายบิลสำเร็จ',when:'11 ต.ค. 69 17:08 น.',
    beneficiary:['ถุงเงิน (ผลไม้)','UD366O50PE0408024OG','MISSSAMPLEPAYEE'],
    recipient:'ถุงเงิน (ผลไม้)',amount:'25.00',satang:2500,time:'17:08'},
  {kind:'ชำระเงินสำเร็จ',when:'11 ต.ค. 69 13:53 น.',
    beneficiary:['บริษัท เอ็มเพย์ ตัวอย่าง จำกัด','T2628413530983425045','AYUDHYACAPITALSERV'],
    recipient:'บริษัท เอ็มเพย์ ตัวอย่าง จำกัด',amount:'88.79',satang:8879,time:'13:53'},
  {kind:'โอนเงินสำเร็จ',when:'11 ต.ค. 69 09:27 น.',
    beneficiary:['นาง ตัวอย่าง แผลงงาม','รหัสพร้อมเพย์','x-xxxx-xxxx6-28-6'],
    recipient:'นาง ตัวอย่าง แผลงงาม',amount:'65.00',satang:6500,time:'09:27'},
  {kind:'จ่ายบิลสำเร็จ',when:'11 ต.ค. 69 07:38 น.',
    beneficiary:['ROYAL EXAMPLE AGENCY -','PAYMENT TICKET','0469021739484'],
    recipient:'ROYAL EXAMPLE AGENCY - PAYMENT TICKET',amount:'500.00',satang:50000,time:'07:38'},
] as const;
function fixture(s:typeof cases[number],i:number){
  const ref='TESTPAY20261011'+String(i+1).padStart(7,'0');
  const lines=[s.kind,s.when,'นาย ตัวอย่าง ผู้จ่าย','ธ.กสิกรไทย',
    'xxx-x-x0000-x',...s.beneficiary,
    'จำนวน:',s.amount+' บาท','ค่าธรรมเนียม:','0.00 บาท','เลขที่รายการ:',ref,
    'สแกน','ตรวจสอบสลิป'];
  return {text:lines.join('\n'),ref};
}
describe('additional K PLUS layouts from seven image examples',()=>{
  it.each(cases.map((s,i)=>({s,i})))('parses additional layout $i',({s,i})=>{
    const {text,ref}=fixture(s,i);
    const slip=parseSlipText(text);
    expect(slip).toMatchObject({
      amountSatang:s.satang,date:'2026-10-11',time:s.time,
      recipient:s.recipient,direction:'expense',
    });
    expect(slip.receipt).toMatchObject({
      source:'kplus',receiptId:ref,paidSatang:s.satang,itemsComplete:true
    });
    expect(needsSlipOcrRecovery(slip)).toBe(false);
    const result=prepareAutoSlip(slip,[],String(i),Date.now());
    expect(result.status).toBe('ready');
  });

  it('handles one satang without mistaking zero-baht fee as payment',()=>{
    const {text}=fixture(cases[0],0);
    expect(parseSlipText(text).amountSatang).toBe(1);
    const withoutAmount=text.replace('0.01 บาท','อ่านไม่ชัด');
    const result=parseSlipText(withoutAmount);
    expect(result.amountSatang).toBeNull();
    expect(prepareAutoSlip(result,[],'missing',Date.now()).status).toBe('incomplete');
  });

  it('does not treat wallet top-up as a purchase or income',()=>{
    const text=[
      'เติมเงินสำเร็จ','11 ต.ค. 69 17:55 น.','นาย ตัวอย่าง ผู้จ่าย',
      'ธ.กสิกรไทย','xxx-x-x0000-x','พร้อมเพย์ อี-วอลเล็ต /','G-Wallet',
      '006-xxxxxxxx-8913','จำนวน:','150.00 บาท',
      'ค่าธรรมเนียม:','0.00 บาท','เลขที่รายการ: TESTTOPUP20261011000001',
      'รายละเอียด: เติมเงินกระเป๋าตัวเอง'
    ].join('\n');
    const slip=parseSlipText(text);
    expect(slip.amountSatang).toBe(15000);
    expect(slip.date).toBe('2026-10-11');
    expect(slip.time).toBe('17:55');
    expect(slip.method).toBe('wallet');
    expect(slip.recipient).toBe('พร้อมเพย์ อี-วอลเล็ต / G-Wallet');
    expect(slip.direction).toBeNull();
    expect(slip.directionReason).toContain('ไม่บันทึกเป็นรายจ่ายอัตโนมัติ');
    const noisySecondPass=parseSlipText(text.replace('เติมเงินสำเร็จ','ชำระเงินสำเร็จ'));
    const merged=mergeSlipOcrReadings(slip,noisySecondPass);
    expect(merged.direction).toBeNull();
    expect(merged.directionReason).toContain('เติมเงินเข้า e-Wallet');
    expect(prepareAutoSlip(merged,[],'recover',Date.now()).status).toBe('incomplete');
    const decision=prepareAutoSlip(slip,[],'funding',Date.now());
    expect(decision.status).toBe('incomplete');
    if(decision.status==='incomplete')expect(decision.reason).toContain('ป้องกันยอดซ้ำ');
  });

  it('auto-saves a fully read K PLUS TrueMoney top-up as bank outflow',()=>{
    // Fictional names, masked account and reference; based on actual layout,
    // not on any user's private identifiers or uploaded bank screenshot.
    const text=[
      'เติมเงินสำเร็จ','15 ต.ค. 69 14:00 น.','นาย ตัวอย่าง ผู้ส่ง',
      'ธ.กสิกรไทย','xxx-x-x0000-x','ทรูมันนี่','0000000000',
      'จำนวน:','1,000.00 บาท','ค่าธรรมเนียม:','0.00 บาท',
      'เลขที่รายการ: TESTTOPUP20261015000001',
    ].join('\\n');
    const slip=parseSlipText(text);
    expect(slip).toMatchObject({
      amountSatang:100000,date:'2026-10-15',time:'14:00',
      recipient:'ทรูมันนี่',direction:'expense',method:'bank',
      sender:'นาย ตัวอย่าง ผู้ส่ง',
    });
    expect(slip.receipt).toMatchObject({source:'kplus',paidSatang:100000});
    const saved=prepareAutoSlip(slip,[],'truemoney',Date.now());
    expect(saved.status).toBe('ready');
    if(saved.status==='ready')expect(saved.transaction.note).toContain('เติมเงิน TrueMoney');
    const merged=mergeSlipOcrReadings(slip,parseSlipText(text));
    expect(merged.direction).toBe('expense');
    expect(prepareAutoSlip(merged,[],'merged',Date.now()).status).toBe('ready');
  });

  it('does not classify a third-party TrueMoney funding slip as my expense when owner names differ',()=>{
    const text=[
      'เติมเงินสำเร็จ','15 ต.ค. 69 14:00 น.','นาย ตัวอย่าง ผู้ส่ง',
      'ธ.กสิกรไทย','xxx-x-x0000-x','TrueMoney','0000000000',
      'จำนวน:','1,000.00 บาท','ค่าธรรมเนียม: 0.00 บาท',
    ].join('\\n');
    expect(parseSlipText(text,[],['นาย บุคคลอื่น']).direction).toBeNull();
    expect(parseSlipText(text,[],['นาย ตัวอย่าง ผู้ส่ง']).direction).toBe('expense');
    expect(prepareAutoSlip(parseSlipText(text,[],['นาย บุคคลอื่น']),[],'unowned',Date.now()).status).toBe('incomplete');
  });

  it('does not turn unverified or unreadable TrueMoney top-ups into auto-saved expenses',()=>{
    const noMasked=['เติมเงินสำเร็จ','15 ต.ค. 69 14:00 น.','TrueMoney','จำนวน: 1,000.00 บาท'].join('\\n');
    expect(prepareAutoSlip(parseSlipText(noMasked),[],'missing-bank',Date.now()).status).toBe('incomplete');
    const noAmount=[
      'เติมเงินสำเร็จ','15 ต.ค. 69 14:00 น.','นาย ตัวอย่าง ผู้ส่ง',
      'ธ.กสิกรไทย','xxx-x-x0000-x','ทรูมันนี่','จำนวน:','อ่านไม่ชัด',
      'ค่าธรรมเนียม 0.00 บาท',
    ].join('\\n');
    expect(prepareAutoSlip(parseSlipText(noAmount),[],'missing-amount',Date.now()).status).toBe('incomplete');
  });

  it('does not infer wallet top-up without K PLUS sender evidence',()=>{
    const slip=parseSlipText('เติมเงินสำเร็จ\n11 ต.ค. 69 17:55 น.\nG-Wallet\nจำนวน: 150.00 บาท');
    expect(slip.direction).toBeNull();
    expect(slip.method).toBeUndefined();
  });

  it('does not count two different genuine 25-baht payments as duplicates',()=>{
    const a=prepareAutoSlip(parseSlipText(fixture(cases[1],1).text),[],'one',Date.now());
    const b=prepareAutoSlip(parseSlipText(fixture(cases[2],2).text),a.status==='ready'?[a.transaction]:[],'two',Date.now());
    expect(a.status).toBe('ready');
    expect(b.status).toBe('ready');
  });
});

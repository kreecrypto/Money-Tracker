import {describe,expect,it} from 'vitest';
import {parseSlipText} from '../src/lib/slip';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';

const report=[
  'ตรวจสลิป',
  'สถานะ: ตรวจสอบสลิปสำเร็จ',
  'ชื่อผู้โอน: นาย สมมติ ตัวอย่าง',
  'โอนจาก: ธนาคารกสิกรไทย จำกัด (มหาชน)',
  'ชื่อผู้รับ: บจก. ร้านเกมตัวอย่าง',
  'โอนถึง: ธนาคารกสิกรไทย จำกัด (มหาชน)',
  'เลขอ้างอิง: 012345678901ATF00001',
  'ยอดเงิน: 390.00',
  'วันที่: 25/10/2026',
  'เวลา: 18:46:23',
].join('\n');

describe('labelled scan-inspection summary (fictional examples)',()=>{
  it('reads names, two bank labels, reference, exact displayed time and satang',()=>{
    const slip=parseSlipText(report,[],['นาย สมมติ ตัวอย่าง']);
    expect(slip).toMatchObject({
      sender:'นาย สมมติ ตัวอย่าง',senderBank:'ธนาคารกสิกรไทย จำกัด (มหาชน)',
      recipient:'บจก. ร้านเกมตัวอย่าง',recipientBank:'ธนาคารกสิกรไทย จำกัด (มหาชน)',
      reference:'012345678901ATF00001',reportedStatus:'ตรวจสอบสลิปสำเร็จ',
      date:'2026-10-25',time:'18:46',timeWithSeconds:'18:46:23',
      amountSatang:39000,direction:'expense',
    });
    expect(slip.receipt).toMatchObject({source:'kplus',receiptId:'012345678901ATF00001',paidSatang:39000});
    const saved=prepareAutoSlip(slip,[],'new-record',Date.now());
    expect(saved.status).toBe('ready');
    if(saved.status==='ready'){
      expect(saved.transaction.amountSatang).toBe(39000);
      expect(saved.transaction.time).toBe('18:46');
      expect(saved.transaction.receipt?.receiptId).toBe('012345678901ATF00001');
      expect(prepareAutoSlip(slip,[saved.transaction],'again',Date.now()).status).toBe('duplicate');
    }
  });

  it('does not classify bank-verified wording as proof of an outgoing transfer',()=>{
    const slip=parseSlipText(report);
    expect(slip.direction).toBeNull();
    expect(prepareAutoSlip(slip,[],'pending',Date.now()).status).toBe('incomplete');
  });

  it('classifies the same transfer as income when the owner is the recipient',()=>{
    const slip=parseSlipText(report,[],['บจก. ร้านเกมตัวอย่าง']);
    expect(slip.direction).toBe('income');
  });

  it('holds a report with failed status instead of recording a payment',()=>{
    const slip=parseSlipText(report.replace('สถานะ: ตรวจสอบสลิปสำเร็จ','สถานะ: ตรวจสอบสลิปไม่สำเร็จ'),[],['นาย สมมติ ตัวอย่าง']);
    expect(slip.warnings.some(w=>w.includes('ขัดแย้ง'))).toBe(true);
    expect(prepareAutoSlip(slip,[],'failed',Date.now()).status).toBe('incomplete');
  });

  it('holds contradictory references rather than picking a supposedly valid one',()=>{
    const slip=parseSlipText(report+'\nเลขอ้างอิง: 987654321098ATF00001',[],['นาย สมมติ ตัวอย่าง']);
    expect(slip.reference).toBeNull();
    expect(slip.warnings.some(w=>w.includes('ขัดแย้ง'))).toBe(true);
    expect(prepareAutoSlip(slip,[],'conflict',Date.now()).status).toBe('incomplete');
  });

  it('never treats an unlabelled reference, fee or bank name as a payment amount',()=>{
    const input=report.replace('ยอดเงิน: 390.00','ค่าธรรมเนียม: 0.00');
    const slip=parseSlipText(input,[],['นาย สมมติ ตัวอย่าง']);
    expect(slip.amountSatang).toBeNull();
    expect(prepareAutoSlip(slip,[],'no-amount',Date.now()).status).toBe('incomplete');
  });
});

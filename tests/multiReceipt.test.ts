import {describe,it,expect} from 'vitest';
import {parseSlipText,needsSlipOcrRecovery} from '../src/lib/slip';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';

const sevenEleven=[
  'รายการสั่งซื้อที่ร้านและ 7Delivery',
  '12/10/69 | 13:44',
  'เลขที่ใบเสร็จ DEMO-RECEIPT-1',
  'สาขา 7-Eleven ประวิทย์และเพื่อน 2',
  'รหัสร้าน: SAMPLE-STORE',
  'รายการสินค้า',
  '1 น้ำด่าง 30.00',
  '1 โค้กไลท์ 325 มล. 16.00',
  '1 ผัก 18.00',
  'ยอดสุทธิ 3 ชิ้น 64.00',
  'ทรูวอลเล็ต7App 64.00',
  'TID#SAMPLE-RECEIPT-ID',
].join('\n');

const paotang=[
  'ไทยช่วยไทยพลัส 60/40',
  'เป๋าตัง',
  'ทำรายการสำเร็จ',
  'รหัสอ้างอิง SAMPLE-WALLET-REF',
  '12 ต.ค. 2569 16:40 น.',
  'ผู้จ่าย',
  'G-Wallet ID: **** ******** 8913',
  '↓',
  'ใจแอนท์ สควิด',
  'อาหาร ของหวาน เครื่องดื่ม',
  'ค่าสินค้า/บริการ 40 บาท',
  'สิทธิไทยช่วยไทยพลัส -24 บาท',
  'จำนวนเงินที่ชำระ: 16 บาท',
].join('\n');

function decision(raw:string) {
  return prepareAutoSlip(parseSlipText(raw),[],'receipt-test-id',12345);
}

describe('Multi-receipt OCR: 7-Eleven and Paotang',()=>{
  it('extracts net paid 64, not line items (30/16/18), from 7Delivery receipt',()=>{
    const slip=parseSlipText(sevenEleven);
    expect(slip).toMatchObject({
      source:'seven_eleven',
      direction:'expense',
      date:'2026-10-12',
      time:'13:44',
      amountSatang:6400,
      recipient:'7-Eleven — ประวิทย์และเพื่อน 2',
      method:'wallet',
      category:'อาหารและเครื่องดื่ม',
    });
    expect(needsSlipOcrRecovery(slip)).toBe(false);
    const saved=decision(sevenEleven);
    expect(saved.status).toBe('ready');
    if(saved.status==='ready'){
      expect(saved.transaction.amountSatang).toBe(6400);
      expect(saved.transaction.type).toBe('expense');
      expect(saved.transaction.method).toBe('wallet');
    }
  });

  it('counts only actual Paotang wallet payment 16, not gross 40 or subsidy 24',()=>{
    const slip=parseSlipText(paotang);
    expect(slip).toMatchObject({
      source:'paotang',
      direction:'expense',
      date:'2026-10-12',
      time:'16:40',
      amountSatang:1600,
      recipient:'ใจแอนท์ สควิด',
      method:'wallet',
      category:'อาหารและเครื่องดื่ม',
    });
    const saved=decision(paotang);
    expect(saved.status).toBe('ready');
    if(saved.status==='ready')expect(saved.transaction.amountSatang).toBe(1600);
  });

  it('does not automatically record 7-Eleven carts without an actual payment line',()=>{
    const text=sevenEleven.replace('ทรูวอลเล็ต7App 64.00','');
    const slip=parseSlipText(text);
    expect(slip.amountSatang).toBeNull();
    expect(decision(text).status).toBe('incomplete');
  });

  it('rejects an inconsistent 7-Eleven receipt total versus amount paid',()=>{
    const text=sevenEleven.replace('ทรูวอลเล็ต7App 64.00','ทรูวอลเล็ต7App 63.00');
    expect(parseSlipText(text).amountSatang).toBeNull();
    expect(decision(text).status).toBe('incomplete');
  });

  it('rejects ambiguous 7-Eleven tender lines with different payment amounts',()=>{
    const text=sevenEleven.replace('ทรูวอลเล็ต7App 64.00','ทรูวอลเล็ต7App 64.00\nเงินสด 10.00');
    expect(parseSlipText(text).amountSatang).toBeNull();
    expect(decision(text).status).toBe('incomplete');
  });

  it('does not use goods price or subsidy as paid amount when Paotang paid line is missing',()=>{
    const text=paotang.replace('จำนวนเงินที่ชำระ: 16 บาท','');
    expect(parseSlipText(text).amountSatang).toBeNull();
    expect(decision(text).status).toBe('incomplete');
  });

  it('rejects Paotang wallet receipts without a detectable merchant',()=>{
    const text=paotang.replace('ใจแอนท์ สควิด','');
    expect(parseSlipText(text).recipient).toBeNull();
    expect(decision(text).status).toBe('incomplete');
  });

  it('does not mistake the Paotang payer for the shop name',()=>{
    const slip=parseSlipText(paotang.replace('ผู้จ่าย','ชื่อผู้จ่าย กรีฑาพล'));
    expect(slip.recipient).toBe('ใจแอนท์ สควิด');
  });

  it('blocks duplicates of imported Paotang receipts',()=>{
    const d=decision(paotang);
    if(d.status!=='ready')throw new Error('fixture should be valid');
    const repeat=prepareAutoSlip(parseSlipText(paotang),[d.transaction],'new-receipt',23456);
    expect(repeat.status).toBe('duplicate');
  });

  it('still supports original K PLUS slips and records bank method',()=>{
    const text='จ่ายบิลสำเร็จ\n12 ต.ค. 69 13:15 น.\nธ.กสิกรไทย\nxxx-x-x0000-x\nSYNPHAET BANGNA\nCO.,LTD.\nจำนวน:\n2,948.00 บาท';
    const d=decision(text);
    expect(d.status).toBe('ready');
    if(d.status==='ready')expect(d.transaction.method).toBe('bank');
  });
});

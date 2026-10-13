import {describe,it,expect} from 'vitest';
import {prepareAutoSlip} from './slipAutoSave';
import {parseSlipText} from './slip';
import {summarizeSlipBatch,validateSlipImage} from './slipBatch';
import type {SlipFields} from './slip';
import type {Transaction} from './finance';

const photoHash='a'.repeat(64);
function payment(overrides:Partial<SlipFields>={}):SlipFields{
  return {
    amountSatang:1600,date:'2026-10-13',time:'07:25',
    recipient:'ลุงม่อนรสกาแฟ',direction:'expense',
    directionReason:'เงินออกจาก G-Wallet',source:'paotang',
    method:'wallet',category:'อาหารและเครื่องดื่ม',
    receipt:{
      source:'paotang',receiptId:'34b4dc6d82d045f6a7cca49ddae96db7',
      items:[],subtotalSatang:4000,subsidySatang:2400,
      paidSatang:1600,itemsComplete:true,
    },
    rawText:'',warnings:[],imageHash:photoHash,...overrides,
  };
}
describe('slip-first OCR save safety',()=>{
  it('records actual money paid after subsidy, not the 40 baht item total',()=>{
    const decision=prepareAutoSlip(payment(),[],'id-paotang',Date.now());
    expect(decision.status).toBe('ready');
    if(decision.status==='ready'){
      expect(decision.transaction.amountSatang).toBe(1600);
      expect(decision.transaction.receipt?.subsidySatang).toBe(2400);
      expect(decision.transaction.slipHash).toBe(photoHash);
    }
  });
  it('rejects re-importing exact image bytes even when the next OCR reading is incomplete',()=>{
    const ready=prepareAutoSlip(payment(),[],'id-1',Date.now());
    expect(ready.status).toBe('ready');
    if(ready.status!=='ready')return;
    const rescan=payment({time:null,recipient:null,amountSatang:null});
    const duplicate=prepareAutoSlip(rescan,[ready.transaction],'id-2',Date.now());
    expect(duplicate.status).toBe('duplicate');
  });
  it('does not treat same amount and date at another shop as duplicate',()=>{
    const ready=prepareAutoSlip(payment(),[],'id-1',Date.now());
    if(ready.status!=='ready')throw new Error('Initial transaction is not ready');
    const next=payment({recipient:'ร้านอื่น',imageHash:'b'.repeat(64),receipt:{...payment().receipt!,receiptId:'unique-other-reference'}});
    expect(prepareAutoSlip(next,[ready.transaction],'id-2',Date.now()).status).toBe('ready');
  });
  it('does not treat manual records without a time as a proven duplicate',()=>{
    const manual:Transaction={
      id:'manual',type:'expense',amountSatang:1600,category:'อาหารและเครื่องดื่ม',
      method:'wallet',date:'2026-10-13',recipient:'ลุงม่อนรสกาแฟ',
      note:'',createdAt:Date.now(),
    };
    expect(prepareAutoSlip(payment(),[manual],'new',Date.now()).status).toBe('ready');
  });
  it('blocks contradictory wallet subsidy math without a review',()=>{
    const malformed=payment({receipt:{...payment().receipt!,subsidySatang:2300}});
    expect(prepareAutoSlip(malformed,[],'id-bad',Date.now()).status).toBe('incomplete');
  });
});
describe('receipt OCR sample layouts',()=>{
  it('recognizes 7Delivery itemized 64 baht tender as one expense',()=>{
    const text=[
      '7Delivery','12/10/69 13:44',
      'สาขา 7-Eleven ประวิทย์และเพื่อน 2','รายการสินค้า',
      '1 น้ำด่างพีเอชพลัส 30.00',
      '1 โค้กไลท์ 325 มล. 16.00',
      '1 เห็ดนกไพร เวฟ 18.00',
      'ยอดสุทธิ 3 ชิ้น 64.00','ทรูวอลเล็ต7App 64.00',
      'TID#202610120000005349686789',
    ].join('\n');
    const result=parseSlipText(text);
    expect(result.source).toBe('seven_eleven');
    expect(result.amountSatang).toBe(6400);
    expect(result.date).toBe('2026-10-12');
    expect(result.time).toBe('13:44');
    expect(result.receipt?.itemsComplete).toBe(true);
    expect(result.receipt?.items.length).toBe(3);
  });
  it('recognizes actual G-Wallet payment after subsidy',()=>{
    const text=[
      'เป๋าตัง','ทำรายการสำเร็จ',
      '13 ต.ค. 2569 07:25 น.',
      'G-Wallet ID: **** **** 8913',
      'ลุงม่อนรสกาแฟ',
      'อาหาร ของหวาน เครื่องดื่ม',
      'ค่าสินค้า/บริการ 40 บาท',
      'สิทธิไทยช่วยไทยพลัส -24 บาท',
      'จำนวนเงินที่ชำระ 16 บาท',
      'รหัสอ้างอิง 34b4dc6d82d045f6a7cca49ddae96db7',
    ].join('\n');
    const result=parseSlipText(text);
    expect(result.source).toBe('paotang');
    expect(result.amountSatang).toBe(1600);
    expect(result.date).toBe('2026-10-13');
    expect(result.time).toBe('07:25');
    expect(result.receipt?.subsidySatang).toBe(2400);
  });
});
describe('batch uploader',()=>{
  it('accepts Apple Photos HEIC while preserving 10MB safety gate',()=>{
    expect(validateSlipImage({type:'image/heic',size:10000,name:'IMG_2710.HEIC'})).toBeNull();
    expect(validateSlipImage({type:'',size:10000,name:'IMG_2710.heif'})).toBeNull();
    expect(validateSlipImage({type:'image/heic',size:12*1024*1024,name:'too-large.heic'})).not.toBeNull();
  });
  it('distinguishes pending corrections from cancelled and undone records',()=>{
    const summary=summarizeSlipBatch([
      {name:'a',status:'saved'},{name:'b',status:'duplicate'},
      {name:'c',status:'incomplete'},{name:'d',status:'cancelled'},
      {name:'e',status:'undone'},
    ]);
    expect(summary).toMatchObject({total:5,saved:1,duplicate:1,incomplete:1,cancelled:1,undone:1});
  });
});

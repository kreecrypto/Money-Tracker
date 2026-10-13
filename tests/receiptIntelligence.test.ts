import {describe,expect,it} from 'vitest';
import {parseSlipText,needsSlipOcrRecovery} from '../src/lib/slip';
import {receiptLayoutLines} from '../src/lib/receiptIntelligence';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';
import {parseBackup,createBackup,toCsv} from '../src/lib/backup';
import {summarize,type Transaction} from '../src/lib/finance';

const seven=[
  'รายการสั่งซื้อที่ร้านและ 7Delivery','12/10/69 | 13:44',
  'สาขา 7-Eleven ตัวอย่าง','รายการสินค้า',
  '1 น้ำด่าง 30.00','1 โค้กไลท์ 325 มล. 16.00','1 ผัก 18.00',
  'ยอดสุทธิ 3 ชิ้น 64.00','ทรูวอลเล็ต7App 64.00','TID#SAMPLE12345678'
].join('\n');
const wallet=[
  'ไทยช่วยไทยพลัส 60/40','เป๋าตัง','ทำรายการสำเร็จ',
  'รหัสอ้างอิง SAMPLE12345678','12 ต.ค. 2569 16:40 น.',
  'G-Wallet ID: **** ******** 0000','↓','ร้านตัวอย่าง','อาหาร ของหวาน เครื่องดื่ม',
  'ค่าสินค้า/บริการ 40 บาท','สิทธิไทยช่วยไทยพลัส -24 บาท','จำนวนเงินที่ชำระ: 16 บาท'
].join('\n');
const save=(text:string)=>{
  const parsed=parseSlipText(text);
  const result=prepareAutoSlip(parsed,[],'test',42);
  if(result.status!=='ready')throw Error(result.reason);
  return result.transaction;
};
describe('receipt intelligence',()=>{
 it('persists three products and counts 7-Eleven paid money only once',()=>{
   const tx=save(seven);
   expect(tx.receipt?.items.map(i=>i.lineTotalSatang)).toEqual([3000,1600,1800]);
   expect(tx.receipt?.itemsComplete).toBe(true);
   expect(tx.receipt?.receiptId).toBe('SAMPLE12345678');
   expect(summarize([tx]).expense).toBe(6400);
 });
 it('preserves wallet gross, subsidy and paid 16 without double counting',()=>{
   const tx=save(wallet);
   expect(tx.receipt).toMatchObject({subtotalSatang:4000,subsidySatang:2400,paidSatang:1600});
   expect(summarize([tx]).expense).toBe(1600);
 });
 it('blocks auto-saving incomplete products or incorrect subsidy equations',()=>{
   const incomplete=parseSlipText(seven.replace('1 ผัก 18.00',''));
   expect(needsSlipOcrRecovery(incomplete)).toBe(true);
   expect(prepareAutoSlip(incomplete,[],'test2',43).status).toBe('incomplete');
   const mismatch=parseSlipText(wallet.replace('-24 บาท','-20 บาท'));
   expect(prepareAutoSlip(mismatch,[],'test3',43).status).toBe('incomplete');
 });
 it('exports receipt items and roundtrips JSON alongside legacy transactions',()=>{
   const tx=save(seven);
   const old:Transaction={id:'old',type:'expense',amountSatang:2000,category:'อื่น ๆ',note:'old',date:'2026-10-12',method:'cash',createdAt:1};
   expect(parseBackup(createBackup([tx,old],{monthlyBudgetSatang:1000})).transactions).toEqual([tx,old]);
   expect(toCsv([tx])).toContain('โค้กไลท์');
 });
 it('joins separate OCR word blocks into visually aligned item rows',()=>{
   const bbox=(x0:number,y0:number,x1:number,y1:number)=>({x0,y0,x1,y1});
   const blocks=[
     {paragraphs:[{lines:[{words:[{text:'รายการสินค้า',bbox:bbox(10,10,80,25)}]},{words:[{text:'1',bbox:bbox(10,40,15,56)},{text:'น้ำด่าง',bbox:bbox(23,40,80,56)}]}]}]},
     {paragraphs:[{lines:[{words:[{text:'30.00',bbox:bbox(150,41,195,56)}]}]}]},
   ];
   expect(receiptLayoutLines(blocks)).toContain('1 น้ำด่าง 30.00');
 });
});

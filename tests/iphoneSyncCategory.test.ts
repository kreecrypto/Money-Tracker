import {describe,expect,it} from 'vitest';
import {reconcileGmailCategory} from '../src/lib/iphoneSync';
import type {Transaction} from '../src/lib/finance';

const original:Transaction={
  id:'iphone-example',type:'expense',amountSatang:2500,category:'อื่น ๆ',
  note:'นำเข้าจาก K PLUS Gmail',date:'2026-09-15',time:'12:30',
  recipient:'ร้านค้าตัวอย่าง',method:'bank',createdAt:1
};
const cloud:Transaction={
  ...original,category:'อาหารและเครื่องดื่ม',
  note:'นำเข้าจาก K PLUS Gmail | หมวดย่อย: อาหาร/ร้านอาหาร'
};
describe('Gmail category enrichment during iPhone sync',()=>{
  it('enriches untouched imported records without changing money or recipient',()=>{
    const updated=reconcileGmailCategory(original,cloud);
    expect(updated).toMatchObject({category:'อาหารและเครื่องดื่ม',note:cloud.note});
    expect(updated?.amountSatang).toBe(original.amountSatang);
    expect(updated?.recipient).toBe(original.recipient);
    expect(updated?.date).toBe(original.date);
  });
  it('never overrides local custom categories or notes',()=>{
    expect(reconcileGmailCategory({...original,category:'ช้อปปิ้ง'},cloud)?.category).toBe('ช้อปปิ้ง');
    expect(reconcileGmailCategory({...original,note:'ค่าอาหารจริง'},cloud)).toBeNull();
  });
  it('rejects mismatched financial identity or unrecognized cloud note',()=>{
    expect(reconcileGmailCategory(original,{...cloud,amountSatang:3000})).toBeNull();
    expect(reconcileGmailCategory(original,{...cloud,date:'2026-09-16'})).toBeNull();
    expect(reconcileGmailCategory(original,{...cloud,note:'ธนาคารแก้ข้อความ'})).toBeNull();
    expect(reconcileGmailCategory(cloud,cloud)).toBeNull();
  });
  it('keeps wallet top-ups expenses and adds an explicit subtype',()=>{
    const topup={...original,note:'เติมเงิน K PLUS (Gmail)'};
    const updated=reconcileGmailCategory(topup,{...topup,note:topup.note+' | หมวดย่อย: เติมเงิน e-Wallet/มือถือ'});
    expect(updated?.type).toBe('expense');
    expect(updated?.note).toContain('เติมเงิน e-Wallet');
  });
});

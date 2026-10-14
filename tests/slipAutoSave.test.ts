import {describe,expect,it} from 'vitest';
import {parseSlipText,type SlipFields} from '../src/lib/slip';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';
import type {Transaction} from '../src/lib/finance';

const bill=()=>{
  const result=parseSlipText([
    'จ่ายบิลสำเร็จ',
    '12 ต.ค. 69 13:15 น.',
    'นาย ผู้ชำระเงิน',
    'ธ.กสิกรไทย',
    'xxx-x-x0000-x',
    'SYNPHAET BANGNA',
    'CO.,LTD.',
    '000000000000000',
    'จำนวน:',
    '2,948.00 บาท',
    'ค่าธรรมเนียม: 0.00 บาท',
  ].join('\n'));
  return result;
};
const decide=(slip:SlipFields,items:Transaction[]=[])=>
  prepareAutoSlip(slip,items,'new-slip-1',1234);

describe('slip upload -> immediate auto save (without review)',()=>{
  it('builds a valid K PLUS expense transaction with all 4 fields',()=>{
    const saved=decide(bill());
    expect(saved.status).toBe('ready');
    if(saved.status!=='ready')throw new Error(saved.reason);
    expect(saved.transaction).toEqual({
      id:'new-slip-1',
      type:'expense',
      amountSatang:294800,
      date:'2026-10-12',
      time:'13:15',
      recipient:'SYNPHAET BANGNA CO.,LTD.',
      sender:'นาย ผู้ชำระเงิน',
      category:'อื่น ๆ',
      note:'',
      method:'bank',
      receipt:{source:'kplus',items:[],itemsComplete:true,paidSatang:294800,storeName:'SYNPHAET BANGNA CO.,LTD.'},
      createdAt:1234,
    });
  });

  it('creates an income record from an explicit received-money slip',()=>{
    const slip=parseSlipText('รับเงินสำเร็จ\nวันที่ 12 ต.ค. 69 10:35\nผู้รับ: คนรับ เงินดี\nจำนวนเงิน 500.00 บาท');
    const decision=decide(slip);
    expect(decision.status).toBe('ready');
    if(decision.status==='ready')expect(decision.transaction.type).toBe('income');
  });

  it('rejects missing direction instead of silently categorizing a transfer as expense',()=>{
    const slip=parseSlipText('โอนเงินสำเร็จ\nวันที่ 12 ต.ค. 69 10:35\nถึง คนรับ เงินดี\nจำนวนเงิน 500.00 บาท');
    expect(decide(slip).status).toBe('incomplete');
  });

  it.each(['amountSatang','date','time','recipient'] as const)(
    'does not save when the %s field is missing',field=>{
      expect(decide({...bill(),[field]:null}).status).toBe('incomplete');
    }
  );

  it('does not save conflicting readings',()=>{
    const result=decide({...bill(),warnings:['OCR อ่านจำนวนเงินต่างกันระหว่างสองรอบ']});
    expect(result.status).toBe('incomplete');
  });

  it('blocks an identical receipt from being imported twice',()=>{
    const first=decide(bill());
    if(first.status!=='ready')throw new Error('invalid fixture');
    const second=decide(bill(),[first.transaction]);
    expect(second.status).toBe('duplicate');
  });

  it('recognizes duplicate payees with harmless punctuation differences',()=>{
    const first=decide(bill());
    if(first.status!=='ready')throw new Error('invalid fixture');
    const incoming=[{...first.transaction,recipient:'Synphaet Bangna Co. Ltd.'}];
    expect(decide(bill(),incoming).status).toBe('duplicate');
  });

  it('does not block different genuine payments at distinct minutes',()=>{
    const first=decide(bill());
    if(first.status!=='ready')throw new Error('invalid fixture');
    const later={...bill(),time:'13:16'};
    expect(decide(later,[first.transaction]).status).toBe('ready');
  });

  it('protects against legacy imports without a time field',()=>{
    const first=decide(bill());
    if(first.status!=='ready')throw new Error('invalid fixture');
    const existing={...first.transaction,time:undefined};
    expect(decide(bill(),[existing]).status).toBe('duplicate');
  });

  it('cannot save an impossible transaction date or time',()=>{
    expect(decide({...bill(),date:'2026-02-30'}).status).toBe('incomplete');
    expect(decide({...bill(),time:'25:90'}).status).toBe('incomplete');
  });
});
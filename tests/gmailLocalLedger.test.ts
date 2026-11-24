import {describe,it,expect} from 'vitest';
import {paymentLedgerRow} from '../server/gmail/mailbox';
import {parseEmailLedgerCsv,partitionEmailLedger} from '../src/lib/emailLedger';

const headers=(subject:string,auth=true)=>[
  {name:'From',value:'K PLUS <kplus@kasikornbank.com>'},
  {name:'Subject',value:subject},
  ...(auth?[{name:'Authentication-Results',value:'mx.google.com; dkim=pass header.d=kasikornbank.com'}]:[])
];
const body=(fee='0.00')=>[
  'วันที่ทำรายการ: 22/11/2026 06:51:01',
  'เลขที่รายการ: TEST20261122001',
  'ชำระเงินจากบัญชี: xxx-x-x0000-x',
  'เพื่อเข้าบัญชีร้านค้า/บริษัท: ร้านทดสอบ',
  'จำนวนเงิน (บาท): 45.00',
  'ค่าธรรมเนียม (บาท): '+fee,
  'ยอดถอนได้ (บาท): 900.00',
  'Transaction Date: 22/11/2026 06:51:01',
  'Transaction Number: TEST20261122001',
  'Paid From Account: xxx-x-x0000-x',
  'For: ร้านทดสอบ',
  'Amount (THB): 45.00',
  'Fee (THB): '+fee,
].join('\n');
const row=(subject='Result of QR Payment (Success)',fee='0.00',auth=true)=>paymentLedgerRow(
  {payload:{mimeType:'text/plain',headers:headers(subject,auth),body:{data:Buffer.from(body(fee)).toString('base64url')}}},'abcd1234567890','test@example.net');
const csv=(rows:string[][])=>[
  ['วันที่','เวลา','ผู้รับเงิน/ร้านค้า','รายละเอียดชี้แจง','หมวดหมู่','จำนวนเงิน','ค่าธรรมเนียม','สถานะ','รวมรายจ่าย','เลขอ้างอิง','Gmail URL'],
  ...rows
].map(r=>r.map(x=>'"'+x.replace(/"/g,'""')+'"').join(',')).join('\r\n');
describe('Gmail local ledger preview',()=>{
  it('imports a confirmed QR payment with exact satang and same reference duplicate protection',()=>{
    const parsed=parseEmailLedgerCsv(csv([row()]));
    expect(parsed.confirmed).toHaveLength(1);
    expect(parsed.confirmed[0]).toMatchObject({id:'email-TEST20261122001',amountSatang:4500,date:'2026-11-22',time:'06:51',recipient:'ร้านทดสอบ'});
    expect(partitionEmailLedger(parsed.confirmed,parsed.confirmed).ready).toHaveLength(0);
  });
  it('holds unverified sender, unknown transfers, and nonzero fee outside totals',()=>{
    const parsed=parseEmailLedgerCsv(csv([row('Result of Funds Transfer (Success)'),row(undefined,'1.00'),row(undefined,'0.00',false)]));
    expect(parsed.confirmed).toHaveLength(0);
    expect(parsed.excluded).toHaveLength(3);
  });
});

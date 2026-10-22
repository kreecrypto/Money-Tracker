import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {isKplusSender,parseKplusEmail} from '../server/gmail/kplusEmail';
import {POST} from '../api/gmail/import';

const outgoing=[
  'วันที่ทำรายการ: 22/10/2026 07:41:20',
  'เลขที่รายการ: 261022ATF001234567',
  'โอนเงินจากบัญชี',
  'ชื่อ : ร้านค้าตัวอย่าง',
  'จำนวนเงิน (บาท): 250.00',
  'Transaction Date: 22/10/2026 07:41:20',
  'Transaction Number: 261022ATF001234567',
  'From Account',
  'Received Name : ร้านค้าตัวอย่าง',
  'Amount (THB): 250.00'
].join('\n');
const incoming=[
  'แจ้งเงินเข้าบัญชี',
  'วันที่ทำรายการ: 22/10/2026 08:01:19',
  'เลขที่รายการ: 261022INC001234567',
  'ชื่อผู้โอน : บริษัทตัวอย่าง',
  'จำนวนเงิน (บาท): 1,234.50',
  'Transaction Date: 22/10/2026 08:01:19',
  'Transaction Number: 261022INC001234567',
  'Amount (THB): 1,234.50'
].join('\n');
describe('K PLUS Gmail income / expense parser',()=>{
  it('accepts known K PLUS sender, not lookalike domains',()=>{
    expect(isKplusSender('K PLUS <KPLUS@kasikornbank.com>')).toBe(true);
    expect(isKplusSender('kplus@kasikornbank.com.attacker.test')).toBe(false);
  });
  it('saves outgoing transfer using transaction amount, not the balance or bilingual duplicate',()=>{
    const x=parseKplusEmail('Result of Funds Transfer (Success)',outgoing+'\nยอดถอนได้ (บาท): 99,999.99');
    expect(x).toMatchObject({status:'ready',type:'expense',amountSatang:25000,date:'2026-10-22',time:'07:41',reference:'261022ATF001234567'});
  });
  it('recognizes explicit incoming credit as income with a payer',()=>{
    expect(parseKplusEmail('แจ้งเงินเข้าบัญชี',incoming)).toMatchObject({
      status:'ready',type:'income',amountSatang:123450,date:'2026-10-22',
      reference:'261022INC001234567',sender:'บริษัทตัวอย่าง'
    });
  });
  it('does not save failures, self transfers, conflicting bilingual totals, or missing references',()=>{
    expect(parseKplusEmail('Result of Funds Transfer (Failure)',outgoing).status).toBe('skipped');
    expect(parseKplusEmail('Result of Funds Transfer (Success)',outgoing,['ร้านค้าตัวอย่าง'])).toMatchObject({status:'skipped',reason:'OWN_ACCOUNT_TRANSFER'});
    expect(parseKplusEmail('Result of Funds Transfer (Success)',outgoing.replace('Amount (THB): 250.00','Amount (THB): 350.00')).status).toBe('pending');
    expect(parseKplusEmail('แจ้งเงินเข้าบัญชี',incoming.replace('เลขที่รายการ: 261022INC001234567','').replace('Transaction Number: 261022INC001234567','')).status).toBe('pending');
  });
  it('does not infer income from Received Name on an outgoing transfer',()=>{
    expect(parseKplusEmail('Result of Funds Transfer (Success)',outgoing).type).toBe('expense');
  });
});
describe('Gmail import API trust boundary',()=>{
  beforeEach(()=>vi.stubEnv('GMAIL_IMPORT_TOKEN','A'.repeat(64)));
  afterEach(()=>vi.unstubAllEnvs());
  const post=(token:string,body:object)=>new Request('https://test.example/api/gmail/import',{
    method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  it('does not permit missing or invalid credentials',async()=>{
    const request=post('B'.repeat(64),{messageId:'0123456789abcdef',from:'kplus@kasikornbank.com',subject:'แจ้งเงินเข้าบัญชี',text:incoming});
    expect((await POST(request)).status).toBe(401);
  });
  it('rejects forged senders, even with valid token',async()=>{
    const r=await POST(post('A'.repeat(64),{
      messageId:'0123456789abcdef',from:'kplus@kasikornbank.com.evil.test',subject:'แจ้งเงินเข้าบัญชี',text:incoming
    }));
    expect(r.status).toBe(400);
  });
  it('fails closed when the dedicated token is not configured',async()=>{
    vi.stubEnv('GMAIL_IMPORT_TOKEN','');
    const r=await POST(post('A'.repeat(64),{
      messageId:'0123456789abcdef',from:'kplus@kasikornbank.com',subject:'แจ้งเงินเข้าบัญชี',text:incoming
    }));
    expect(r.status).toBe(503);
  });
});

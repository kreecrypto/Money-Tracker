import {describe,it,expect} from 'vitest';
import {parseBankNotice} from '../server/line/bank';

const kbankSample=[
  'KBank Live',
  'รายการโอน/ถอน',
  '9 ต.ค. 69 18:44 น.',
  'จากบัญชี xxx-x-x5839-x',
  'จำนวนเงิน -119.00 บาท',
  'ยอดเงินคงเหลือ 400,070.79 บาท',
  'ดูรายละเอียดที่ K PLUS'
].join('\n');

describe('Forwarded bank notification parser',()=>{
  it('reads a transfer expense without accidentally reading the large account balance',()=>{
    const x=parseBankNotice(kbankSample);
    expect(x).toMatchObject({
      bank:'kbank',type:'expense',amountSatang:11900,date:'2026-10-09',time:'18:44',
      requiresConfirmation:true
    });
    expect(x?.fingerprintSource).toContain('11900');
    expect(x?.fingerprintSource).not.toContain('400,070');
  });
  it('reads a banking notification forwarded as plain text',()=>{
    expect(parseBankNotice('KBank รับโอน 9 ต.ค. 69 18:44 น. จำนวนเงิน 200.50 บาท ยอดเงินคงเหลือ 8,000.00 บาท'))
      .toMatchObject({type:'income',amountSatang:20050,date:'2026-10-09'});
  });
  it('handles Thai-digit amounts and abbreviated Buddhist years',()=>{
    const r=parseBankNotice('K PLUS โอน/ถอน ๙ ต.ค. ๖๙ 18:44 น. จำนวนเงิน -๑๑๙.๐๐ บาท');
    expect(r).toMatchObject({amountSatang:11900,date:'2026-10-09'});
  });
  it('does not parse a bank balance as a transaction',()=>{
    expect(parseBankNotice('KBank ยอดเงินคงเหลือ 400,070.79 บาท')).toBeNull();
  });
  it('does not parse ambiguous in/out notifications',()=>{
    expect(parseBankNotice('รายการรับโอนและโอนออก 9 ต.ค. 69 จำนวนเงิน 150 บาท')).toBeNull();
  });
  it('does not accept an invalid calendar date',()=>{
    const r=parseBankNotice('รายการโอน/ถอน 32 ต.ค. 69 จำนวนเงิน -119.00 บาท');
    expect(r?.date).toBeNull();
  });
  it('does not accept a zero amount',()=>{
    expect(parseBankNotice('รายการโอน/ถอน 9 ต.ค. 69 จำนวนเงิน 0 บาท')).toBeNull();
  });
});

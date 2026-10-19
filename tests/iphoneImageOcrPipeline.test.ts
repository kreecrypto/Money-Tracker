import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {extractBankDraft} from '../server/iphone/ocr';

const KPLUS_IMAGE_OCR=[
  'K PLUS','โอนเงินสำเร็จ','13 ต.ค. 69 12:05 น.',
  'จากบัญชี xxx-x-x0123-x','ผู้รับเงิน: ร้านค้าตัวอย่าง',
  'จำนวนเงิน 119.00 บาท','ค่าธรรมเนียม 0.00 บาท',
  'เลขที่รายการ 123456789012345'
].join('\n');

describe('P0 K PLUS upload-image OCR extraction',()=>{
  it('extracts K PLUS amount, date, time and payee instead of discarding bank slip parsing',()=>{
    const result=extractBankDraft(KPLUS_IMAGE_OCR);
    expect(result).toMatchObject({
      amount_satang:11900,
      transaction_date:'2026-10-13',
      transaction_time:'12:05',
      recipient:'ร้านค้าตัวอย่าง',
      source_label:'KBank'
    });
    expect(result.note).not.toContain('123456789012345');
  });

  it('never reads balance-only KBank notification screenshots as transactions',()=>{
    const result=extractBankDraft('KBank Live\nยอดเงินคงเหลือ 400,070.79 บาท\n9 ต.ค. 69');
    expect(result.amount_satang).toBeNull();
    expect(result.type).toBeNull();
  });

  it('still parses an explicit KBank Live debit without taking its account balance',()=>{
    const result=extractBankDraft([
      'KBank Live','รายการโอน/ถอน','9 ต.ค. 69 18:44 น.',
      'จำนวนเงิน -119.00 บาท','ยอดเงินคงเหลือ 400,070.79 บาท'
    ].join('\n'));
    expect(result).toMatchObject({
      amount_satang:11900,
      type:'expense',
      transaction_date:'2026-10-09',
      transaction_time:'18:44',
      recipient:null
    });
  });

  it('does not substitute a notice fallback when a K PLUS slip has conflicting totals',()=>{
    const result=extractBankDraft([
      'K PLUS','โอนเงินสำเร็จ','13 ต.ค. 69 12:05 น.',
      'ผู้รับเงิน: ร้านค้าตัวอย่าง',
      'จำนวนเงิน 119.00 บาท',
      'จำนวนเงิน 999.00 บาท',
      'ยอดเงินคงเหลือ 400,070.79 บาท'
    ].join('\n'));
    expect(result.amount_satang).toBeNull();
  });
});

const mocks=vi.hoisted(()=>({ocr:vi.fn(),save:vi.fn()}));
vi.mock('../server/iphone/ocr',async importOriginal=>{
  const real=await importOriginal<typeof import('../server/iphone/ocr')>();
  return {...real,ocrImage:mocks.ocr};
});
vi.mock('../server/iphone/bridge',async importOriginal=>{
  const real=await importOriginal<typeof import('../server/iphone/bridge')>();
  return {...real,saveDraft:mocks.save};
});
import {POST} from '../api/iphone/upload';

beforeEach(()=>{
  vi.stubEnv('IPHONE_UPLOAD_TOKEN','A'.repeat(64));
  vi.stubEnv('IPHONE_REVIEW_TOKEN','B'.repeat(64));
  mocks.ocr.mockReset();
  mocks.save.mockReset();
});
afterEach(()=>vi.unstubAllEnvs());

describe('P1 image upload to private pending draft integration',()=>{
  it('sends recognized amount/date/time/recipient to persistence without saving a financial total',async()=>{
    mocks.ocr.mockResolvedValue(extractBankDraft(KPLUS_IMAGE_OCR));
    mocks.save.mockResolvedValue({id:'11111111-2222-4333-8444-555555555555'});
    const data=new FormData();
    data.set('image',new File([new Uint8Array([137,80,78,71,13,10,26,10])],
      'fixture.png',{type:'image/png'}));
    const request=new Request('https://money-tracker-api.example/api/iphone/upload',{
      method:'POST',headers:{authorization:'Bearer '+'A'.repeat(64)},body:data
    });
    const response=await POST(request);
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({status:'pending',reviewRequired:true});
    expect(mocks.save).toHaveBeenCalledOnce();
    const row=mocks.save.mock.calls[0][0];
    expect(row).toMatchObject({
      amount_satang:11900,
      transaction_date:'2026-10-13',
      transaction_time:'12:05',
      recipient:'ร้านค้าตัวอย่าง',
      source_label:'KBank'
    });
    expect(row.image_digest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain('123456789012345');
  });

  it('does not write an image when its upload token is invalid',async()=>{
    const data=new FormData();
    data.set('image',new File([new Uint8Array([137,80,78,71,13,10,26,10])],
      'fixture.png',{type:'image/png'}));
    const response=await POST(new Request('https://money-tracker-api.example/api/iphone/upload',{
      method:'POST',headers:{authorization:'Bearer '+'C'.repeat(64)},body:data
    }));
    expect(response.status).toBe(401);
    expect(mocks.ocr).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
import {inspectPhotosOCR} from '../server/iphone/photos';

const KPLUS=[
  'K PLUS','โอนเงินสำเร็จ','9 ต.ค. 69','จำนวนเงิน 119.00 บาท',
  'ผู้รับเงิน: ABC','เลขที่รายการ 123456789'
].join('\n');
const KPLUS_IOS27_PHOTO_TEXT=[
  'โอนเงินสำเร็จ',
  '11 ต.ค. 69 21:09 น.',
  'นาย ตัวอย่าง',
  'ธ.กสิกรไทย',
  'xxx-x-x6721-x',
  'จำนวน:',
  '0.01 บาท',
  'ค่าธรรมเนียม:',
  '0.00 บาท',
  'เลขที่รายการ',
  '016284210922BTF06060'
].join('\n');
const KBANK_ALERT=[
  'KBank Live','รายการโอน/ถอน','9 ต.ค. 69 18:44 น.',
  'จำนวนเงิน -119.00 บาท','ยอดเงินคงเหลือ 400,070.79 บาท'
].join('\n');
describe('iOS 26 Photos on-device OCR receipt classifier',()=>{
  it('accepts iOS 27 K PLUS Extract Text from Photos with จำนวน: amount on the next line',()=>{
    const x=inspectPhotosOCR(KPLUS_IOS27_PHOTO_TEXT);
    expect(x).toMatchObject({accept:true,reason:'receipt',amountSatang:1,date:'2026-10-11',type:null});
    expect(x.note).not.toContain('0.00');
  });
  it('does not substitute the fee for a missing จำนวน: amount',()=>{
    const x=inspectPhotosOCR('K PLUS\nโอนเงินสำเร็จ\n11 ต.ค. 69\nจำนวน:\nค่าธรรมเนียม: 60.00 บาท');
    expect(x.amountSatang).toBeNull();
  });
  it('accepts K PLUS transfer slip, leaving direction to user confirmation',()=>{
    const x=inspectPhotosOCR(KPLUS);
    expect(x).toMatchObject({accept:true,amountSatang:11900,date:'2026-10-09',type:null});
    expect(x.sourceLabel).toContain('KBank');
  });
  it('accepts a bank notification with explicit amount but excludes balances',()=>{
    const x=inspectPhotosOCR(KBANK_ALERT);
    expect(x).toMatchObject({accept:true,amountSatang:11900,type:'expense',date:'2026-10-09'});
    expect(x.note).not.toContain('400,070');
  });
  it('rejects other bank OCR text even with transfer and amount labels',()=>{
    const scb=inspectPhotosOCR('SCB ไทยพาณิชย์\nโอนเงินสำเร็จ\nจำนวนเงิน 199.00 บาท');
    expect(scb).toMatchObject({accept:false,reason:'unsupported_bank'});
    const ktb=inspectPhotosOCR('Krungthai กรุงไทย\nโอนเงินสำเร็จ\nจำนวนเงิน 199.00 บาท');
    expect(ktb).toMatchObject({accept:false,reason:'unsupported_bank'});
  });
  it('uses explicit K PLUS transaction references for stable deduplication',()=>{
    const first=inspectPhotosOCR(KPLUS_IOS27_PHOTO_TEXT);
    const second=inspectPhotosOCR(KPLUS_IOS27_PHOTO_TEXT.replace('นาย ตัวอย่าง','คุณ ตัวอย่าง'));
    expect(first.accept).toBe(true);
    expect(first.fingerprint).toBeTruthy();
    expect(first.fingerprint).toEqual(second.fingerprint);
    expect(first.note).not.toContain('016284210922BTF06060');
  });
  it('rejects personal photos that contain money amounts but no bank transaction',()=>{
    expect(inspectPhotosOCR('อาหาร 119 บาท ร้านอาหาร วันนี้ 9 ต.ค. 69').accept).toBe(false);
  });
  it('rejects balance-only banking screenshots',()=>{
    const x=inspectPhotosOCR('KBank Live รายการโอน/ถอน 9 ต.ค. 69 ยอดเงินคงเหลือ 400,070.79 บาท');
    expect(x).toMatchObject({accept:false,reason:'no_transaction_amount'});
  });
  it('rejects transaction amount without receipt context',()=>{
    expect(inspectPhotosOCR('จดหมายจากเพื่อน จำนวนเงิน 119.00 บาท ไม่เกี่ยวกับธนาคาร').accept).toBe(false);
  });
  it('never uses balance from next OCR line as amount',()=>{
    const x=inspectPhotosOCR([
      'K PLUS โอนเงินสำเร็จ','จำนวนเงิน','ยอดเงินคงเหลือ 400,070.79 บาท'
    ].join('\n'));
    expect(x.accept).toBe(true);
    expect(x.amountSatang).toBeNull();
  });
  it('rejects unrecognized and empty OCR text',()=>{
    expect(inspectPhotosOCR(' ').accept).toBe(false);
    expect(inspectPhotosOCR('รูปภาพมีแต่ต้นไม้และท้องฟ้า').accept).toBe(false);
  });
  it('keeps normalized values stable across whitespace/different endings',()=>{
    const x=inspectPhotosOCR(KPLUS);
    const y=inspectPhotosOCR(KPLUS.replace(/\n/g,'\r\n'));
    expect(x.normalizedText).toBe(y.normalizedText);
  });
});
const mock=vi.hoisted(()=>({save:vi.fn()}));
vi.mock('../server/iphone/bridge',async importOriginal=>{
  const real=await importOriginal<typeof import('../server/iphone/bridge')>();
  return {...real,saveDraft:mock.save};
});
import {POST} from '../api/iphone/photos';
const UPLOAD='B'.repeat(64),REVIEW='A'.repeat(64);
function post(text:string,token=UPLOAD,contentType='application/json',direction?:'income'|'expense'){
  return new Request('https://example.com/api/iphone/photos',{
    method:'POST',headers:{authorization:'Bearer '+token,'content-type':contentType},
    body:JSON.stringify({text,...(direction?{direction}:{})})
  });
}
beforeEach(()=>{
  process.env.IPHONE_UPLOAD_TOKEN=UPLOAD;
  process.env.IPHONE_REVIEW_TOKEN=REVIEW;
  mock.save.mockResolvedValue({id:'16d66fb6-ddb7-47dc-ac0c-2d977277e10e'});
});
afterEach(()=>{
  delete process.env.IPHONE_UPLOAD_TOKEN;delete process.env.IPHONE_REVIEW_TOKEN;
  vi.clearAllMocks();
});
describe('Photos Automation OCR text API',()=>{
  it('rejects unknown bearer token',async()=>{
    expect((await POST(post(KPLUS,'C'.repeat(64)))).status).toBe(401);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('fails closed when environment secret is missing',async()=>{
    delete process.env.IPHONE_UPLOAD_TOKEN;
    expect((await POST(post(KPLUS))).status).toBe(503);
  });
  it('rejects other content types',async()=>{
    expect((await POST(post(KPLUS,UPLOAD,'text/plain'))).status).toBe(415);
  });
  it('skips non-slip OCR without writing to database',async()=>{
    const r=await POST(post('วันนี้ซื้อของกิน 119 บาท ร้านกาแฟ'));
    expect((await r.json())).toMatchObject({status:'skipped',reason:'not_receipt'});
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('never stores unsupported bank transactions',async()=>{
    const r=await POST(post('SCB ไทยพาณิชย์\nโอนเงินสำเร็จ\nจำนวนเงิน 199.00 บาท'));
    expect((await r.json())).toMatchObject({status:'skipped',reason:'unsupported_bank'});
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('auto-saves a complete outgoing KBank notice; never stores raw OCR or balances',async()=>{
    const r=await POST(post(KBANK_ALERT));
    expect(r.status).toBe(201);
    expect((await r.json())).toMatchObject({status:'saved',reviewRequired:false});
    const row=mock.save.mock.calls[0][0];
    expect(row).toMatchObject({amount_satang:11900,transaction_date:'2026-10-09',
      transaction_time:'18:44',type:'expense',method:'bank',source_label:'KBank / Photos'});
    expect(mock.save.mock.calls[0][1]).toBe('confirmed');
    const serialized=JSON.stringify(row);
    expect(serialized).not.toContain('400,070.79');
    expect(serialized).not.toContain('เลขที่');
    expect(serialized).not.toContain('KBank Live');
  });
  it('auto-saves an outgoing transfer slip only with an explicit Shortcut direction hint',async()=>{
    const r=await POST(post(KPLUS_IOS27_PHOTO_TEXT,UPLOAD,'application/json','expense'));
    expect(r.status).toBe(201);
    expect((await r.json())).toMatchObject({status:'saved',reviewRequired:false});
    const row=mock.save.mock.calls[0][0];
    expect(row).toMatchObject({type:'expense',amount_satang:1,transaction_date:'2026-10-11',
      transaction_time:'21:09'});
    expect(mock.save.mock.calls[0][1]).toBe('confirmed');
  });
  it('retains a generic transfer as pending if no direction can be established',async()=>{
    const r=await POST(post(KPLUS));
    expect(r.status).toBe(202);
    expect((await r.json())).toMatchObject({status:'pending',reviewRequired:true,missingFields:['direction']});
    expect(mock.save.mock.calls[0][1]).toBe('pending');
  });
  it('rejects a conflicting direction hint rather than reversing an incoming transfer',async()=>{
    const r=await POST(post(KBANK_ALERT,UPLOAD,'application/json','income'));
    expect(r.status).toBe(422);
    expect((await r.json())).toMatchObject({reason:'DIRECTION_CONFLICT'});
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('skips amount-unreadable bank text instead of guessing the balance as payment',async()=>{
    const text='KBank Live\\nรายการโอน/ถอน\\n9 ต.ค. 69 18:44 น.\\nจำนวนเงิน\\nยอดเงินคงเหลือ 400,070.79 บาท';
    const r=await POST(post(text));
    expect(r.status).toBe(200);
    expect((await r.json())).toMatchObject({status:'skipped',reason:'no_transaction_amount'});
    expect(mock.save).not.toHaveBeenCalled();
  });
  it('returns duplicate instead of creating new pending item',async()=>{
    mock.save.mockResolvedValue(null);
    const r=await POST(post(KPLUS));
    expect((await r.json())).toMatchObject({status:'duplicate'});
  });
  it('rejects untrusted malformed JSON',async()=>{
    const r=await POST(new Request('https://example.com/api/iphone/photos',{
      method:'POST',headers:{authorization:'Bearer '+UPLOAD,'content-type':'application/json'},
      body:'{bad'
    }));
    expect(r.status).toBe(400);
  });
});

import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
import {inspectPhotosOCR} from '../server/iphone/photos';

const KPLUS=[
  'K PLUS','โอนเงินสำเร็จ','9 ต.ค. 69','จำนวนเงิน 119.00 บาท',
  'ผู้รับเงิน: ABC','เลขที่รายการ 123456789'
].join('\n');
const KBANK_ALERT=[
  'KBank Live','รายการโอน/ถอน','9 ต.ค. 69 18:44 น.',
  'จำนวนเงิน -119.00 บาท','ยอดเงินคงเหลือ 400,070.79 บาท'
].join('\n');
describe('iOS 26 Photos on-device OCR receipt classifier',()=>{
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
function post(text:string,token=UPLOAD,contentType='application/json'){
  return new Request('https://example.com/api/iphone/photos',{
    method:'POST',headers:{authorization:'Bearer '+token,'content-type':contentType},
    body:JSON.stringify({text})
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
  it('stages only parsed private values; no raw OCR or balances in db payload',async()=>{
    const r=await POST(post(KBANK_ALERT));
    expect(r.status).toBe(202);
    expect((await r.json())).toMatchObject({status:'pending',reviewRequired:true});
    const row=mock.save.mock.calls[0][0];
    expect(row).toMatchObject({amount_satang:11900,status:undefined,
      method:'bank',source_label:'KBank / Photos'});
    const serialized=JSON.stringify(row);
    expect(serialized).not.toContain('400,070.79');
    expect(serialized).not.toContain('เลขที่');
    expect(serialized).not.toContain('KBank Live');
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

import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {auth,imageType,MAX_IMAGE_BYTES,ownerKey} from '../server/iphone/bridge';
import {extractBankDraft} from '../server/iphone/ocr';

const owner='A'.repeat(64),uploader='B'.repeat(64);
beforeEach(()=>{
  process.env.IPHONE_UPLOAD_TOKEN=uploader;
  process.env.IPHONE_REVIEW_TOKEN=owner;
  process.env.IPHONE_ALLOWED_APP_ORIGIN='https://money-tracker-beta-teal.vercel.app';
});
afterEach(()=>{
  delete process.env.IPHONE_UPLOAD_TOKEN;delete process.env.IPHONE_REVIEW_TOKEN;
  delete process.env.IPHONE_ALLOWED_APP_ORIGIN;
});
describe('iOS 26 Shortcut bank image security',()=>{
  it('requires a 256-bit upload bearer token and never permits review token for upload',()=>{
    const req=(value?:string)=>new Request('https://example.com/api/iphone/upload',{
      headers:value?{authorization:'Bearer '+value}:{}
    });
    expect(auth(req(),'upload')).toBe('unauthorized');
    expect(auth(req('C'.repeat(64)),'upload')).toBe('unauthorized');
    expect(auth(req(owner),'upload')).toBe('unauthorized');
    expect(auth(req(uploader),'upload')).toBe('ok');
    expect(auth(req(uploader),'review')).toBe('unauthorized');
  });
  it('fails closed when credentials are not configured',()=>{
    delete process.env.IPHONE_UPLOAD_TOKEN;
    expect(auth(new Request('https://example.com'),'upload')).toBe('unconfigured');
  });
  it('keys rows to reviewer identity, not to the public uploader token',()=>{
    const hash=ownerKey();expect(hash).toHaveLength(64);
    expect(hash).not.toContain(owner);
    expect(hash).not.toEqual(uploader);
  });
  it('does not trust a text/plain or spoofed JPG body',()=>{
    expect(imageType(new Uint8Array([1,2,3,4]),'image/jpeg')).toBe(false);
    expect(imageType(new Uint8Array([255,216,255,0]),'image/png')).toBe(false);
    expect(imageType(new Uint8Array([255,216,255,0]),'image/jpeg')).toBe(true);
    expect(imageType(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png')).toBe(true);
  });
  it('caps image payload below Vercel request size',()=>{
    expect(MAX_IMAGE_BYTES).toBeLessThan(4.5*1024*1024);
  });
});
describe('OCR conservative bank parsing',()=>{
  const alert='KBank Live\\nรายการโอน/ถอน\\n9 ต.ค. 69 18:44 น.\\nจำนวนเงิน -119.00 บาท\\nยอดเงินคงเหลือ 400,070.79 บาท';
  it('selects the transaction amount and ignores balance',()=>{
    const d=extractBankDraft(alert.replaceAll('\\n','\n'));
    expect(d).toMatchObject({source_label:'KBank',type:'expense',
      amount_satang:11900,transaction_date:'2026-10-09',method:'bank'});
    expect(JSON.stringify(d)).not.toContain('400,070.79');
  });
  it('refuses to infer bank amount when only balance OCR is readable',()=>{
    const d=extractBankDraft('KBank Live\\nยอดเงินคงเหลือ 400,070.79 บาท');
    expect(d.amount_satang).toBeNull();
    expect(d.type).toBeNull();
  });
  it('keeps unsupported OCR results as review-required blank fields',()=>{
    const d=extractBankDraft('ภาพเบลอจนอ่านไม่ออก');
    expect(d.amount_satang).toBeNull();
    expect(d.transaction_date).toBeNull();
  });
});
vi.mock('../server/iphone/ocr',async importOriginal=>({...await importOriginal<typeof import('../server/iphone/ocr')>(),ocrImage:vi.fn(async()=>({
  amount_satang:11900,type:'expense',transaction_date:'2026-10-09',
  category:'อื่น ๆ',note:'KBank review',method:'bank',
  source_label:'KBank',bank_fingerprint:'test-event'
}))}));
vi.mock('../server/iphone/bridge',async importOriginal=>{
  const original=await importOriginal<typeof import('../server/iphone/bridge')>();
  return {...original,
    saveDraft:vi.fn(async()=>({id:'38dbeb1a-df38-43bc-b4b3-ea3f74f198c9'})),
    pendingDrafts:vi.fn(async()=>[]),
    confirmedDrafts:vi.fn(async()=>[]),
    reviewDraft:vi.fn(async()=>({id:'38dbeb1a-df38-43bc-b4b3-ea3f74f198c9',status:'confirmed'}))
  };
});
import {POST as upload} from '../api/iphone/upload';
import {GET as drafts,POST as review} from '../api/iphone/drafts';
import {GET as ledger} from '../api/iphone/ledger';
const image=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
function requestUpload(token=uploader,file=true){
  const data=new FormData();
  if(file)data.append('image',new File([image],'kbank.png',{type:'image/png'}));
  return new Request('https://bridge.example/api/iphone/upload',{
    method:'POST',headers:{authorization:'Bearer '+token},body:data
  });
}
function appRequest(path:string,token=owner,origin='https://money-tracker-beta-teal.vercel.app'){
  return new Request('https://bridge.example'+path,{headers:{authorization:'Bearer '+token,origin}});
}
describe('HTTP Shortcuts upload and app review flow',()=>{
  it('rejects unauthenticated screenshots before OCR',async()=>{
    const r=await upload(requestUpload('C'.repeat(64)));
    expect(r.status).toBe(401);
  });
  it('rejects missing file',async()=>{
    const r=await upload(requestUpload(uploader,false));expect(r.status).toBe(400);
  });
  it('accepts an authorized PNG into PENDING queue, never saves directly',async()=>{
    const r=await upload(requestUpload());expect(r.status).toBe(202);
    expect(await r.json()).toMatchObject({status:'pending',reviewRequired:true});
  });
  it('rejects unauthorized web origins even with a valid token',async()=>{
    const r=await drafts(appRequest('/api/iphone/drafts',owner,'https://evil.test'));
    expect(r.status).toBe(403);
  });
  it('rejects upload-only token from reading financial drafts',async()=>{
    const r=await drafts(appRequest('/api/iphone/drafts',uploader));expect(r.status).toBe(401);
  });
  it('lists pending and confirmed entries only with owner review token',async()=>{
    expect((await drafts(appRequest('/api/iphone/drafts'))).status).toBe(200);
    expect((await ledger(appRequest('/api/iphone/ledger'))).status).toBe(200);
  });
  it('rejects confirmation without a valid amount',async()=>{
    const r=await review(new Request('https://bridge.example/api/iphone/drafts',{
      method:'POST',headers:{authorization:'Bearer '+owner,origin:'https://money-tracker-beta-teal.vercel.app',
        'content-type':'application/json'},
      body:JSON.stringify({id:'38dbeb1a-df38-43bc-b4b3-ea3f74f198c9',
        decision:'confirm',type:'expense',amountSatang:0,date:'2026-10-09',
        category:'อื่น ๆ',note:'KBank',method:'bank'})
    }));
    expect(r.status).toBe(400);
  });
  it('confirms only a valid transaction with a manual review',async()=>{
    const r=await review(new Request('https://bridge.example/api/iphone/drafts',{
      method:'POST',headers:{authorization:'Bearer '+owner,origin:'https://money-tracker-beta-teal.vercel.app',
        'content-type':'application/json'},
      body:JSON.stringify({id:'38dbeb1a-df38-43bc-b4b3-ea3f74f198c9',
        decision:'confirm',type:'expense',amountSatang:11900,date:'2026-10-09',
        category:'อื่น ๆ',note:'KBank',method:'bank'})
    }));
    expect(r.status).toBe(200);
  });
});

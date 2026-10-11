import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {privatePath,expired,imageSummary,mimeExtension,type ImageRow} from '../server/iphone/imageStorage';
const owner='a'.repeat(64),review='B'.repeat(64);
const validId='6bbd12e4-c4c0-4cb2-b66f-2bf434563820';
function row(expiresAt:string):ImageRow {
  return {id:validId,owner_key:owner,image_digest:'d'.repeat(64),bank_fingerprint:null,
    status:'pending',type:'expense',amount_satang:5000,transaction_date:'2026-10-10',
    category:'อื่น ๆ',note:'',method:'bank',source_label:'KBank',created_at:'2026-10-10T10:00:00Z',
    reviewed_at:null,image_status:'available',image_bucket:'money-tracker-slip-temp',
    image_path:'drafts/'+owner.slice(0,12)+'/'+validId+'.png',image_mime:'image/png',
    image_size_bytes:1024,image_uploaded_at:'2026-10-10T10:00:00Z',
    image_expires_at:expiresAt,image_deleted_at:null,
    image_delete_attempts:0,image_last_error_code:null};
}
describe('private slip retention — paths and exact deadline',()=>{
  it('stores files only in opaque server-generated paths',()=>{
    expect(privatePath(owner,validId,'image/png')).toBe('drafts/'+owner.slice(0,12)+'/'+validId+'.png');
    expect(()=>privatePath(owner,'../../danger','image/png')).toThrow();
    expect(()=>privatePath(owner,validId,'text/html')).toThrow();
    expect(mimeExtension('image/jpeg')).toBe('jpg');
  });
  it('denies image access at exact 168-hour boundary',()=>{
    const at='2026-10-17T10:00:00.000Z',ms=Date.parse(at);
    expect(expired(row(at),ms-1)).toBe(false);
    expect(expired(row(at),ms)).toBe(true);
    expect(expired(row(at),ms+1)).toBe(true);
  });
  it('retains financial fields even if image has expired',()=>{
    const draft=row('2026-10-09T10:00:00.000Z');
    const image=imageSummary(draft);
    expect(image.available).toBe(false);
    expect(draft.amount_satang).toBe(5000);
    expect(draft.status).toBe('pending');
  });
});
vi.mock('../server/iphone/imageStorage',async importOriginal=>{
  const base=await importOriginal<typeof import('../server/iphone/imageStorage')>();
  return {...base,
    readDraft:vi.fn(async()=>row('2026-10-17T10:00:00.000Z')),
    getImage:vi.fn(async()=>new Response(new Uint8Array([137,80,78,71,13,10,26,10]),{
      headers:{'content-type':'image/png'}})),
    purgeCandidates:vi.fn(async()=>[]),
    purgeRow:vi.fn(async()=>({deleted:true}))
  };
});
import {GET as readImage} from '../api/iphone/image';
import {POST as cleanup} from '../api/iphone/cleanup';
import * as storage from '../server/iphone/imageStorage';

beforeEach(()=>{
  process.env.IPHONE_REVIEW_TOKEN=review;
  process.env.IPHONE_ALLOWED_APP_ORIGIN='https://money-tracker-beta-teal.vercel.app';
  process.env.SLIP_CLEANUP_SECRET='C'.repeat(64);
  vi.mocked(storage.getImage).mockClear();
  vi.mocked(storage.readDraft).mockReset();
  vi.mocked(storage.readDraft).mockResolvedValue(row(new Date(Date.now()+600000).toISOString()));
});
afterEach(()=>{
  delete process.env.IPHONE_REVIEW_TOKEN;
  delete process.env.IPHONE_ALLOWED_APP_ORIGIN;
  delete process.env.SLIP_CLEANUP_SECRET;
});
function requestImage(origin='https://money-tracker-beta-teal.vercel.app',token=review){
  return new Request('https://api.example/api/iphone/image?id='+validId,{
    headers:{authorization:'Bearer '+token,origin}});
}
describe('private preview proxy and cleanup auth',()=>{
  it('rejects evil origin before trying storage',async()=>{
    expect((await readImage(requestImage('https://evil.example'))).status).toBe(403);
    expect(storage.getImage).not.toHaveBeenCalled();
  });
  it('rejects upload/invalid token',async()=>{
    expect((await readImage(requestImage(undefined,'A'.repeat(64)))).status).toBe(401);
  });
  it('never retrieves an expired image from storage',async()=>{
    vi.mocked(storage.readDraft).mockResolvedValue(row(new Date(Date.now()-1000).toISOString()));
    expect((await readImage(requestImage())).status).toBe(410);
    expect(storage.getImage).not.toHaveBeenCalled();
  });
  it('requires a review token to retrieve private bytes',async()=>{
    const result=await readImage(requestImage());
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toContain('no-store');
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
    expect(result.headers.get('access-control-allow-origin')).toBe('https://money-tracker-beta-teal.vercel.app');
  });
  it('denies discarded images even if their path remains briefly',async()=>{
    vi.mocked(storage.readDraft).mockResolvedValue({...row(new Date(Date.now()+600000).toISOString()),status:'discarded'});
    expect((await readImage(requestImage())).status).toBe(404);
  });
  it('requires a completely separate secret for the hourly deletion job',async()=>{
    const req=(token:string)=>new Request('https://api.example/api/iphone/cleanup',{
      method:'POST',headers:{authorization:'Bearer '+token}});
    expect((await cleanup(req(review))).status).toBe(401);
    expect((await cleanup(req('C'.repeat(64)))).status).toBe(200);
  });
});

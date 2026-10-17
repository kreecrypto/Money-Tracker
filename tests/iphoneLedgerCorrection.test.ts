import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const mock=vi.hoisted(()=>({
  update:vi.fn(async(_id:string,_recipient:string|null)=>true),
  rows:vi.fn(async()=>[])
}));
vi.mock('../server/iphone/bridge',async importOriginal=>{
  const original=await importOriginal<typeof import('../server/iphone/bridge')>();
  return {...original,correctConfirmedRecipient:mock.update,confirmedDrafts:mock.rows};
});
import {GET,POST} from '../api/iphone/ledger';

const owner='a'.repeat(64);
const id='38dbeb1a-df38-43bc-b4b3-ea3f74f198c9';
const base='https://money-tracker-beta-teal.vercel.app';
const request=(body:unknown,token=owner,origin=base)=>new Request(base+'/api/iphone/ledger',{
  method:'POST',headers:{authorization:'Bearer '+token,origin,'content-type':'application/json'},
  body:JSON.stringify(body)
});
beforeEach(()=>{
  process.env.IPHONE_REVIEW_TOKEN=owner;
  process.env.IPHONE_ALLOWED_APP_ORIGIN=base;
  mock.update.mockReset();mock.update.mockResolvedValue(true);
});
afterEach(()=>{
  delete process.env.IPHONE_REVIEW_TOKEN;
  delete process.env.IPHONE_ALLOWED_APP_ORIGIN;
});
describe('iPhone confirmed ledger recipient repair',()=>{
  it('rejects requests lacking a Review Token',async()=>{
    expect((await POST(request({id,recipient:null},'b'.repeat(64)))).status).toBe(401);
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests even with Review Token',async()=>{
    expect((await POST(request({id,recipient:null},owner,'https://evil.test'))).status).toBe(403);
  });
  it('rejects forged ID, unknown keys and promotional artwork as names',async()=>{
    for(const payload of [
      {id:'not-uuid',recipient:null},
      {id,recipient:'THAILAND'},
      {id,recipient:'THAILAND 2026'},
      {id,recipient:'ร้าน',amountSatang:100},
      {id,recipient:1}
    ])expect((await POST(request(payload))).status).toBe(400);
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('clears the wrong name without updating amounts, dates or category',async()=>{
    const res=await POST(request({id,recipient:null}));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({status:'updated'});
    expect(mock.update).toHaveBeenCalledWith(id,null);
  });
  it('supports explicit name correction and refuses unknown confirmed entries',async()=>{
    expect((await POST(request({id,recipient:'  ร้านค้าตัวอย่าง  '}))).status).toBe(200);
    expect(mock.update).toHaveBeenCalledWith(id,'ร้านค้าตัวอย่าง');
    mock.update.mockResolvedValueOnce(false);
    expect((await POST(request({id,recipient:'ร้านค้าตัวอย่าง'}))).status).toBe(404);
  });
  it('still requires an authenticated ledger read',async()=>{
    const res=await GET(new Request(base+'/api/iphone/ledger'));
    expect(res.status).toBe(401);
  });
});
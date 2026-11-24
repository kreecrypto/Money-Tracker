import {beforeEach,describe,expect,it,vi} from 'vitest';
const bridge=vi.hoisted(()=>({review:vi.fn(),auth:vi.fn()}));
vi.mock('../server/iphone/bridge.js',()=>({
  auth:bridge.auth,appCors:()=>({}),options:()=>new Response(null,{status:204}),
  json:(body:object,status=200)=>Response.json(body,{status}),
  pendingDrafts:vi.fn(),reviewDraft:bridge.review
}));
import {POST} from '../api/iphone/drafts';
const payload={id:'11111111-1111-4111-8111-111111111111',decision:'confirm',type:'expense',amountSatang:1250,date:'2026-11-01',category:'อื่น ๆ',note:'synthetic',method:'bank',recipient:'Fixture shop'};
function req(time:string){return new Request('https://fixture.example/api/iphone/drafts',{method:'POST',body:JSON.stringify({...payload,time})});}
beforeEach(()=>{bridge.auth.mockReset().mockReturnValue('ok');bridge.review.mockReset().mockResolvedValue({id:payload.id,status:'confirmed'});});
describe('Cloud draft confirmation time',()=>{
  it.each(['00:00','08:36','19:59','23:59'])('accepts %s',async time=>{
    const response=await POST(req(time));expect(response.status).toBe(200);
    expect(bridge.review).toHaveBeenCalledWith(payload.id,'confirm',expect.objectContaining({time}));
  });
  it.each(['24:00','12:60','8:36','08:3x'])('rejects %s',async time=>{
    expect((await POST(req(time))).status).toBe(400);expect(bridge.review).not.toHaveBeenCalled();
  });
  it('does not write without review authorization',async()=>{
    bridge.auth.mockReturnValue('unauthorized');
    expect((await POST(req('08:36'))).status).toBe(401);expect(bridge.review).not.toHaveBeenCalled();
  });
});

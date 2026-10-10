import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({
  read:vi.fn(),insert:vi.fn(),review:vi.fn(),fingerprint:vi.fn(),
  issue:vi.fn(),revoke:vi.fn()
}));
vi.mock('../server/line/ocr',()=>({readLineBankImage:mock.read}));
vi.mock('../server/line/storage',()=>({
  insertLineRow:mock.insert,reviewLineRow:mock.review,fingerprint:mock.fingerprint
}));
vi.mock('../server/line/link',()=>({
  issuePairCode:mock.issue,revokeLineSession:mock.revoke
}));
import {POST,verifyLineSignature} from '../api/line/webhook';

const user='U'+'a'.repeat(32);
function event(message:object, eventId='bank-evt-1'){
  return {type:'message',webhookEventId:eventId,replyToken:'token-'+eventId,
    source:{type:'user',userId:user},message};
}
async function send(events:object[],secret='test-channel-secret'){
  const body=JSON.stringify({events});
  const signed=new Uint8Array(await crypto.subtle.sign(
    'HMAC',await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'HMAC',false,['sign']),
    new TextEncoder().encode(body)
  ));
  const signature=btoa(String.fromCharCode(...signed));
  return POST(new Request('https://example.test/api/line/webhook',{
    method:'POST',headers:{'x-line-signature':signature,'content-type':'application/json'},
    body
  }));
}
const notice=[
  'KBank Live','รายการโอน/ถอน','9 ต.ค. 69 18:44 น.',
  'จากบัญชี xxx-x-x5839-x','จำนวนเงิน -119.00 บาท',
  'ยอดเงินคงเหลือ 400,070.79 บาท'
].join('\n');
describe('Secure LINE bank forward flow',()=>{
  let sent:Array<unknown>=[];
  beforeEach(()=>{
    process.env.LINE_CHANNEL_SECRET='test-channel-secret';
    process.env.LINE_CHANNEL_ACCESS_TOKEN='test-access-token';
    process.env.LINE_ALLOWED_USER_IDS=user;
    process.env.SUPABASE_URL='https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY='test-role';
    sent=[];
    vi.stubGlobal('fetch',vi.fn(async(_u:string,opts?:{body?:string})=>{
      if(opts?.body)sent.push(JSON.parse(opts.body));
      return new Response('{}',{status:200});
    }));
    mock.insert.mockResolvedValue(true);
    mock.fingerprint.mockResolvedValue('test-fingerprint');
    mock.read.mockResolvedValue(notice);
    mock.review.mockResolvedValue('confirmed');
    mock.issue.mockResolvedValue('ABCDEF0123456789ABCD');
  });
  afterEach(()=>{
    vi.unstubAllGlobals();vi.clearAllMocks();
    for(const k of ['LINE_CHANNEL_SECRET','LINE_CHANNEL_ACCESS_TOKEN','LINE_ALLOWED_USER_IDS','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'])delete process.env[k];
  });
  it('rejects unsigned or forged webhooks',async()=>{
    const r=await POST(new Request('https://example.test/api/line/webhook',{
      method:'POST',headers:{'x-line-signature':'forged'},body:JSON.stringify({events:[]})
    }));
    expect(r.status).toBe(403);
  });
  it('accepts LINE webhook verification with zero events',async()=>{
    const r=await send([]);
    expect(r.status).toBe(200);
  });
  it('verifies signature against unmodified raw bytes',async()=>{
    const raw='{"events":[],"hello":"\\u0e44\\u0e17\\u0e22"}';
    const other=raw.replace('\\u0e44','ไ');
    const secret='test-channel-secret';
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),'HMAC',false,['sign']);
    const sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)));
    const signature=btoa(String.fromCharCode(...sig));
    expect(await verifyLineSignature(raw,signature,secret)).toBe(true);
    expect(await verifyLineSignature(other,signature,secret)).toBe(false);
  });
  it('creates pending review for forwarded KBank text; never books balance',async()=>{
    const r=await send([event({type:'text',id:'line-message-1',text:notice})]);
    expect(r.status).toBe(200);
    const row=mock.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      amount_satang:11900,status:'pending',source_kind:'bank_text',type:'expense',
      transaction_date:'2026-10-09',fingerprint:'test-fingerprint'
    });
    expect(JSON.stringify(row)).not.toContain('400,070.79');
    expect(JSON.stringify(sent)).toContain('quickReply');
  });
  it('extracts bank images privately and requires LINE confirmation',async()=>{
    const r=await send([event({type:'image',id:'media-1'},'bank-image-1')]);
    expect(r.status).toBe(200);
    expect(mock.read).toHaveBeenCalledWith('media-1','test-access-token');
    const row=mock.insert.mock.calls[0][0];
    expect(row).toMatchObject({status:'pending',source_kind:'bank_image',amount_satang:11900});
    const choices=(sent[0] as {messages:Array<{quickReply:{items:unknown[]}}>}).messages[0].quickReply.items;
    expect(choices).toHaveLength(3);
  });
  it('accepts confirmation only as a signed postback for the same LINE user',async()=>{
    const post={type:'postback',replyToken:'reply-1',source:{type:'user',userId:user},
      postback:{data:'review|bank-evt-1|expense'}};
    const r=await send([post]);
    expect(r.status).toBe(200);
    expect(mock.review).toHaveBeenCalledWith('bank-evt-1',user,'expense');
  });
  it('ignores webhooks from an unapproved account',async()=>{
    const other={...event({type:'text',id:'untrusted',text:'กาแฟ 65'}),source:{type:'user',userId:'Uunapproved'}};
    const r=await send([other]);
    expect(r.status).toBe(200);
    expect(mock.insert).not.toHaveBeenCalled();
  });
  it('sends pairing code only to allowlisted LINE user',async()=>{
    const r=await send([event({type:'text',id:'pair-1',text:'/เชื่อม'})]);
    expect(r.status).toBe(200);
    expect(mock.issue).toHaveBeenCalledWith(user);
    expect(JSON.stringify(sent)).toContain('ABCDEF0123456789ABCD');
  });
});

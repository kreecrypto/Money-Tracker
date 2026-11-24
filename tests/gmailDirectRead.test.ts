import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {parseGmailMessage,scanKplusMailbox} from '../server/gmail/mailbox';
import {seal,oauthConfig} from '../server/gmail/oauth';
import {POST as preview} from '../api/gmail/scan';

const base='https://money-tracker.example';
const headers=[
  {name:'From',value:'K PLUS <KPLUS@kasikornbank.com>'},
  {name:'Authentication-Results',value:'mx.google.com; dkim=pass header.i=@kasikornbank.com header.d=kasikornbank.com'},
  {name:'Subject',value:'Result of Funds Transfer (Success)'}
];
const message=(body:string,head=headers)=>({
  id:'abcd0123456789',
  payload:{mimeType:'text/plain',headers:head,body:{data:Buffer.from(body).toString('base64url')}}
});
const outgoing=[
  'From Account: 123-***-456',
  'Amount (THB): 123.50',
  'Transaction Date: 20/10/2026 10:20',
  'Transaction Number: ABC123456789',
  'Received Name: ร้านค้าทดสอบ'
].join('\n');

beforeEach(()=>{
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID','mock-id.apps.googleusercontent.com');
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET','synthetic-secret');
  vi.stubEnv('GMAIL_APP_ORIGIN',base);
  vi.stubEnv('GMAIL_TOKEN_ENCRYPTION_KEY','a'.repeat(64));
  vi.stubEnv('SUPABASE_URL','https://test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic-service-role');
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

describe('Direct Gmail K PLUS dry-run',()=>{
  it('rejects spoofed From and never returns Ready without DKIM authentication',()=>{
    expect(parseGmailMessage(message(outgoing,[...headers.slice(0,1),headers[2]]))?.reason)
      .toBe('UNVERIFIED_SENDER');
    expect(parseGmailMessage(message(outgoing,[{name:'From',value:'attacker@example.net'},...headers.slice(1)])))
      .toBeNull();
  });
  it('recognizes an authenticated and complete outgoing K PLUS transaction',()=>{
    const result=parseGmailMessage(message(outgoing));
    expect(result?.type).toBe('expense');
    expect(result?.amountSatang).toBe(12350);
    expect(result?.status).toBe('ready');
  });
  it('holds HTML-only notifications for review rather than inventing amount',()=>{
    const result=parseGmailMessage({payload:{mimeType:'text/html',headers,body:{data:'eA=='}}});
    expect(result?.status).toBe('pending');
    expect(result?.reason).toBe('UNSUPPORTED_EMAIL_BODY');
  });
  it('scans a maximum of ten messages without returning raw content or writing to database',async()=>{
    const link={
      google_sub:'google-test-user',email:'test@example.net',
      encrypted_refresh_token:seal(oauthConfig()!,'refresh-v1','synthetic-refresh-token'),
      linked_at:'2026-10-20T00:00:00Z'
    };
    const calls:string[]=[];
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input);calls.push(url);
      if(url==='https://oauth2.googleapis.com/token')return Response.json({
        access_token:'synthetic-access-token',scope:'https://www.googleapis.com/auth/gmail.readonly'
      });
      if(url.includes('/messages?'))return Response.json({
        messages:[{id:'abcd0123456789'},{id:'abcd0123456788'}],nextPageToken:'next-page'
      });
      if(url.includes('/messages/abcd0123456789'))return Response.json(message(outgoing));
      if(url.includes('/messages/abcd0123456788'))return Response.json(message(outgoing,[
        {name:'From',value:'KPLUS@kasikornbank.com'},{name:'Subject',value:'Result of Funds Transfer (Success)'}
      ]));
      throw Error('Unexpected network request '+String(init?.method||'GET'));
    }));
    const result=await scanKplusMailbox(link);
    expect(result).toEqual({scanned:2,recognized:2,ready:1,pending:0,
      skipped:0,unverified:1,moreAvailable:true});
    expect(JSON.stringify(result)).not.toContain('12350');
    expect(calls).toHaveLength(4);
    expect(calls.every(x=>!x.includes('supabase'))).toBe(true);
  });
  it('rejects cross-site requests before loading any Gmail connection',async()=>{
    const request=new Request(base+'/api/gmail/scan',{method:'POST',
      headers:{origin:'https://bad.example','content-type':'application/json'},body:'{}'});
    expect((await preview(request)).status).toBe(403);
  });
  it('requires an authenticated OAuth cookie and performs no Gmail fetch without one',async()=>{
    const mock=vi.fn();
    vi.stubGlobal('fetch',mock);
    const request=new Request(base+'/api/gmail/scan',{method:'POST',headers:{
      origin:base,'content-type':'application/json'
    },body:'{}'});
    const response=await preview(request);
    expect(response.status).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });
  it('never returns an access token, message body or financial amount',async()=>{
    const session='z'.repeat(43);
    const link={
      google_sub:'google-test-user',email:'test@example.net',
      encrypted_refresh_token:seal(oauthConfig()!,'refresh-v1','synthetic-refresh-token'),
      linked_at:'2026-10-20T00:00:00Z'
    };
    vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input);
      if(url.includes('/rest/v1/money_tracker_gmail_connections'))return Response.json([link]);
      if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-access-token'});
      if(url.includes('/messages?'))return Response.json({messages:[{id:'abcd0123456789'}]});
      if(url.includes('/messages/abcd0123456789'))return Response.json(message(outgoing));
      throw new Error('Unexpected network destination');
    }));
    const request=new Request(base+'/api/gmail/scan',{method:'POST',headers:{
      origin:base,'content-type':'application/json',cookie:'mt_gmail_session='+session
    },body:'{}'});
    const response=await preview(request);
    expect(response.status).toBe(200);
    const result=await response.json();
    expect(result).toMatchObject({mode:'preview',saved:0,ready:1,scanned:1});
    expect(JSON.stringify(result)).not.toMatch(/synthetic-access|synthetic-refresh|123\.50|ABC123|ร้านค้า/i);
  });
});

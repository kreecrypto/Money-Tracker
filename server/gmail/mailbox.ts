import {isKplusSender,parseKplusEmail,type EmailDecision} from './kplusEmail.js';
import {GMAIL_SCOPE,type GmailLink,oauthConfig,unseal} from './oauth.js';

type Header={name?:string;value?:string};
type Part={mimeType?:string;headers?:Header[];body?:{data?:string};parts?:Part[]};
type GmailMessage={id?:string;payload?:Part};
const MAX_MESSAGES=10;
const MAX_BODY=12000;

export type GmailScan={
  scanned:number;recognized:number;ready:number;pending:number;skipped:number;
  unverified:number;moreAvailable:boolean;
};

/** Server-only: use the OAuth refresh token; do not store or expose the access token. */
export async function accessTokenFor(link:GmailLink):Promise<string>{
  const config=oauthConfig();
  if(!config)throw new Error('GMAIL_NOT_CONFIGURED');
  const refresh=unseal(config,'refresh-v1',link.encrypted_refresh_token);
  if(!refresh)throw new Error('GMAIL_REFRESH_UNAVAILABLE');
  const response=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      client_id:config.clientId,client_secret:config.clientSecret,
      refresh_token:refresh,grant_type:'refresh_token'
    }),
    cache:'no-store',signal:AbortSignal.timeout(10000)
  });
  if(response.status===400||response.status===401)throw new Error('GMAIL_RECONNECT_REQUIRED');
  if(!response.ok)throw new Error('GMAIL_AUTH_UNAVAILABLE');
  const token=await response.json() as {access_token?:unknown;scope?:unknown};
  if(typeof token.access_token!=='string'||token.access_token.length<10)
    throw new Error('GMAIL_AUTH_UNAVAILABLE');
  if(typeof token.scope==='string'&&!token.scope.split(/\s+/).includes(GMAIL_SCOPE))
    throw new Error('GMAIL_SCOPE_MISSING');
  return token.access_token;
}

function header(headers:Header[]|undefined,name:string):string{
  const values=(headers||[]).filter(x=>x.name?.toLowerCase()===name.toLowerCase())
    .map(x=>x.value||'').filter(Boolean);
  return values.length===1?values[0]:'';
}

function textParts(part:Part|undefined):string[]{
  if(!part)return [];
  const children=(part.parts||[]).flatMap(textParts);
  if(children.length)return children;
  if(part.mimeType!=='text/plain'||typeof part.body?.data!=='string')return [];
  try{
    const encoded=part.body.data;
    if(encoded.length>MAX_BODY*4)return [];
    const text=Buffer.from(encoded,'base64url').toString('utf8');
    return text.length>MAX_BODY?[]:[text];
  }catch{return [];}
}

export function parseGmailMessage(message:GmailMessage):EmailDecision|null{
  const payload=message.payload;
  if(!payload||!isKplusSender(header(payload.headers,'from')))return null;
  const subject=header(payload.headers,'subject');
  const auth=header(payload.headers,'authentication-results');
  // Header-only identity is spoofable; keep unauthenticated notifications out of Ready.
  if(!/\bdkim=pass\b[^;\r\n]*\bheader\.d=kasikornbank\.com\b/i.test(auth))
    return {status:'pending',reason:'UNVERIFIED_SENDER',type:null,amountSatang:null,date:null,
      time:null,reference:null,recipient:null,sender:null};
  const bodies=textParts(payload);
  if(bodies.length!==1)return {status:'pending',reason:'UNSUPPORTED_EMAIL_BODY',type:null,
    amountSatang:null,date:null,time:null,reference:null,recipient:null,sender:null};
  return parseKplusEmail(subject,bodies[0]);
}

async function gmailGet<T>(path:string,token:string):Promise<T>{
  const response=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{
    headers:{authorization:'Bearer '+token},cache:'no-store',
    signal:AbortSignal.timeout(10000)
  });
  if(response.status===401)throw new Error('GMAIL_RECONNECT_REQUIRED');
  if(response.status===403)throw new Error('GMAIL_PERMISSION_DENIED');
  if(!response.ok)throw new Error('GMAIL_API_UNAVAILABLE');
  return await response.json() as T;
}

/** Safe dry run only. No DB writes and no PII sent to the browser. */
export async function scanKplusMailbox(link:GmailLink):Promise<GmailScan>{
  const token=await accessTokenFor(link);
  const list=await gmailGet<{messages?:{id?:string}[];nextPageToken?:string}>(
    'messages?'+new URLSearchParams({
      q:'from:kplus@kasikornbank.com newer_than:30d',
      maxResults:String(MAX_MESSAGES)
    }),token);
  const ids=(Array.isArray(list.messages)?list.messages:[]).map(x=>x.id)
    .filter((id):id is string=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,64}$/.test(id))
    .slice(0,MAX_MESSAGES);
  const result:GmailScan={scanned:0,recognized:0,ready:0,pending:0,
    skipped:0,unverified:0,moreAvailable:!!list.nextPageToken};
  for(const id of ids){
    const msg=await gmailGet<GmailMessage>('messages/'+encodeURIComponent(id)+'?format=full',token);
    result.scanned++;
    const decision=parseGmailMessage(msg);
    if(!decision){result.unverified++;continue;}
    result.recognized++;
    if(decision.reason==='UNVERIFIED_SENDER')result.unverified++;
    else if(decision.status==='ready')result.ready++;
    else if(decision.status==='pending')result.pending++;
    else result.skipped++;
  }
  return result;
}

import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

export const SESSION_COOKIE='mt_gmail_session';
export const STATE_COOKIE='mt_gmail_oauth_state';
export const GMAIL_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
const SESSION_AGE=30*24*60*60;
const STATE_AGE=10*60;

type Config={clientId:string;clientSecret:string;origin:string;key:Buffer};
type OAuthState={state:string;verifier:string;expires:number};
export type GmailLink={google_sub:string;email:string;encrypted_refresh_token:string;linked_at:string};

export function oauthConfig():Config|null{
  const clientId=process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()||'';
  const clientSecret=process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()||'';
  const origin=process.env.GMAIL_APP_ORIGIN?.trim()||'';
  const hex=process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim()||'';
  if(!clientId||!clientSecret||!/^[0-9a-f]{64}$/i.test(hex))return null;
  try{
    const url=new URL(origin);
    if((url.protocol!=='https:'&&!(url.protocol==='http:'&&url.hostname==='localhost'))||
      url.origin!==origin||url.username||url.password)return null;
  }catch{return null;}
  return {clientId,clientSecret,origin,key:Buffer.from(hex,'hex')};
}
export function sameAppOrigin(request:Request,config:Config):boolean{
  try{return new URL(request.url).origin===config.origin;}catch{return false;}
}
export function redirectUri(config:Config):string{return config.origin+'/api/gmail/oauth/callback';}
export function randomToken():string{return randomBytes(32).toString('base64url');}
export function sha(data:string):string{return createHash('sha256').update(data).digest('hex');}
export function seal(config:Config,purpose:string,value:string):string{
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',config.key,iv);
  cipher.setAAD(Buffer.from('money-tracker:'+purpose));
  const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');
}
export function unseal(config:Config,purpose:string,encoded:string):string|null{
  try{
    if(!encoded||encoded.length>4000)return null;
    const data=Buffer.from(encoded,'base64url');
    if(data.length<29)return null;
    const decipher=createDecipheriv('aes-256-gcm',config.key,data.subarray(0,12));
    decipher.setAAD(Buffer.from('money-tracker:'+purpose));
    decipher.setAuthTag(data.subarray(12,28));
    return Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8');
  }catch{return null;}
}
export function parseCookies(request:Request):Record<string,string>{
  const raw=request.headers.get('cookie')||'';
  const result:Record<string,string>={};
  for(const part of raw.split(';')){
    const index=part.indexOf('=');
    if(index<1)continue;
    const k=part.slice(0,index).trim(),value=part.slice(index+1).trim();
    if(k===STATE_COOKIE||k===SESSION_COOKIE)result[k]=value;
  }
  return result;
}
export function cookie(name:string,value:string,seconds:number,config:Config,path:string):string{
  return name+'='+value+'; Path='+path+'; HttpOnly; SameSite=Lax; Max-Age='+seconds+
    (config.origin.startsWith('https:')?'; Secure':'');
}
export function noStore():Record<string,string>{
  return {'cache-control':'no-store, max-age=0','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
}
export function createLogin(config:Config):{url:string;cookie:string}{
  const state=randomToken(),verifier=randomToken();
  const payload:OAuthState={state,verifier,expires:Date.now()+STATE_AGE*1000};
  const challenge=createHash('sha256').update(verifier).digest('base64url');
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [k,v] of Object.entries({
    client_id:config.clientId,redirect_uri:redirectUri(config),response_type:'code',
    scope:'openid email '+GMAIL_SCOPE,access_type:'offline',prompt:'consent',
    state,code_challenge:challenge,code_challenge_method:'S256'
  }))url.searchParams.set(k,v);
  return {url:url.toString(),cookie:cookie(STATE_COOKIE,seal(config,'oauth-state-v1',JSON.stringify(payload)),STATE_AGE,config,'/api/gmail/oauth')};
}
export function validateState(config:Config,request:Request,input:string|null):string|null{
  if(!input||!(/^[\w-]{40,64}$/).test(input))return null;
  const sealed=parseCookies(request)[STATE_COOKIE];
  const decoded=unseal(config,'oauth-state-v1',sealed||'');
  if(!decoded)return null;
  try{
    const state=JSON.parse(decoded) as OAuthState;
    if(typeof state.state!=='string'||state.state!==input||!Number.isSafeInteger(state.expires)||
      state.expires<Date.now()||state.expires>Date.now()+STATE_AGE*1000||
      typeof state.verifier!=='string'||!/^[\w-]{40,64}$/.test(state.verifier))return null;
    return state.verifier;
  }catch{return null;}
}
export async function exchangeCode(config:Config,code:string,verifier:string):Promise<string|null|false>{
  const response=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      code,client_id:config.clientId,client_secret:config.clientSecret,
      redirect_uri:redirectUri(config),grant_type:'authorization_code',code_verifier:verifier
    }),cache:'no-store',signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)return false;
  const tokens=await response.json() as {access_token?:unknown;refresh_token?:unknown;scope?:unknown};
  if(typeof tokens.access_token!=='string'||tokens.access_token.length<10||
     typeof tokens.scope!=='string'||!tokens.scope.split(/\s+/).includes(GMAIL_SCOPE)||
     typeof tokens.refresh_token!=='string'||tokens.refresh_token.length<10)return false;
  return JSON.stringify({access:tokens.access_token,refresh:tokens.refresh_token});
}
export async function googleIdentity(accessToken:string):Promise<{sub:string;email:string}|null>{
  const response=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{
    headers:{authorization:'Bearer '+accessToken},cache:'no-store',signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)return null;
  const profile=await response.json() as {sub?:unknown;email?:unknown;email_verified?:unknown};
  if(typeof profile.sub!=='string'||profile.sub.length<4||profile.sub.length>255||
    typeof profile.email!=='string'||profile.email.length>255||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)||profile.email_verified!==true)return null;
  return {sub:profile.sub,email:profile.email};
}
function storage(){
  const base=process.env.SUPABASE_URL?.trim()||'';
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()||'';
  let url:URL;
  try{url=new URL(base);}catch{throw new Error('GMAIL_STORAGE_NOT_CONFIGURED');}
  if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||!key)
    throw new Error('GMAIL_STORAGE_NOT_CONFIGURED');
  return {url,key};
}
async function db(query:string,method:'GET'|'POST'|'DELETE',body?:object,prefer='return=representation'):Promise<GmailLink[]>{
  const {url,key}=storage();
  const response=await fetch(new URL('/rest/v1/money_tracker_gmail_connections'+query,url),{
    method,headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json',prefer},
    ...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error('GMAIL_STORAGE_'+response.status);
  if(prefer==='return=minimal')return [];
  return await response.json() as GmailLink[];
}
export async function persistConnection(profile:{sub:string;email:string},refresh:string,session:string,config:Config):Promise<void>{
  await db('?on_conflict=google_sub','POST',{
    google_sub:profile.sub,email:profile.email,encrypted_refresh_token:seal(config,'refresh-v1',refresh),
    session_hash:sha(session),session_expires_at:new Date(Date.now()+SESSION_AGE*1000).toISOString(),
    linked_at:new Date().toISOString()
  },'resolution=merge-duplicates,return=minimal');
}
export async function currentConnection(request:Request):Promise<GmailLink|null>{
  const session=parseCookies(request)[SESSION_COOKIE]||'';
  if(!/^[\w-]{40,64}$/.test(session))return null;
  const rows=await db('?session_hash=eq.'+sha(session)+
    '&session_expires_at=gt.'+encodeURIComponent(new Date().toISOString())+
    '&select=google_sub,email,encrypted_refresh_token,linked_at&limit=1','GET');
  return rows[0]||null;
}
export async function unlinkConnection(request:Request):Promise<void>{
  const session=parseCookies(request)[SESSION_COOKIE]||'';
  if(!/^[\w-]{40,64}$/.test(session))return;
  await db('?session_hash=eq.'+sha(session),'DELETE',undefined,'return=minimal');
}
export function maskEmail(email:string):string{
  const [local,domain]=email.split('@');
  if(!local||!domain)return '***';
  return local.slice(0,Math.min(2,local.length))+'***@'+domain;
}
export function sessionCookie(session:string,config:Config):string{
  return cookie(SESSION_COOKIE,session,SESSION_AGE,config,'/api/gmail');
}
export function clearStateCookie(config:Config):string{
  return cookie(STATE_COOKIE,'',0,config,'/api/gmail/oauth');
}
export function clearSessionCookie(config:Config):string{
  return cookie(SESSION_COOKIE,'',0,config,'/api/gmail');
}

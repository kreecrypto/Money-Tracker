import {createHash,timingSafeEqual} from 'node:crypto';
import type {EntryType,Method} from '../../src/lib/finance.js';

export type IPhoneDraft={
  id:string;owner_key:string;image_digest:string;bank_fingerprint:string|null;
  status:'pending'|'confirmed'|'discarded';type:EntryType|null;amount_satang:number|null;
  transaction_date:string|null;category:string;note:string;method:Method;source_label:string;
  created_at:string;reviewed_at:string|null;
  transaction_time:string|null;recipient:string|null;
};
export const MAX_IMAGE_BYTES=3*1024*1024; // allow multipart overhead below Vercel's 4.5MB cap
export const sha=(data:Uint8Array|string)=>createHash('sha256').update(data).digest('hex');

const env=(key:string)=>process.env[key]?.trim()||'';
export function tokenFor(scope:'upload'|'review'){
  const token=env(scope==='upload'?'IPHONE_UPLOAD_TOKEN':'IPHONE_REVIEW_TOKEN');
  return /^[0-9a-fA-F]{64}$/.test(token)?token.toUpperCase():null;
}
export function auth(request:Request,scope:'upload'|'review'){
  const expected=tokenFor(scope);
  if(!expected)return 'unconfigured' as const;
  const given=(request.headers.get('authorization')||'').match(/^Bearer ([0-9a-fA-F]{64})$/);
  if(!given)return 'unauthorized' as const;
  return timingSafeEqual(Buffer.from(given[1],'hex'),Buffer.from(expected,'hex'))?'ok' as const:'unauthorized' as const;
}
export function ownerKey(){
  const key=tokenFor('review');if(!key)throw new Error('REVIEW_SECRET_NOT_CONFIGURED');
  return sha('money-tracker-iphone-v1|'+key);
}
function config(){
  const url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
  // Raise distinct safe codes so the upload-token holder can identify which
  // Production environment setting needs attention. Never reveal its value.
  if(!url)throw new Error('SUPABASE_URL_NOT_CONFIGURED');
  if(!key)throw new Error('SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED');
  let base:URL;
  try{base=new URL(url);}catch{throw new Error('INVALID_SUPABASE_URL');}
  if(base.protocol!=='https:'||!base.hostname.endsWith('.supabase.co'))throw new Error('INVALID_SUPABASE_URL');
  return {base,key};
}
async function db(path:string,method:'GET'|'POST'|'PATCH',body?:object,prefer='return=representation'){
  const {base,key}=config();
  const response=await fetch(new URL('/rest/v1/'+path,base),{
    method,headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json',prefer},
    body:body?JSON.stringify(body):undefined,cache:'no-store'
  });
  if(!response.ok){
    if(response.status===409||response.status===23505)throw new Error('DUPLICATE_IMAGE');
    throw new Error('DATABASE_ERROR_'+response.status);
  }
  return await response.json() as IPhoneDraft[];
}
const esc=(s:string)=>encodeURIComponent(s);
const table='money_tracker_iphone_drafts';
/**
 * Small, read-only production liveness probe. Do not return any record,
 * owner identifier or configured secret to callers.
 */
export async function storageHealth():Promise<void>{
  await db(table+'?select=id&limit=0','GET');
}

export async function saveDraft(row:Pick<IPhoneDraft,
  'owner_key'|'image_digest'|'bank_fingerprint'|'type'|'amount_satang'|'transaction_date'|'category'|'note'|'method'|'source_label'
> & {status?:'pending'|'confirmed';transaction_time?:string|null;recipient?:string|null}){
  const {status='pending',...fields}=row;
  const data=await db(table+'?on_conflict=owner_key,image_digest','POST',
    {...fields,status,reviewed_at:status==='confirmed'?new Date().toISOString():null},'resolution=ignore-duplicates,return=representation');
  return data[0]||null;
}
/** Update only a confirmed entry's recipient. Never touch amount, type, date or identity.
 * The review token scopes the update to exactly one owner's private ledger. */
export async function correctConfirmedRecipient(id:string,recipient:string|null):Promise<boolean>{
  const rows=await db(table+'?id=eq.'+esc(id)+'&owner_key=eq.'+esc(ownerKey())+
    '&status=eq.confirmed','PATCH',{recipient});
  return rows.length>0;
}
export async function pendingDrafts(){
  return await db(table+'?owner_key=eq.'+esc(ownerKey())+
    '&status=eq.pending&select=id,amount_satang,type,transaction_date,category,note,method,source_label,created_at,transaction_time,recipient&order=created_at.desc&limit=50','GET');
}
export async function confirmedDrafts(){
  return await db(table+'?owner_key=eq.'+esc(ownerKey())+
    '&status=eq.confirmed&select=id,amount_satang,type,transaction_date,category,note,method,source_label,created_at,reviewed_at,transaction_time,recipient&order=reviewed_at.desc&limit=500','GET');
}
export async function reviewDraft(id:string,decision:'confirm'|'discard',entry?:{
  type:EntryType;amountSatang:number;date:string;category:string;note:string;method:Method;
  time?:string|null;recipient?:string|null;
}){
  const update=decision==='discard'?{status:'discarded',reviewed_at:new Date().toISOString()}:
    {status:'confirmed',reviewed_at:new Date().toISOString(),
     type:entry!.type,amount_satang:entry!.amountSatang,transaction_date:entry!.date,
     category:entry!.category,note:entry!.note,method:entry!.method,
     transaction_time:entry!.time||null,recipient:entry!.recipient||null};
  const records=await db(table+'?id=eq.'+esc(id)+'&owner_key=eq.'+esc(ownerKey())+'&status=eq.pending',
    'PATCH',update);
  return records[0]||null;
}
export function imageType(b:Uint8Array,mime:string){
  if(mime==='image/jpeg'&&b.length>=4&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return true;
  if(mime==='image/png'&&b.length>=8&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10)return true;
  if(mime==='image/webp'&&b.length>=12&&String.fromCharCode(...b.subarray(0,4))==='RIFF'&&String.fromCharCode(...b.subarray(8,12))==='WEBP')return true;
  return false;
}
export function appCors(request:Request){
  const origin=request.headers.get('origin');
  const allowed=env('IPHONE_ALLOWED_APP_ORIGIN');
  // Same-origin GET requests commonly have no Origin header. Requests with an
  // Origin must match either the actual request URL or the explicitly allowed
  // legacy app origin. All review endpoints still require a valid Bearer token.
  let requestOrigin:string;
  try{requestOrigin=new URL(request.url).origin;}
  catch{return null;}
  if(origin&&origin!==requestOrigin&&origin!==allowed)return null;
  const headers:Record<string,string>={'cache-control':'no-store','vary':'Origin'};
  if(origin){
    headers['access-control-allow-origin']=origin;
    headers['access-control-allow-methods']='GET,POST,OPTIONS';
    headers['access-control-allow-headers']='Authorization,Content-Type';
  }
  return headers;
}
export function options(request:Request){
  const headers=appCors(request);
  return headers?new Response(null,{status:204,headers}):new Response('Forbidden',{status:403});
}
export function json(body:object,status=200,headers:Record<string,string>={}){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store',...headers}});
}

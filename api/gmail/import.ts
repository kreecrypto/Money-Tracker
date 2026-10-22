import {timingSafeEqual} from 'node:crypto';
import {ownerKey,saveDraft,sha,json} from '../../server/iphone/bridge.js';
import {isKplusSender,parseKplusEmail} from '../../server/gmail/kplusEmail.js';

export const maxDuration=15;
const MAX_BYTES=18*1024;
function authenticate(request:Request):'ok'|'unconfigured'|'unauthorized'{
  const configured=process.env.GMAIL_IMPORT_TOKEN?.trim()||'';
  if(!/^[a-f0-9]{64}$/i.test(configured))return 'unconfigured';
  const supplied=(request.headers.get('authorization')||'').match(/^Bearer ([a-f0-9]{64})$/i);
  if(!supplied)return 'unauthorized';
  return timingSafeEqual(Buffer.from(configured,'hex'),Buffer.from(supplied[1],'hex'))?'ok':'unauthorized';
}
export async function POST(request:Request):Promise<Response>{
  const grant=authenticate(request);
  if(grant!=='ok')return json({error:grant==='unconfigured'?'NOT_CONFIGURED':'UNAUTHORIZED'},grant==='unconfigured'?503:401);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))
    return json({error:'JSON_REQUIRED'},415);
  if(Number(request.headers.get('content-length')||0)>MAX_BYTES)return json({error:'BODY_TOO_LARGE'},413);
  let payload:unknown;
  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).byteLength>MAX_BYTES)return json({error:'BODY_TOO_LARGE'},413);
    payload=JSON.parse(raw);
  }catch{return json({error:'BAD_JSON'},400);}
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return json({error:'BAD_INPUT'},400);
  const input=payload as Record<string,unknown>;
  if(Object.keys(input).sort().join(',')!=='from,messageId,subject,text'||
    typeof input.from!=='string'||!isKplusSender(input.from)||
    typeof input.messageId!=='string'||!/^[a-f0-9]{8,40}$/i.test(input.messageId)||
    typeof input.subject!=='string'||input.subject.length>200||
    typeof input.text!=='string'||input.text.length<12||input.text.length>12000)
    return json({error:'INVALID_EMAIL'},400);
  const ownNames=(process.env.GMAIL_OWN_NAMES||'').split('|').map(x=>x.trim()).filter(Boolean).slice(0,8);
  const candidate=parseKplusEmail(input.subject,input.text,ownNames);
  if(candidate.status==='skipped')return json({status:'skipped',reason:candidate.reason},200);
  const isReady=candidate.status==='ready';
  try{
    const row=await saveDraft({
      owner_key:ownerKey(),
      image_digest:sha('gmail-kplus-message-v1|'+input.messageId.toLowerCase()),
      bank_fingerprint:candidate.reference?sha('kbank-reference-v1|'+candidate.reference):null,
      type:candidate.type,
      amount_satang:candidate.amountSatang,
      transaction_date:candidate.date,
      transaction_time:candidate.time,
      recipient:candidate.recipient,
      status:isReady?'confirmed':'pending',
      category:'อื่น ๆ',method:'bank',source_label:'KBank / Gmail',
      note:candidate.type==='income'?
        (candidate.sender?'รับโอนจาก '+candidate.sender:'เงินเข้า K PLUS (Gmail)'):
        'นำเข้าจาก K PLUS Gmail'
    });
    if(!row)return json({status:'duplicate',reviewRequired:false},200);
    return isReady?
      json({status:'saved',transactionId:'iphone-'+row.id,reviewRequired:false},201):
      json({status:'pending',draftId:row.id,reviewRequired:true,reason:candidate.reason},202);
  }catch(e){
    const message=e instanceof Error?e.message:'';
    if(message==='DUPLICATE_IMAGE'||message==='DATABASE_ERROR_409')
      return json({status:'duplicate',reviewRequired:false},200);
    const code=message==='REVIEW_SECRET_NOT_CONFIGURED'?'REVIEW_TOKEN_INVALID':'STORAGE_UNAVAILABLE';
    // Never log subjects, bodies, amounts, sender names, account identifiers or tokens.
    console.error('[gmail-import] storage:',code);
    return json({error:'STORAGE_UNAVAILABLE',code},503);
  }
}
export function GET(){return json({error:'METHOD_NOT_ALLOWED'},405);}

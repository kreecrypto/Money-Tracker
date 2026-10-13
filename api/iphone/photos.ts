import {auth,ownerKey,saveDraft,sha,json} from '../../server/iphone/bridge.js';
import {inspectPhotosOCR} from '../../server/iphone/photos.js';

export const maxDuration=15;
const MAX_TEXT_BYTES=18*1024;

/**
 * iOS 26: Find Photos (recent) -> Extract Text from Image (on device)
 * -> local keyword filter -> POST text only.
 * Never receives private Photos images or persists raw OCR text.
 */
export async function POST(request:Request):Promise<Response>{
  const grant=auth(request,'upload');
  if(grant!=='ok')return json({error:grant==='unconfigured'?'NOT_CONFIGURED':'UNAUTHORIZED'},grant==='unconfigured'?503:401);
  if(Number(request.headers.get('content-length')||0)>MAX_TEXT_BYTES)
    return json({error:'TEXT_TOO_LARGE'},413);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))
    return json({error:'JSON_REQUIRED'},415);
  try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).byteLength>MAX_TEXT_BYTES)
      return json({error:'TEXT_TOO_LARGE'},413);
    const payload=JSON.parse(raw) as unknown;
    if(!payload||typeof payload!=='object')
      return json({error:'BAD_INPUT'},400);
    const input=payload as {text?:unknown;direction?:unknown};
    const text=input.text;
    if(typeof text!=='string'||text.length<12||text.length>12000)
      return json({error:'BAD_INPUT'},400);
    // For a personal K PLUS *outgoing* slip, configure direction=expense in
    // Shortcuts. Do not assume all generic transfers are expenses: a shared
    // transfer screenshot may represent money received instead.
    if(input.direction!==undefined&&!['income','expense'].includes(String(input.direction)))
      return json({error:'INVALID_DIRECTION_HINT'},400);
    const candidate=inspectPhotosOCR(text);
    if(!candidate.accept)
      return json({status:'skipped',reason:candidate.reason},200);
    const hint=input.direction as 'income'|'expense'|undefined;
    if(candidate.type&&hint&&candidate.type!==hint)
      return json({status:'skipped',reason:'DIRECTION_CONFLICT'},422);
    const direction=candidate.type??hint??null;
    const missing=[
      ...(!direction?['direction']:[]),
      ...(!candidate.amountSatang||candidate.amountSatang<=0?['amount']:[]),
      ...(!candidate.date?['date']:[]),
    ];
    // Hash ONLY normalized OCR text; never store text, account identifiers or
    // the original photo. A bank reference, when present, has a separate
    // unique SHA-256 fingerprint to avoid double-booking slightly different OCR.
    const imageDigest=sha('photos-ocr-v1|'+candidate.normalizedText);
    const fingerprint=candidate.fingerprint?sha(candidate.fingerprint):null;
    const confirmed=missing.length===0;
    const row=await saveDraft({
      owner_key:ownerKey(),
      image_digest:imageDigest,
      bank_fingerprint:fingerprint,
      type:direction,
      amount_satang:candidate.amountSatang,
      transaction_date:candidate.date,
      transaction_time:candidate.time,
      recipient:candidate.recipient,
      category:candidate.category,
      note:confirmed?'K PLUS · Shortcut Auto Import':candidate.note,
      method:'bank',source_label:candidate.sourceLabel
    },confirmed?'confirmed':'pending');
    if(!row)return json({status:'duplicate',reviewRequired:false},200);
    return confirmed
      ?json({status:'saved',transactionId:'iphone-'+row.id,reviewRequired:false},201)
      :json({status:'pending',draftId:row.id,reviewRequired:true,missingFields:missing},202);
  }catch(e){
    if(e instanceof Error&&e.message==='DUPLICATE_IMAGE')
      return json({status:'duplicate',reviewRequired:false},200);
    if(e instanceof SyntaxError)return json({error:'BAD_JSON'},400);
    return json({error:'STORAGE_UNAVAILABLE'},503);
  }
}
export function GET(){return json({error:'METHOD_NOT_ALLOWED'},405);}

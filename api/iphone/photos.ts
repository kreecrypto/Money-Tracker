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
    const text=(payload as {text?:unknown}).text;
    if(typeof text!=='string'||text.length<12||text.length>12000)
      return json({error:'BAD_INPUT'},400);
    const candidate=inspectPhotosOCR(text);
    if(!candidate.accept)
      return json({status:'skipped',reason:candidate.reason},200);
    // Content hash allows re-triggers of "App Is Closed"/scheduled sweep
    // without double booking the same slip across runs.
    const imageDigest=sha('photos-ocr-v1|'+candidate.normalizedText);
    const fingerprint=candidate.fingerprint?sha(candidate.fingerprint):null;
    // Auto-save only when every required banking field is unambiguous.
    // An ambiguous OCR result remains private in the review queue.
    const autoSave=Boolean(candidate.type&&candidate.amountSatang&&candidate.date&&candidate.time&&candidate.recipient);
    const row=await saveDraft({
      owner_key:ownerKey(),
      image_digest:imageDigest,
      bank_fingerprint:fingerprint,
      type:candidate.type,
      amount_satang:candidate.amountSatang,
      transaction_date:candidate.date,
      transaction_time:candidate.time,recipient:candidate.recipient,
      status:autoSave?'confirmed':'pending',
      category:candidate.category,
      note:candidate.note,
      method:'bank',source_label:candidate.sourceLabel
    });
    if(!row)return json({status:'duplicate',reviewRequired:false},200);
    return autoSave?
      json({status:'saved',transactionId:'iphone-'+row.id,reviewRequired:false},201):
      json({status:'pending',draftId:row.id,reviewRequired:true,reason:'INCOMPLETE_OR_AMBIGUOUS'},202);
  }catch(e){
    if(e instanceof Error&&e.message==='DUPLICATE_IMAGE')
      return json({status:'duplicate',reviewRequired:false},200);
    if(e instanceof SyntaxError)return json({error:'BAD_JSON'},400);
    // Never log the OCR text, account identifiers, tokens or database credentials.
    const reason=e instanceof Error?e.message:'';
    const code=reason==='REVIEW_SECRET_NOT_CONFIGURED'?'REVIEW_TOKEN_INVALID':
      reason==='SUPABASE_URL_NOT_CONFIGURED'?'SUPABASE_URL_MISSING':
      reason==='SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED'?'SUPABASE_SERVICE_KEY_MISSING':
      reason==='INVALID_SUPABASE_URL'?'SUPABASE_URL_INVALID':
      reason==='STORAGE_NOT_CONFIGURED'?'STORAGE_CONFIGURATION':
      /^DATABASE_ERROR_(401|403)$/.test(reason)?'STORAGE_AUTH':
      reason==='DATABASE_ERROR_404'?'STORAGE_SCHEMA':
      /^DATABASE_ERROR_/.test(reason)?'STORAGE_WRITE_FAILED':'STORAGE_CONNECTION';
    console.error('[iphone-photos] persistence:',code);
    return json({error:'STORAGE_UNAVAILABLE',stage:'storage',code},503);
  }
}
export function GET(){return json({error:'METHOD_NOT_ALLOWED'},405);}

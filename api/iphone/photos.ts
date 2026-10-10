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
    const row=await saveDraft({
      owner_key:ownerKey(),
      image_digest:imageDigest,
      bank_fingerprint:fingerprint,
      type:candidate.type,
      amount_satang:candidate.amountSatang,
      transaction_date:candidate.date,
      category:candidate.category,
      note:candidate.note,
      method:'bank',source_label:candidate.sourceLabel
    });
    if(!row)return json({status:'duplicate',reviewRequired:false},200);
    return json({status:'pending',draftId:row.id,reviewRequired:true},202);
  }catch(e){
    if(e instanceof Error&&e.message==='DUPLICATE_IMAGE')
      return json({status:'duplicate',reviewRequired:false},200);
    if(e instanceof SyntaxError)return json({error:'BAD_JSON'},400);
    return json({error:'STORAGE_UNAVAILABLE'},503);
  }
}
export function GET(){return json({error:'METHOD_NOT_ALLOWED'},405);}

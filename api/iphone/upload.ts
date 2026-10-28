import {auth,MAX_IMAGE_BYTES,imageType,sha,ownerKey,saveDraft,json} from '../../server/iphone/bridge.js';
import {ocrImage} from '../../server/iphone/ocr.js';
import {isTrackingDate} from '../../src/lib/finance.js';

export const maxDuration=120;
export async function POST(request:Request):Promise<Response>{
  const access=auth(request,'upload');
  if(access==='unconfigured')return json({error:'NOT_CONFIGURED'},503);
  if(access!=='ok')return json({error:'UNAUTHORIZED'},401);
  const length=Number(request.headers.get('content-length')||0);
  if(length>MAX_IMAGE_BYTES+250000)return json({error:'IMAGE_TOO_LARGE'},413);
  const mime=request.headers.get('content-type')||'';
  if(!mime.toLowerCase().startsWith('multipart/form-data;'))return json({error:'MULTIPART_REQUIRED'},415);
  try {
    const form=await request.formData();
    const input=form.get('image');
    if(!(input instanceof File))return json({error:'IMAGE_REQUIRED'},400);
    if(input.size<=0||input.size>MAX_IMAGE_BYTES)return json({error:'IMAGE_TOO_LARGE'},413);
    const bytes=new Uint8Array(await input.arrayBuffer());
    if(!imageType(bytes,input.type))return json({error:'IMAGE_NOT_JPEG_PNG_WEBP'},415);
    // Distinguish OCR initialization/recognition failures from persistence failures.
    // Never put raw OCR text, account numbers, image contents or secret values in logs.
    let parsed:Awaited<ReturnType<typeof ocrImage>>;
    try{
      parsed=await ocrImage(bytes);
    }catch(e){
      const message=e instanceof Error?e.message:'';
      const code=/\.wasm|ENOENT|tesseract-core/iu.test(message)?'OCR_ENGINE_ASSET_MISSING':
        /traineddata|fetch failed|network|language|lang/iu.test(message)?'OCR_LANGUAGE_UNAVAILABLE':
        'OCR_ENGINE_UNAVAILABLE';
      console.error('[iphone-upload] OCR failed:',code);
      return json({error:'OCR_OR_STORAGE_UNAVAILABLE',stage:'ocr',code},503);
    }
    if(parsed.transaction_date&&!isTrackingDate(parsed.transaction_date))
      return json({status:'skipped',reason:'BEFORE_TRACKING_START'},200);
    try{
      const saved=await saveDraft({
        ...parsed,owner_key:ownerKey(),image_digest:sha(bytes),
        bank_fingerprint:parsed.bank_fingerprint?sha(parsed.bank_fingerprint):null
      });
      return json(saved?{status:'pending',draftId:saved.id,reviewRequired:true}:
        {status:'duplicate',reviewRequired:false},saved?202:200);
    }catch(e){
      if(e instanceof Error&&e.message==='DUPLICATE_IMAGE')return json({status:'duplicate'},200);
      const message=e instanceof Error?e.message:'';
      const code=/NOT_CONFIGURED|INVALID_SUPABASE_URL|REVIEW_SECRET/iu.test(message)?
        'STORAGE_CONFIGURATION':'STORAGE_WRITE_FAILED';
      console.error('[iphone-upload] Storage failed:',code);
      return json({error:'OCR_OR_STORAGE_UNAVAILABLE',stage:'storage',code},503);
    }
  }catch{
    return json({error:'BAD_MULTIPART_UPLOAD'},400);
  }
}
export function GET(){return json({error:'METHOD_NOT_ALLOWED'},405);}

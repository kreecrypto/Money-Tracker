import {auth,MAX_IMAGE_BYTES,imageType,sha,ownerKey,saveDraft,json} from '../../server/iphone/bridge';
import {ocrImage} from '../../server/iphone/ocr';

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
    const parsed=await ocrImage(bytes);
    const saved=await saveDraft({
      ...parsed,owner_key:ownerKey(),image_digest:sha(bytes),
      bank_fingerprint:parsed.bank_fingerprint?sha(parsed.bank_fingerprint):null
    });
    return json(saved?{status:'pending',draftId:saved.id,reviewRequired:true}:
      {status:'duplicate',reviewRequired:false},saved?202:200);
  }catch(e){
    if(e instanceof Error&&e.message==='DUPLICATE_IMAGE')return json({status:'duplicate'},200);
    // Return structured error, never log or echo OCR text, bank names or account numbers.
    return json({error:'OCR_OR_STORAGE_UNAVAILABLE'},503);
  }
}
export function GET(){return json({error:'METHOD_NOT_ALLOWED'},405);}

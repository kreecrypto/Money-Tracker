import {auth,MAX_IMAGE_BYTES,imageType,sha,ownerKey,saveDraft,json} from '../../server/iphone/bridge';
import {ocrImage} from '../../server/iphone/ocr';
import {IMAGE_BUCKET,changeImage,privatePath,storeImage,deleteImage,findDraftByDigest} from '../../server/iphone/imageStorage';

export const maxDuration=120;
export async function POST(request:Request):Promise<Response>{
  const access=auth(request,'upload');
  if(access==='unconfigured')return json({error:'NOT_CONFIGURED'},503);
  if(access!=='ok')return json({error:'UNAUTHORIZED'},401);
  const length=Number(request.headers.get('content-length')||0);
  if(length>MAX_IMAGE_BYTES+250000)return json({error:'IMAGE_TOO_LARGE'},413);
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('multipart/form-data;'))
    return json({error:'MULTIPART_REQUIRED'},415);

  let path:string|null=null;
  let draftId:string|null=null;
  const owner=ownerKey();
  try{
    const form=await request.formData();
    const input=form.get('image');
    if(!(input instanceof File))return json({error:'IMAGE_REQUIRED'},400);
    if(input.size<=0||input.size>MAX_IMAGE_BYTES)return json({error:'IMAGE_TOO_LARGE'},413);
    const bytes=new Uint8Array(await input.arrayBuffer());
    if(!imageType(bytes,input.type))return json({error:'IMAGE_NOT_JPEG_PNG_WEBP'},415);

    // OCR conservatively. Original bank balances are never used as transaction amounts.
    const parsed=await ocrImage(bytes);
    const digest=sha(bytes);
    let row=await saveDraft({...parsed,owner_key:owner,image_digest:digest,
      bank_fingerprint:parsed.bank_fingerprint?sha(parsed.bank_fingerprint):null});
    if(!row){
      const previous=await findDraftByDigest(owner,digest);
      if(!previous||previous.status!=='pending'||previous.image_status!=='upload_failed'||previous.image_path)
        return json({status:'duplicate',reviewRequired:false},200);
      // Same draft, retry of failed blob transfer only; never generate a new financial row.
      row=previous;
    }
    draftId=row.id;
    path=privatePath(owner,row.id,input.type);
    const uploadedAt=new Date();
    const expiresAt=new Date(uploadedAt.getTime()+7*24*60*60*1000);
    await changeImage(row.id,owner,{
      image_status:'uploading',image_bucket:IMAGE_BUCKET,image_path:path,
      image_mime:input.type,image_size_bytes:input.size,
      image_uploaded_at:uploadedAt.toISOString(),image_expires_at:expiresAt.toISOString()
    });
    await storeImage(path,bytes,input.type);
    await changeImage(row.id,owner,{image_status:'available',image_last_error_code:null});
    return json({status:'pending',draftId:row.id,reviewRequired:true,
      image:{available:true,expiresAt:expiresAt.toISOString()}},202);
  }catch(e){
    if(e instanceof Error&&e.message==='DUPLICATE_IMAGE')return json({status:'duplicate',reviewRequired:false},200);
    // A DB commit after the blob write can fail. Compensate and leave a retryable record.
    if(path){
      let removed=false;
      try{await deleteImage(path);removed=true;}catch{/* hourly sweep retries */}
      if(draftId){
        try{await changeImage(draftId,owner,{
          image_status:removed?'upload_failed':'delete_failed',
          image_path:removed?null:path,
          image_last_error_code:'UPLOAD_OR_PERSIST_FAILED'
        });}catch{/* orphan sweeper catches rows already marked uploading */}
      }
    }
    return json({error:'OCR_OR_STORAGE_UNAVAILABLE'},503);
  }
}
export function GET(){return json({error:'METHOD_NOT_ALLOWED'},405);}

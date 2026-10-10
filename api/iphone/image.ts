import {auth,appCors,options,json,ownerKey} from '../../server/iphone/bridge';
import {getImage,readDraft,expired,IMAGE_BUCKET} from '../../server/iphone/imageStorage';

export const maxDuration=20;
export {options as OPTIONS};
/** Fetch-through prevents browser-visible storage paths, signed URLs and leaked API keys. */
export async function GET(request:Request):Promise<Response>{
  const cors=appCors(request);
  if(!cors)return json({error:'ORIGIN_DENIED'},403);
  const result=auth(request,'review');
  if(result!=='ok')return json({error:result==='unconfigured'?'NOT_CONFIGURED':'UNAUTHORIZED'},
    result==='unconfigured'?503:401,cors);
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!/^[a-f0-9-]{36}$/i.test(id))return json({error:'INVALID_ID'},400,cors);
  try{
    const row=await readDraft(id,ownerKey());
    if(!row||row.status==='discarded'||row.image_status==='none'||row.image_status==='deleted'||!row.image_path)
      return json({error:'IMAGE_NOT_FOUND'},404,cors);
    if(expired(row))return json({error:'IMAGE_EXPIRED'},410,cors);
    if(row.image_status!=='available'||row.image_bucket!==IMAGE_BUCKET)
      return json({error:'IMAGE_UNAVAILABLE'},503,cors);
    const blob=await getImage(row.image_path);
    const body=await blob.arrayBuffer();
    if(expired(row))return json({error:'IMAGE_EXPIRED'},410,cors);
    return new Response(body,{status:200,headers:{
      'content-type':row.image_mime||'application/octet-stream',
      'content-length':String(body.byteLength),
      'cache-control':'private, no-store, max-age=0',
      'x-content-type-options':'nosniff',
      'content-security-policy':"default-src 'none'; sandbox",
      'access-control-allow-origin':cors['access-control-allow-origin'],
      vary:'Origin'
    }});
  }catch{
    return json({error:'IMAGE_UNAVAILABLE'},503,cors);
  }
}
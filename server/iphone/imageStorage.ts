import type {IPhoneDraft} from './bridge';

/** Only the server may access this private bucket. No public URLs or signed URLs. */
export const IMAGE_BUCKET='money-tracker-slip-temp';
export const MAX_IMAGE_BYTES=3*1024*1024;
type ImageStatus='none'|'uploading'|'available'|'upload_failed'|'deleting'|'deleted'|'delete_failed';
export type ImageRow=IPhoneDraft & {
  image_status:ImageStatus;image_bucket:string|null;image_path:string|null;
  image_mime:string|null;image_size_bytes:number|null;
  image_uploaded_at:string|null;image_expires_at:string|null;image_deleted_at:string|null;
  image_delete_attempts:number;image_last_error_code:string|null;
};

const config=()=>{
  const url=process.env.SUPABASE_URL||'';
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||!key) throw Error('STORAGE_NOT_CONFIGURED');
  return {url:url.replace(/\/$/,''),key};
};
const table='money_tracker_iphone_drafts';
async function checked(r:Response){
  if(!r.ok)throw Error('PRIVATE_STORAGE_'+r.status);
  return r;
}
async function db(path:string,method:'GET'|'PATCH',body?:Record<string,unknown>){
  const {url,key}=config();
  const r=await checked(await fetch(url+'/rest/v1/'+path,{
    method,headers:{apikey:key,authorization:'Bearer '+key,
      'content-type':'application/json',prefer:'return=representation'},
    body:body?JSON.stringify(body):undefined,cache:'no-store'
  }));
  return await r.json() as ImageRow[];
}
const filter=(id:string,owner:string)=>table+'?id=eq.'+encodeURIComponent(id)+'&owner_key=eq.'+encodeURIComponent(owner);
export async function readDraft(id:string,owner:string){
  const rows=await db(filter(id,owner)+'&select=*','GET');
  return rows[0]||null;
}
export async function changeImage(id:string,owner:string,patch:Record<string,unknown>){
  const rows=await db(filter(id,owner),'PATCH',patch);
  if(!rows[0])throw Error('IMAGE_DRAFT_NOT_FOUND');
  return rows[0];
}
function objectUrl(path:string){
  if(!/^drafts\/[a-f0-9]{12}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(path))
    throw Error('INVALID_PRIVATE_PATH');
  const {url}=config();
  return url+'/storage/v1/object/'+IMAGE_BUCKET+'/'+path;
}
export function mimeExtension(mime:string){
  return mime==='image/jpeg'?'jpg':mime==='image/png'?'png':mime==='image/webp'?'webp':null;
}
export function privatePath(owner:string,id:string,mime:string){
  const ext=mimeExtension(mime);
  if(!ext||!/^[0-9a-f]{64}$/.test(owner)||!/^[0-9a-f-]{36}$/.test(id))
    throw Error('INVALID_PRIVATE_PATH');
  return 'drafts/'+owner.slice(0,12)+'/'+id+'.'+ext;
}
export async function storeImage(path:string,bytes:Uint8Array,mime:string){
  const {key}=config();
  await checked(await fetch(objectUrl(path),{method:'POST',
    headers:{apikey:key,authorization:'Bearer '+key,'content-type':mime,'x-upsert':'false'},
    body:new Blob([Uint8Array.from(bytes)],{type:mime}),cache:'no-store'
  }));
}
/** Never creates a publicly accessible URL. */
export async function getImage(path:string){
  const {key}=config();
  return checked(await fetch(objectUrl(path),{
    headers:{apikey:key,authorization:'Bearer '+key},cache:'no-store'
  }));
}
export async function deleteImage(path:string){
  // Storage API must delete the blob and metadata together. Never DELETE FROM storage.objects.
  objectUrl(path);
  const {url,key}=config();
  const r=await fetch(url+'/storage/v1/object/'+IMAGE_BUCKET,{
    method:'DELETE',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},
    body:JSON.stringify({prefixes:[path]}),cache:'no-store'
  });
  await checked(r);
}
export function expired(row:ImageRow,now=Date.now()){
  return !row.image_expires_at||Date.parse(row.image_expires_at)<=now;
}
export function imageSummary(row:ImageRow){
  const status=row.image_status||'none';
  return {status,available:status==='available'&&!expired(row),
    expiresAt:row.image_expires_at||null};
}
/** Only chooses rows with physical object paths. Expiry is checked again on the image GET API. */
export async function purgeCandidates(now:Date,limit=40){
  const cutoff=encodeURIComponent(now.toISOString());
  const stale=encodeURIComponent(new Date(now.getTime()-20*60*1000).toISOString());
  const clauses='or=(image_status.eq.delete_failed,image_status.eq.deleting,and(image_expires_at.lte.'+cutoff+',image_status.in.(available,uploading,upload_failed)),and(image_status.in.(uploading,upload_failed),created_at.lte.'+stale+'))';
  return db(table+'?image_path=not.is.null&'+clauses+
    '&select=*&order=image_expires_at.asc.nullsfirst&limit='+Math.min(limit,100),'GET');
}
export async function purgeRow(row:ImageRow){
  if(!row.image_path)return {deleted:false};
  if(!expired(row)&&!(['uploading','upload_failed','delete_failed','deleting'].includes(row.image_status)||row.status==='discarded'))
    return {deleted:false};
  // Mark "deleting" before removing the object so a retry after crash is safe.
  const current=await changeImage(row.id,row.owner_key,{image_status:'deleting'});
  const path=current.image_path;
  if(!path)return {deleted:false};
  try{
    await deleteImage(path);
    await changeImage(row.id,row.owner_key,{
      image_status:'deleted',image_path:null,image_deleted_at:new Date().toISOString(),
      image_last_error_code:null
    });
    return {deleted:true};
  }catch{
    await changeImage(row.id,row.owner_key,{
      image_status:'delete_failed',image_last_error_code:'STORAGE_DELETE_FAILED',
      image_delete_attempts:Math.max(0,Number(row.image_delete_attempts)||0)+1
    });
    return {deleted:false};
  }
}

/** iOS Safari 17+ decodes HEIC natively; convert only in the browser, before OCR.
 * No upload to our API or third-party conversion service. Other browsers fail safely.
 */
export const MAX_SCAN_BYTES=10*1024*1024;
export const MAX_SCAN_EDGE=2600;
export type SlipFileDescriptor={name:string;type:string;size:number};
const STANDARD=new Set(['image/jpeg','image/png','image/webp']);
const HEIC=new Set(['image/heic','image/heif','image/heic-sequence','image/heif-sequence']);

export function isHeicSlip(file:Pick<SlipFileDescriptor,'name'|'type'>):boolean{
  return HEIC.has(file.type.toLowerCase())||/\.(heic|heif)$/i.test(file.name);
}
export function validateSlipFile(file:SlipFileDescriptor):'ok'|'size'|'type'{
  if(file.size<=0||file.size>MAX_SCAN_BYTES)return 'size';
  return STANDARD.has(file.type.toLowerCase())||isHeicSlip(file)?'ok':'type';
}
export function scaledSlipSize(width:number,height:number,maxEdge=MAX_SCAN_EDGE){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('ภาพไม่ถูกต้อง');
  const scale=Math.min(1,maxEdge/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
export async function prepareSlipForOcr(file:File):Promise<File>{
  const status=validateSlipFile(file);
  if(status==='size')throw Error('เลือกรูปขนาดไม่เกิน 10 MB');
  if(status==='type')throw Error('รองรับ JPG, PNG, WebP และ HEIC/HEIF จาก iPhone');
  if(!isHeicSlip(file))return file;
  // HEIC decoding is a native Safari/WebKit capability. Avoid misleading server-side conversion claims.
  if(typeof document==='undefined'||typeof Image==='undefined')throw Error('HEIC ต้องเปิดด้วย Safari บน iPhone หรือแปลงภาพเป็น JPG');
  const objectUrl=URL.createObjectURL(file);
  const image=new Image();
  try{
    await new Promise<void>((resolve,reject)=>{
      // Some Chromium versions never emit a decode error for an unsupported HEIC blob.
      // Fail closed rather than leaving the review scanner indefinitely busy.
      const fail=()=>reject(Error('ไม่สามารถอ่าน HEIC บนเบราว์เซอร์นี้ได้ กรุณาใช้ Safari หรือแปลงเป็น JPG'));
      const timer=setTimeout(fail,6000);
      image.onload=()=>{clearTimeout(timer);resolve();};
      image.onerror=()=>{clearTimeout(timer);fail();};
      image.src=objectUrl;
    });
    const {width,height}=scaledSlipSize(image.naturalWidth,image.naturalHeight);
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');
    if(!context)throw Error('เบราว์เซอร์ไม่รองรับการแปลง HEIC กรุณาใช้ JPG');
    context.drawImage(image,0,0,width,height);
    const result=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(
      blob=>blob?.type==='image/jpeg'?resolve(blob):reject(Error('แปลง HEIC ไม่สำเร็จ กรุณาใช้ JPG')),
      'image/jpeg',0.9
    ));
    if(result.size===0||result.size>MAX_SCAN_BYTES)throw Error('ภาพที่แปลงมีขนาดเกิน 10 MB กรุณาใช้ JPG');
    return new File([result],file.name.replace(/\.(heic|heif)$/i,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified});
  }finally{
    image.onload=null;image.onerror=null;
    URL.revokeObjectURL(objectUrl);
  }
}

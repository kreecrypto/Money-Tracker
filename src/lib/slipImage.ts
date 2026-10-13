/**
 * K PLUS OCR recovery only. Enhances receipt text locally in a disposable canvas.
 * No upload, base64 serialization, or persistent copy of the slip image.
 */
export function enhanceReceiptPixels(data:Uint8ClampedArray):void {
  const histogram=new Uint32Array(256);
  const count=data.length/4;
  for(let i=0;i<data.length;i+=4){
    const gray=Math.round((77*data[i]+150*data[i+1]+29*data[i+2])/256);
    histogram[gray]++;
  }
  // Percentile stretch is gentler than binarization on K PLUS' watermark background.
  const threshold=(fraction:number)=>{
    const target=count*fraction;
    let seen=0;
    for(let i=0;i<256;i++){seen+=histogram[i];if(seen>=target)return i;}
    return 255;
  };
  const dark=threshold(0.025),light=threshold(0.975);
  const span=light-dark;
  for(let i=0;i<data.length;i+=4){
    const gray=(77*data[i]+150*data[i+1]+29*data[i+2])/256;
    const mapped=span<36?gray:Math.max(0,Math.min(255,Math.round((gray-dark)*255/span)));
    const value=mapped>=235?255:Math.round(mapped);
    data[i]=data[i+1]=data[i+2]=value;
  }
}

export async function prepareSlipRecoveryImage(file:File):Promise<HTMLCanvasElement> {
  // A bitmap decoded from a file is local. Image() fallback helps older Safari builds.
  let source:ImageBitmap|HTMLImageElement;
  let revoke:(()=>void)|undefined;
  if(typeof createImageBitmap==='function'){
    source=await createImageBitmap(file);
  }else{
    const url=URL.createObjectURL(file);
    revoke=()=>URL.revokeObjectURL(url);
    const img=new Image();
    img.src=url;
    try{await img.decode();}catch(err){revoke();throw err;}
    source=img;
  }
  try{
    const width='naturalWidth' in source?source.naturalWidth:source.width;
    const height='naturalHeight' in source?source.naturalHeight:source.height;
    if(!width||!height)throw new Error('ไม่สามารถอ่านขนาดภาพสลิปได้');
    const scale=Math.min(1.35,1800/width,2100/height,Math.sqrt(2_700_000/(width*height)));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('เบราว์เซอร์ไม่รองรับการปรับภาพ OCR');
    ctx.drawImage(source,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    enhanceReceiptPixels(pixels.data);
    ctx.putImageData(pixels,0,0);
    return canvas;
  }finally{
    if('close' in source)source.close();
    revoke?.();
  }
}

/** iPhone Photos may give HEIC/HEIF bytes. Convert locally when Safari can decode them.
 * This intentionally does not upload, store, or share the original image. */
export async function prepareSlipOcrFile(file:File):Promise<File> {
  const heic=['image/heic','image/heif','image/heic-sequence','image/heif-sequence'].includes(file.type)||/\.(heic|heif)$/iu.test(file.name);
  if(!heic)return file;
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();
    image.src=url;
    try{await image.decode();}catch{throw new Error('อุปกรณ์นี้ยังเปิดภาพ HEIC ไม่ได้ กรุณาแชร์เป็น JPG แล้วอัปโหลดอีกครั้ง');}
    const canvas=document.createElement('canvas');
    const width=image.naturalWidth,height=image.naturalHeight;
    if(!width||!height)throw new Error('อ่านขนาดภาพ HEIC ไม่สำเร็จ');
    const scale=Math.min(1,2048/width,2560/height,Math.sqrt(3_500_000/(width*height)));
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('ไม่สามารถแปลงภาพ HEIC บนอุปกรณ์นี้ได้');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));
    if(!blob)throw new Error('แปลงภาพ HEIC ไม่สำเร็จ กรุณาเลือกภาพ JPG');
    return new File([blob],file.name.replace(/\.(?:heic|heif)$/iu,'.jpg'),{type:'image/jpeg'});
  }finally{URL.revokeObjectURL(url);}
}

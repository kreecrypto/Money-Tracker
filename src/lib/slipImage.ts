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

/** Higher scale helps narrow iPhone screenshots, but bounds device memory usage. */
export function receiptRecoveryScale(width:number,height:number):number {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
    throw new Error('ขนาดภาพสลิปไม่ถูกต้อง');
  return Math.min(width<1000?2:1.35,1800/width,2100/height,Math.sqrt(2_700_000/(width*height)));
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
    const scale=receiptRecoveryScale(width,height);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));
    canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw new Error('เบราว์เซอร์ไม่รองรับการปรับภาพ OCR');
    // Flatten transparent PNG pixels onto white. Black transparent pixels can
    // otherwise be interpreted as dark content during binarization.
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
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
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));
    if(!blob)throw new Error('แปลงภาพ HEIC ไม่สำเร็จ กรุณาเลือกภาพ JPG');
    return new File([blob],file.name.replace(/\.(?:heic|heif)$/iu,'.jpg'),{type:'image/jpeg'});
  }finally{URL.revokeObjectURL(url);}
}


/**
 * Find a single labelled payment region in Tesseract's transient OCR word
 * geometry. Only run this on K PLUS transfer/bill slips, never on itemised
 * receipts. A missing or ambiguous label means there is no safe crop.
 */
export type SlipAmountCrop={x:number;y:number;width:number;height:number};
type OcrBounds={x0:number;y0:number;x1:number;y1:number};
const isOcrBounds=(value:unknown):value is OcrBounds=>{
  if(!value||typeof value!=='object')return false;
  const b=value as Partial<OcrBounds>;
  return [b.x0,b.y0,b.x1,b.y1].every(n=>typeof n==='number'&&Number.isFinite(n)) &&
    (b.x1 as number)>(b.x0 as number)&&(b.y1 as number)>(b.y0 as number);
};
const PAYMENT_HEADING=/(?:^|\s)(?:จำนวน(?:\s*เงิน)?|ยอด(?:เงิน|ชำระ|จ่าย|โอน))\s*(?:[:：]|$|\s)/iu;
const NOT_PAYMENT=/(?:ค่าธรรมเนียม|ค่าบริการ|fee\b|ยอดคงเหลือ|เลข(?:ที่|บัญชี)|บัญชี|รหัสอ้างอิง|reference|สินค้า|ชิ้น|qty\b)/iu;
export function findKPlusAmountCrop(blocks:unknown,width:number,height:number):SlipAmountCrop|null {
  if(!Array.isArray(blocks)||!Number.isFinite(width)||!Number.isFinite(height)||width<50||height<50)return null;
  const headings:OcrBounds[]=[];
  for(const block of blocks.slice(0,100)){
    const paragraphs=block?.paragraphs;
    if(!Array.isArray(paragraphs))continue;
    for(const paragraph of paragraphs.slice(0,100)){
      const lines=paragraph?.lines;
      if(!Array.isArray(lines))continue;
      for(const line of lines.slice(0,150)){
        if(!Array.isArray(line?.words))continue;
        const words=(line.words as {text?:unknown;bbox?:unknown}[]).slice(0,100)
          .filter(w=>typeof w?.text==='string'&&isOcrBounds(w?.bbox));
        if(!words.length)continue;
        const label=words.map(w=>(w.text as string).trim()).join(' ').replace(/\s+/gu,' ').trim();
        if(!PAYMENT_HEADING.test(label)||NOT_PAYMENT.test(label))continue;
        const boxes=words.map(w=>w.bbox as OcrBounds);
        headings.push({
          x0:Math.min(...boxes.map(b=>b.x0)),
          y0:Math.min(...boxes.map(b=>b.y0)),
          x1:Math.max(...boxes.map(b=>b.x1)),
          y1:Math.max(...boxes.map(b=>b.y1)),
        });
      }
    }
  }
  // A crop is safe only when the payment heading is unambiguous.
  if(headings.length!==1)return null;
  const anchor=headings[0];
  if(anchor.y0<0||anchor.y1>height||anchor.x0<0||anchor.x1>width)return null;
  const y=Math.max(0,Math.floor(anchor.y0-height*0.02));
  const bottom=Math.min(height,Math.ceil(anchor.y1+Math.min(height*0.16,280)));
  const x=Math.floor(width*0.03);
  const right=Math.ceil(width*0.97);
  if(bottom-y<30||right-x<40)return null;
  return {x,y,width:right-x,height:bottom-y};
}

/** In-memory crop only; does not store or upload the user's slip. */
export function prepareKPlusAmountCrop(image:HTMLCanvasElement,region:SlipAmountCrop):HTMLCanvasElement {
  const scale=Math.min(2,1800/region.width,900/region.height);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(region.width*scale));
  canvas.height=Math.max(1,Math.round(region.height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('ไม่สามารถอ่านบริเวณจำนวนเงินได้');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,region.x,region.y,region.width,region.height,0,0,canvas.width,canvas.height);
  return canvas;
}

/**
 * Find the beneficiary text between the sender's masked account and the
 * payment heading. The right boundary excludes K PLUS's Thailand-2026
 * promotional artwork and the lower QR verification box. No fixed y-position
 * assumption: if either anchor was missed, leave the name pending.
 */
export function findKPlusRecipientCrop(blocks:unknown,width:number,height:number):SlipAmountCrop|null {
  if(!Array.isArray(blocks)||!Number.isFinite(width)||!Number.isFinite(height)||width<200||height<300)return null;
  const accounts:OcrBounds[]=[];
  const amounts:OcrBounds[]=[];
  const masked=/[xX*]{2,}(?:[\s-]?[xX*\d]){4,}/u;
  for(const block of blocks.slice(0,100)){
    if(!Array.isArray(block?.paragraphs))continue;
    for(const paragraph of block.paragraphs.slice(0,100)){
      if(!Array.isArray(paragraph?.lines))continue;
      for(const line of paragraph.lines.slice(0,150)){
        if(!Array.isArray(line?.words))continue;
        const words=(line.words as {text?:unknown;bbox?:unknown}[]).slice(0,100)
          .filter(w=>typeof w?.text==='string'&&isOcrBounds(w?.bbox));
        if(!words.length)continue;
        const label=words.map(w=>(w.text as string).trim()).join(' ').replace(/\s+/gu,' ').trim();
        const boxes=words.map(w=>w.bbox as OcrBounds);
        const rect={x0:Math.min(...boxes.map(b=>b.x0)),y0:Math.min(...boxes.map(b=>b.y0)),
          x1:Math.max(...boxes.map(b=>b.x1)),y1:Math.max(...boxes.map(b=>b.y1))};
        if(masked.test(label)&&rect.y1<height*0.52&&rect.y0>height*0.13)
          accounts.push(rect);
        if(PAYMENT_HEADING.test(label)&&!NOT_PAYMENT.test(label)&&rect.y0>height*0.44)
          amounts.push(rect);
      }
    }
  }
  // K PLUS-to-K PLUS transfers show a SECOND masked account below the
  // recipient. The uppermost account is the sender; reject near-tied anchors.
  accounts.sort((a,b)=>a.y0-b.y0);
  if(!accounts.length||amounts.length!==1)return null;
  if(accounts.length>1&&accounts[1].y0-accounts[0].y0<height*0.045)return null;
  const account=accounts[0],amount=amounts[0];
  const y=Math.ceil(account.y1+height*0.012);
  const bottom=Math.floor(amount.y0-height*0.015);
  const x=Math.floor(width*0.13),right=Math.ceil(width*0.72);
  if(bottom-y<height*0.07||bottom-y>height*0.40||right-x<80)return null;
  if(y<0||bottom>height||account.y0>=amount.y0)return null;
  return {x,y,width:right-x,height:bottom-y};
}

/** Focused recipient OCR is performed on an in-memory canvas only. */
export function prepareKPlusRecipientCrop(image:HTMLCanvasElement,region:SlipAmountCrop):HTMLCanvasElement {
  const scale=Math.min(2,1500/region.width,950/region.height);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(region.width*scale));
  canvas.height=Math.max(1,Math.round(region.height*scale));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('ไม่สามารถอ่านบริเวณชื่อผู้รับได้');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,region.x,region.y,region.width,region.height,0,0,canvas.width,canvas.height);
  return canvas;
}

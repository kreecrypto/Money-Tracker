import {MAX_SLIP_BATCH_FILES} from './slipBatch';

const formats:Record<string,string>={
  'image/png':'png','image/jpeg':'jpg','image/webp':'webp',
};

/**
 * iOS Safari exposes PNG images from the system clipboard only after a user
 * interaction. Files stay in memory and follow the same local OCR pipeline as
 * files chosen with the Photos picker; nothing is uploaded to the API.
 */
export async function clipboardSlipFiles(read:()=>Promise<ClipboardItem[]>):Promise<File[]> {
  const items=await read();
  const files:File[]=[];
  for(const item of items){
    const mime=item.types.find(type=>Object.hasOwn(formats,type));
    if(!mime)continue;
    const blob=await item.getType(mime);
    files.push(new File([blob],`shortcut-slip-${files.length+1}.${formats[mime]}`,{type:mime}));
    if(files.length>=MAX_SLIP_BATCH_FILES)break;
  }
  if(!files.length)throw new Error('ไม่พบรูปใน Clipboard กรุณารัน Shortcut ที่คัดลอกรูปสลิปก่อน');
  return files;
}

import {createWorker} from 'tesseract.js';

const MAX_BYTES=6*1024*1024;
export async function readLineBankImage(messageId:string,token:string):Promise<string>{
  if(!/^[A-Za-z0-9_-]{1,150}$/.test(messageId))throw new Error('INVALID_MESSAGE_ID');
  const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),12000);
  let bytes:Uint8Array;
  try{
    const response=await fetch('https://api-data.line.me/v2/bot/message/'+encodeURIComponent(messageId)+'/content',{
      headers:{authorization:'Bearer '+token},signal:abort.signal
    });
    if(!response.ok)throw new Error('LINE_MEDIA_UNAVAILABLE');
    const len=Number(response.headers.get('content-length')||0);
    const mime=(response.headers.get('content-type')||'').toLowerCase();
    if(len>MAX_BYTES)throw new Error('IMAGE_TOO_LARGE');
    if(!/^image\/(jpeg|png|webp)\b/.test(mime))throw new Error('IMAGE_TYPE_NOT_SUPPORTED');
    bytes=new Uint8Array(await response.arrayBuffer());
    if(bytes.byteLength>MAX_BYTES)throw new Error('IMAGE_TOO_LARGE');
  }finally{clearTimeout(timer);}
  // OCR runs on backend only; never write bank screenshots to database or app logs.
  const worker=await createWorker(['tha','eng'],1);
  try{
    const r=await worker.recognize(Buffer.from(bytes));
    return r.data.text.slice(0,20000);
  }finally{await worker.terminate();}
}

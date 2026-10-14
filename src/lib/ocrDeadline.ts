/** Bounded on-device OCR calls. A timeout never indicates that a payment succeeded. */
export const OCR_MODEL_TIMEOUT_MS=90_000;
export const OCR_PASS_TIMEOUT_MS=65_000;

export class OcrDeadlineError extends Error {
  constructor(stage:string){
    super(stage+'ใช้เวลานานเกินไป กรุณาลองใหม่ครั้งละ 1 รูปหรือเลือกภาพ JPG');
    this.name='OcrDeadlineError';
  }
}

/** Rejects a stalled OCR promise and clears its timer when work finishes. */
export function withOcrDeadline<T>(task:Promise<T>,timeoutMs:number,stage:string):Promise<T>{
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)
    throw new Error('กำหนดเวลา OCR ไม่ถูกต้อง');
  let timer:ReturnType<typeof setTimeout>|undefined;
  const deadline=new Promise<T>((_,reject)=>{
    timer=setTimeout(()=>reject(new OcrDeadlineError(stage)),timeoutMs);
  });
  return Promise.race([task,deadline]).finally(()=>{if(timer!==undefined)clearTimeout(timer);});
}

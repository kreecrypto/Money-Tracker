export const MAX_SLIP_BATCH_FILES=20;
export const MAX_SLIP_FILE_BYTES=10*1024*1024;
const SUPPORTED_IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp']);

export type SlipBatchStatus='saved'|'duplicate'|'incomplete'|'error';
export type SlipBatchOutcome={status:SlipBatchStatus;reason?:string};
export type SlipBatchRow={name:string;status:SlipBatchStatus;reason?:string};

export function validateSlipImage(file:Pick<File,'size'|'type'>):string|null {
  if(!SUPPORTED_IMAGE_TYPES.has(file.type))
    return 'รองรับ JPG, PNG และ WebP เท่านั้น หากเป็น HEIC กรุณาแปลงเป็น JPG ก่อน';
  if(file.size<=0||file.size>MAX_SLIP_FILE_BYTES)
    return 'รูปต้องมีขนาดมากกว่า 0 และไม่เกิน 10 MB';
  return null;
}

export function summarizeSlipBatch(rows:SlipBatchRow[]) {
  return {
    total:rows.length,
    saved:rows.filter(r=>r.status==='saved').length,
    duplicate:rows.filter(r=>r.status==='duplicate').length,
    incomplete:rows.filter(r=>r.status==='incomplete').length,
    errors:rows.filter(r=>r.status==='error').length,
  };
}

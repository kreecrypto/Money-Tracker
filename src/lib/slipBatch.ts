import type {EntryType} from './finance';
export const MAX_SLIP_BATCH_FILES=20;
export const MAX_SLIP_FILE_BYTES=10*1024*1024;
const SUPPORTED_IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp']);

export type SlipBatchStatus='saved'|'duplicate'|'incomplete'|'error'|'cancelled'|'undone'|'excluded';
export type SlipBatchOutcome={status:SlipBatchStatus;reason?:string;transactionId?:string;recipient?:string;amountSatang?:number;date?:string;pendingId?:string;direction?:EntryType};
export type SlipBatchDetails={sender?:string;senderBank?:string;recipientBank?:string;reference?:string;time?:string;reportedStatus?:string};
export type SlipBatchRow={name:string;status:SlipBatchStatus;reason?:string;transactionId?:string;recipient?:string;amountSatang?:number;date?:string;pendingId?:string;direction?:EntryType;details?:SlipBatchDetails};

export function validateSlipImage(file:Pick<File,'size'|'type'>&{name?:string}):string|null {
  const heic=/\.(?:heic|heif)$/iu.test(file.name||'');
  if(!SUPPORTED_IMAGE_TYPES.has(file.type)&&!['image/heic','image/heif','image/heic-sequence','image/heif-sequence'].includes(file.type)&&!heic)
    return 'รองรับ JPG, PNG, WebP และ HEIC/HEIF (เมื่อเบราว์เซอร์เปิดไฟล์ได้)';
  if(file.size<=0||file.size>MAX_SLIP_FILE_BYTES)
    return 'รูปต้องมีขนาดมากกว่า 0 และไม่เกิน 10 MB';
  return null;
}

export function summarizeSlipBatch(rows:SlipBatchRow[]) {
  const cancelled=rows.filter(r=>r.status==='cancelled').length;
  const undone=rows.filter(r=>r.status==='undone').length;
  const excluded=rows.filter(r=>r.status==='excluded').length;
  const queued=rows.filter(r=>r.status==='incomplete'&&!!r.pendingId).length;
  return {
    total:rows.length,
    saved:rows.filter(r=>r.status==='saved').length,
    duplicate:rows.filter(r=>r.status==='duplicate').length,
    incomplete:rows.filter(r=>r.status==='incomplete').length,
    errors:rows.filter(r=>r.status==='error').length,
    ...(cancelled?{cancelled}:{}),
    ...(undone?{undone}:{}),
    ...(excluded?{excluded}:{}),
    queued,
  };
}

export type SlipBatchSummary=ReturnType<typeof summarizeSlipBatch>;

/** A mixed income/expense batch must never be shown as one monetary total. */
export function savedSlipTotals(rows:readonly SlipBatchRow[]) {
  return rows.reduce((total,row)=>{
    if(row.status!=='saved'||!row.amountSatang)return total;
    if(row.direction==='income')total.incomeSatang+=row.amountSatang;
    else if(row.direction==='expense')total.expenseSatang+=row.amountSatang;
    else total.unknownSatang+=row.amountSatang;
    return total;
  },{incomeSatang:0,expenseSatang:0,unknownSatang:0});
}

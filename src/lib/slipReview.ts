import type {EntryType} from './finance.js';
import type {SlipFields} from './slip.js';
import type {SlipBatchSummary} from './slipBatch.js';

/** Never silently preselect an expense when OCR could not establish direction. */
export function correctionDirection(source:Pick<SlipFields,'direction'>):EntryType|'' {
  return source.direction??'';
}

export function isWalletFundingSlip(source:Pick<SlipFields,'directionReason'>):boolean {
  return source.directionReason.includes('เติมเงินเข้า e-Wallet');
}

export function pendingReviewCount(summary:Pick<SlipBatchSummary,'incomplete'>):number{
  return summary.incomplete;
}
export function shouldWarnBeforeLeaving(unresolved:number):boolean {
  return unresolved>0;
}

export function slipBatchHeading(summary:Pick<SlipBatchSummary,'total'|'saved'|'incomplete'|'errors'>):string {
  const pending=summary.incomplete+summary.errors;
  if(pending>0 && summary.saved>0)return `บันทึกแล้ว ${summary.saved} รูป · ยังต้องตรวจ ${pending} รูป`;
  if(pending>0)return `ยังมี ${pending} รูปที่ต้องตรวจ`;
  if(summary.saved>0)return `บันทึกสลิปสำเร็จ ${summary.saved} รูป`;
  return `ตรวจสลิปครบ ${summary.total} รูป`;
}

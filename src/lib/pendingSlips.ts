import {EXPENSE_CATEGORIES,INCOME_CATEGORIES,type EntryType,type Method} from './finance';
import type {SlipFields} from './slip';

/**
 * Persist only user-correctable structured fields. NEVER persist the uploaded
 * image or raw OCR text to the pending queue.
 */
export type PendingSlip={
  id:string;
  name:string;
  createdAt:number;
  updatedAt:number;
  amountSatang:number|null;
  date:string|null;
  time:string|null;
  recipient:string|null;
  /** Optional for older drafts; sender is the counterparty on incoming slips. */
  sender?:string|null;
  direction:EntryType|null;
  method:Method;
  category:string;
  directionReason:string;
  reason:string;
  kind:'wallet_topup'|'slip';
  imageHash?:string;
  /** K PLUS transaction reference only; NOT the full OCR text/QR payload. */
  receiptRef?:string;
};

export function makePendingSlip(slip:SlipFields,name:string,reason:string,id:string,now=Date.now()):PendingSlip{
  return {
    id,name:name.slice(0,160),createdAt:now,updatedAt:now,
    amountSatang:slip.amountSatang,date:slip.date,time:slip.time,
    recipient:slip.recipient?.trim().slice(0,160)||null,
    ...(slip.sender?.trim()?{sender:slip.sender.trim().slice(0,160)}:{}),
    direction:slip.direction,method:slip.method||'bank',category:slip.category||'อื่น ๆ',
    directionReason:slip.directionReason.slice(0,300),reason:reason.slice(0,400),
    kind:slip.directionReason.includes('เติมเงินเข้า e-Wallet')?'wallet_topup':'slip',
    ...(slip.imageHash?{imageHash:slip.imageHash}:{}),
    ...(slip.receipt?.source==='kplus'&&slip.receipt.receiptId?
      {receiptRef:slip.receipt.receiptId.slice(0,150)}:{}),
  };
}

export function isValidPendingSlip(value:unknown):value is PendingSlip{
  if(!value||typeof value!=='object')return false;
  const p=value as Partial<PendingSlip>;
  return typeof p.id==='string'&&p.id.length>0&&p.id.length<150&&
    typeof p.name==='string'&&p.name.length<=160&&
    typeof p.createdAt==='number'&&Number.isFinite(p.createdAt)&&
    typeof p.updatedAt==='number'&&Number.isFinite(p.updatedAt)&&
    (p.amountSatang===null||(typeof p.amountSatang==='number'&&
      Number.isSafeInteger(p.amountSatang)&&p.amountSatang>0&&p.amountSatang<=999_999_999))&&
    (p.date===null||(typeof p.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)))&&
    (p.time===null||(typeof p.time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)))&&
    (p.recipient===null||(typeof p.recipient==='string'&&p.recipient.length<=160))&&
    (p.sender===undefined||p.sender===null||(typeof p.sender==='string'&&p.sender.length<=160))&&
    (p.direction===null||p.direction==='income'||p.direction==='expense')&&
    ['bank','wallet','card','cash'].includes(p.method||'')&&
    typeof p.category==='string'&&p.category.length<=80&&
    typeof p.directionReason==='string'&&p.directionReason.length<=300&&
    typeof p.reason==='string'&&p.reason.length<=400&&
    (p.kind==='wallet_topup'||p.kind==='slip')&&
    (p.imageHash===undefined||(typeof p.imageHash==='string'&&/^[a-f0-9]{64}$/.test(p.imageHash)))&&
    (p.receiptRef===undefined||(typeof p.receiptRef==='string'&&p.receiptRef.length<=150));
}

export function pendingFingerprintMatch(a:PendingSlip,b:PendingSlip):boolean{
  if(a.id===b.id)return true;
  if(a.imageHash&&b.imageHash&&a.imageHash===b.imageHash)return true;
  return !!a.receiptRef&&!!b.receiptRef&&a.receiptRef===b.receiptRef;
}
export function pendingToSlipFields(p:PendingSlip):SlipFields{
  const category=(p.direction==='income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES).some(x=>x===p.category)
    ?p.category:'อื่น ๆ';
  return {
    amountSatang:p.amountSatang,date:p.date,time:p.time,recipient:p.recipient,
    ...(p.sender?.trim()?{sender:p.sender.trim()}:{}),
    direction:p.direction??(p.kind==='wallet_topup'?'expense':null),directionReason:p.kind==='wallet_topup'
      ?'เติมเงินเข้า e-Wallet จากบัญชีธนาคาร (รายจ่าย) · ผู้ใช้ตรวจข้อมูลแล้ว'
      :'ผู้ใช้ตรวจและยืนยันข้อมูลจากคิวรอตรวจ',
    method:p.method,category,
    // Keep reference dedupe only if the amount hasn't been changed; a corrected
    // amount must never silently reuse an unverified receipt totals object.
    ...(p.receiptRef&&p.amountSatang!==null?{receipt:{
      source:'kplus' as const,receiptId:p.receiptRef,
      paidSatang:p.amountSatang,items:[],itemsComplete:true,
    }}:{}),
    ...(p.imageHash?{imageHash:p.imageHash}:{}),
    rawText:'',warnings:[],
  };
}

/** Re-upload may complete a previously pending scan of the same exact bytes.
 * Never match on amount or payee alone: two legitimate payments may share them.
 */
export function matchingPendingBySlipHash(items:readonly PendingSlip[],slipHash:string|undefined):string[]{
  if(!slipHash||!/^[a-f0-9]{64}$/.test(slipHash))return [];
  return items.filter(p=>p.imageHash===slipHash).map(p=>p.id);
}

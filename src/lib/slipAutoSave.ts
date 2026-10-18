import {isValidTransaction,type Transaction} from './finance';
import type {SlipFields} from './slip';
import {receiptReconciliationError} from './receiptIntelligence';

export type AutoSlipDecision =
  | {status:'ready';transaction:Transaction}
  | {status:'duplicate'|'incomplete';reason:string};

/** No review means we must never guess missing/contradictory payment data. */
export function prepareAutoSlip(
  slip:SlipFields,
  existing:Transaction[],
  id:string,
  createdAt:number,
):AutoSlipDecision {
  if(slip.imageHash&&existing.some(t=>t.slipHash===slip.imageHash))
    return {status:'duplicate',reason:'รูปภาพสลิปนี้เคยบันทึกแล้ว'};
  if(slip.warnings.some(w=>w.includes('ต่างกัน')||w.includes('ขัดแย้ง')))
    return {status:'incomplete',reason:'พบยอดเงินหรือข้อมูลไม่ตรงกันในสลิป · ยังไม่บันทึก กรุณาตรวจจากรูปต้นฉบับ'};
  if(slip.warnings.some(w=>w.includes('ความมั่นใจต่ำ')))
    return {status:'incomplete',reason:'อ่านข้อมูลจากสลิปไม่ชัดเจน · ยังไม่บันทึก กรุณาตรวจจากรูปต้นฉบับ'};
  if(!slip.direction)
    return {status:'incomplete',reason:'ยังไม่ทราบว่าเป็นเงินเข้าหรือเงินออก · กรุณาเลือกประเภทรายการก่อนบันทึก'};
  if(slip.amountSatang===null||!Number.isSafeInteger(slip.amountSatang)||slip.amountSatang<=0)
    return {status:'incomplete',reason:'อ่านจำนวนเงินจากสลิปไม่ชัดเจน · ยังไม่บันทึก กรุณาตรวจยอดเงิน'};
  if(!slip.date||!slip.time||!slip.recipient?.trim())
    return {status:'incomplete',reason:'อ่านวันที่ เวลา หรือชื่อผู้รับไม่ครบ · กรุณาตรวจข้อมูลก่อนบันทึก'};

  if(slip.source&&!slip.receipt)
    return {status:'incomplete',reason:'ยังอ่านรายละเอียดใบเสร็จไม่ครบ จึงไม่บันทึกอัตโนมัติ'};
  if(slip.receipt){
    const mismatch=receiptReconciliationError(slip.receipt);
    if(mismatch)return {status:'incomplete',reason:mismatch};
  }
  const recipient=slip.recipient.trim().replace(/\s+/gu,' ');
  const transaction:Transaction={
    id,
    type:slip.direction,
    amountSatang:slip.amountSatang,
    category:slip.category||'อื่น ๆ',
    // Funding is counted on the source bank account, not a purchase in the
    // wallet. Make its accounting meaning visible in the transaction record.
    note:slip.direction==='expense'&&slip.directionReason.includes('เติมเงินเข้า e-Wallet')
      ?'เติมเงิน e-Wallet จากธนาคาร (หลีกเลี่ยงการนับรายจ่ายจาก Wallet ซ้ำ)':'',
    date:slip.date,
    time:slip.time,
    recipient,
    ...(slip.sender?.trim()?{sender:slip.sender.trim().replace(/\s+/gu,' ')}:{}),
    method:slip.method||'bank',
    ...(slip.receipt?{receipt:slip.receipt}:{}),
    ...(slip.imageHash?{slipHash:slip.imageHash}:{}),
    createdAt,
  };
  if(!isValidTransaction(transaction))
    return {status:'incomplete',reason:'ข้อมูลที่อ่านได้ไม่อยู่ในรูปแบบรายการที่ถูกต้อง จึงยังไม่บันทึก'};

  const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\s.,\-]/gu,'');
  const repeated=existing.some(t=>(
    !!transaction.receipt?.receiptId&&
    !!t.receipt?.receiptId&&
    t.receipt.source===transaction.receipt.source&&
    t.receipt.receiptId.toUpperCase()===transaction.receipt.receiptId.toUpperCase()
  )||(
    t.type===transaction.type &&
    t.amountSatang===transaction.amountSatang &&
    t.date===transaction.date &&
    t.method===transaction.method &&
    (t.time===undefined||t.time===transaction.time) &&
    !!t.recipient &&
    normalize(t.recipient)===normalize(recipient)
  ));
  if(repeated)return {status:'duplicate',reason:'สลิปนี้เคยบันทึกแล้ว · ระบบไม่เพิ่มรายการซ้ำ'};
  return {status:'ready',transaction};
}

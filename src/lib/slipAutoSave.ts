import {isValidTransaction,type Transaction} from './finance';
import type {SlipFields} from './slip';

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
  if(slip.warnings.some(w=>w.includes('ต่างกัน')))
    return {status:'incomplete',reason:'OCR อ่านข้อมูลไม่ตรงกันระหว่างสองรอบ จึงยังไม่บันทึก กรุณาลองรูปใหม่หรือกรอกเอง'};
  if(!slip.direction)
    return {status:'incomplete',reason:'ไม่สามารถระบุว่าเป็นรายรับหรือรายจ่ายจากสลิปนี้ได้ จึงยังไม่บันทึก กรุณาใช้สลิปที่ชัดเจนหรือกรอกเอง'};
  if(slip.amountSatang===null||!Number.isSafeInteger(slip.amountSatang)||slip.amountSatang<=0)
    return {status:'incomplete',reason:'อ่านจำนวนเงินไม่ได้แน่ชัด จึงยังไม่บันทึก กรุณาลองภาพใหม่หรือกรอกเอง'};
  if(!slip.date||!slip.time||!slip.recipient?.trim())
    return {status:'incomplete',reason:'อ่านวันที่ เวลา หรือชื่อผู้รับไม่ครบ จึงยังไม่บันทึก กรุณาลองภาพใหม่หรือกรอกเอง'};

  const recipient=slip.recipient.trim().replace(/\s+/gu,' ');
  const transaction:Transaction={
    id,
    type:slip.direction,
    amountSatang:slip.amountSatang,
    category:slip.category||'อื่น ๆ',
    note:'',
    date:slip.date,
    time:slip.time,
    recipient,
    method:slip.method||'bank',
    createdAt,
  };
  if(!isValidTransaction(transaction))
    return {status:'incomplete',reason:'ข้อมูลที่อ่านได้ไม่อยู่ในรูปแบบรายการที่ถูกต้อง จึงยังไม่บันทึก'};

  const normalize=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\s.,\-]/gu,'');
  const repeated=existing.some(t=>
    t.type===transaction.type &&
    t.amountSatang===transaction.amountSatang &&
    t.date===transaction.date &&
    t.method===transaction.method &&
    (t.time===undefined||t.time===transaction.time) &&
    !!t.recipient &&
    normalize(t.recipient)===normalize(recipient)
  );
  if(repeated)return {status:'duplicate',reason:'พบสลิปธุรกรรมนี้ในรายการแล้ว จึงไม่บันทึกซ้ำ'};
  return {status:'ready',transaction};
}

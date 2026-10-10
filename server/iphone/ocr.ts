import {createWorker} from 'tesseract.js';
import {parseBankNotice} from '../line/bank';
import {parseSlipText} from '../../src/lib/slip';
import type {EntryType} from '../../src/lib/finance';

export type OCRDraft={
  type:EntryType|null;amount_satang:number|null;transaction_date:string|null;
  category:string;note:string;method:'bank';source_label:string;bank_fingerprint:string|null;
};
export function extractBankDraft(raw:string):OCRDraft {
  const notice=parseBankNotice(raw);
  const bankLike=/(?:KBank|K PLUS|กสิกร|SCB|ไทยพาณิชย์|Krungthai|กรุงไทย|ยอดเงินคงเหลือ|รายการโอน\/ถอน|จากบัญชี)/i.test(raw);
  // Bank alerts may display large balances; NEVER fall back to generic currency parsing.
  const slip=bankLike?null:parseSlipText(raw);
  const bank=notice?.bank==='kbank'?'KBank':bankLike?'แจ้งเตือนธนาคาร':'สลิป/ภาพ';
  const validAmount=notice?.amountSatang??slip?.amountSatang??null;
  const date=notice?.date??slip?.date??null;
  return {
    type:notice?.type??null,
    amount_satang:validAmount,transaction_date:date,
    category:'อื่น ๆ',note:bank+' (ตรวจสอบก่อนบันทึก)',
    method:'bank',source_label:bank,
    bank_fingerprint:notice?.fingerprintSource||null
  };
}
export async function ocrImage(bytes:Uint8Array):Promise<OCRDraft>{
  const worker=await createWorker(['tha','eng'],1);
  try{
    const {data}=await worker.recognize(Buffer.from(bytes));
    return extractBankDraft(data.text.slice(0,20000));
  }finally{await worker.terminate();}
}

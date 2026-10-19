import {createWorker} from 'tesseract.js';
import {parseBankNotice} from '../line/bank.js';
import {parseSlipText} from '../../src/lib/slip.js';
import type {EntryType} from '../../src/lib/finance.js';

export type OCRDraft={
  type:EntryType|null;amount_satang:number|null;transaction_date:string|null;
  transaction_time:string|null;recipient:string|null;
  category:string;note:string;method:'bank';source_label:string;bank_fingerprint:string|null;
};
export function extractBankDraft(raw:string):OCRDraft {
  const notice=parseBankNotice(raw);
  // K PLUS transfer images are not KBank Live notifications. The old bankLike
  // exclusion discarded their entire receipt parser, including amounts.
  // Only parse an actual K PLUS payment/transfer receipt; do not parse a
  // balance-only banking screenshot with the generic currency fallback.
  const isKplusReceipt=/(?:K\\s*PLUS|กสิกรไทย|ธ\\.?กสิกรไทย|KBank)/iu.test(raw)&&
    /(?:โอนเงินสำเร็จ|จ่ายบิลสำเร็จ|ชำระเงินสำเร็จ|เติมเงินสำเร็จ|โอนสำเร็จ)/u.test(raw);
  const slip=isKplusReceipt?parseSlipText(raw):null;
  // Never use a bank notice fallback to override missing or conflicting K PLUS
  // slip data. Missing fields remain pending for user confirmation.
  const validAmount=slip?slip.amountSatang:notice?.amountSatang??null;
  const date=slip?slip.date:notice?.date??null;
  const time=slip?slip.time:notice?.time??null;
  const recipient=slip?slip.recipient:null;
  const type=slip?slip.direction:notice?.type??null;
  const bank=isKplusReceipt||notice?.bank==='kbank'?'KBank':'แจ้งเตือนธนาคาร';
  return {
    type,amount_satang:validAmount,transaction_date:date,
    transaction_time:time,recipient,
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

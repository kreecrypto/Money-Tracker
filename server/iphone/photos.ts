import {parseBankNotice} from '../line/bank';
import {parseSlipText} from '../../src/lib/slip';

/** Client first extracts text on iOS. Send ONLY receipt-like OCR text, not private photos. */
const THAI_DIGITS='๐๑๒๓๔๕๖๗๘๙';
const normalized=(text:string)=>text.normalize('NFKC')
  .replace(/[๐-๙]/g,ch=>String(THAI_DIGITS.indexOf(ch)))
  .replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').trim();

const BANK_BRAND=/(?:KBank|K\s*PLUS|กสิกร|SCB|ไทยพาณิชย์|Krungthai|กรุงไทย|Krungsri|กรุงศรี|ธนาคาร|ttb|กรุงเทพ|Bangkok Bank|PromptPay|พร้อมเพย์)/i;
const TRANSACTION=/(?:โอนเงินสำเร็จ|ทำรายการสำเร็จ|โอนเงิน|รับโอน|โอนเข้า|โอนออก|รายการโอน|รายการโอน\/ถอน|สลิป|ใบยืนยัน|transfer\s*(?:successful|completed)|transaction\s*(?:successful|completed)|payment\s*(?:successful|completed)|paid)/i;
const TRANSACTION_AMOUNT=/(?:จำนวน\s*เงิน(?:ที่\s*โอน)?|ยอด(?:โอน|ชำระ|จ่าย)|จำนวนที่โอน|ยอดชำระ|amount(?:\s*paid)?|total\s*(?:amount|paid))/i;
const BALANCE=/(?:ยอด(?:เงิน)?คงเหลือ|ยอดคงเหลือ|available\s*balance|\bbalance\b)/i;

export type PhotosCandidate={
  accept:boolean;
  reason:'receipt'|'not_receipt'|'no_transaction_amount'|'unreadable';
  amountSatang:number|null;
  date:string|null;
  type:'income'|'expense'|null;
  category:'อื่น ๆ';
  note:string;
  sourceLabel:string;
  fingerprint:string|null;
  normalizedText:string;
};
/**
 * Conservative parser for OCR sent by a Shortcuts automation.
 * Requires a transaction context AND an explicit amount label; never processes
 * random personal photos merely because they contain numbers/currency.
 */
export function inspectPhotosOCR(input:string):PhotosCandidate{
  const text=normalized(input).slice(0,12000);
  const base={category:'อื่น ๆ' as const,amountSatang:null,date:null,
    type:null,sourceLabel:'iPhone Photos',fingerprint:null,normalizedText:text};
  if(!text||text.length<12)return {...base,accept:false,reason:'unreadable',note:'อ่านข้อความสลิปไม่ชัดเจน'};
  const branded=BANK_BRAND.test(text);
  const transacted=TRANSACTION.test(text);
  if(!transacted||(!branded&&!/(?:สลิป|ใบยืนยัน|โอนเงินสำเร็จ|รายการโอน)/i.test(text))){
    return {...base,accept:false,reason:'not_receipt',note:'ไม่ใช่สลิปธนาคาร'};
  }
  if(!TRANSACTION_AMOUNT.test(text))
    return {...base,accept:false,reason:'no_transaction_amount',note:'ไม่พบช่องยอดเงินธุรกรรม'};
  // Remove account balance lines BEFORE generic fallback amount parsing.
  // When a balance shares a line with a valid amount, discard the whole line
  // instead of guessing which number belongs to the transaction.
  const safeText=text.split('\n').filter(line=>!BALANCE.test(line)).join('\n');
  if(!TRANSACTION_AMOUNT.test(safeText))
    return {...base,accept:false,reason:'no_transaction_amount',note:'ไม่พบยอดธุรกรรมที่แยกจากยอดคงเหลือ'};
  const notice=parseBankNotice(text);
  const slip=parseSlipText(safeText);
  const amountSatang=notice?.amountSatang??slip.amountSatang;
  const date=notice?.date??slip.date;
  const type=notice?.type??null;
  const sourceLabel=/(?:KBank|K\s*PLUS|กสิกร)/i.test(text)?'KBank / Photos':
    /(?:SCB|ไทยพาณิชย์)/i.test(text)?'SCB / Photos':
    /(?:Krungthai|กรุงไทย)/i.test(text)?'Krungthai / Photos':'Bank Slip / Photos';
  return {
    accept:true,reason:'receipt',amountSatang,date,type,
    category:'อื่น ๆ',note:sourceLabel+' (ตรวจสอบก่อนบันทึก)',
    sourceLabel,
    fingerprint:notice?.fingerprintSource||null,
    normalizedText:text
  };
}

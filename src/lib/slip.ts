import {toSatang,type EntryType,type Method,type ReceiptDetails} from './finance.js';
import {readReceiptDetails} from './receiptIntelligence.js';
import {parseSpecialReceipt,type ReceiptSource} from './receiptFormats.js';
import {parseKPlusSlip} from './kplus.js';

/** OCR parsing is intentionally conservative: uncertain values stay empty for human review. */
export type SlipFields = {
  amountSatang: number | null;
  date: string | null;
  time: string | null;
  recipient: string | null;
  /** Null when the receipt cannot reliably establish the user's cash-flow direction. */
  direction: EntryType | null;
  directionReason: string;
  /** Specialized receipt format and payment method, when reliably detected. */
  source?: ReceiptSource;
  method?: Method;
  category?: string;
  receipt?: ReceiptDetails;
  /** Hash populated after OCR from original image bytes; never from OCR text. */
  imageHash?: string;
  rawText: string;
  warnings: string[];
};

const AMOUNT_LABEL = /(?:จำนวน\s*เงิน(?:ที่\s*โอน)?|ยอด(?:เงิน|โอน|ชำระ|จ่าย)|จำนวน\s*[:：]|จำนวนที่โอน|total\s*(?:amount|paid)?|amount(?:\s*paid)?)/iu;
const EXCLUDED_AMOUNT = /(?:ค่าธรรมเนียม|ค่าบริการ|ยอดคงเหลือ|คงเหลือ|balance|fee|ค่าธรรมเนียมการโอน|เลขที่|รหัสอ้างอิง|reference|เลขอ้างอิง|บัญชี|account|หมายเลข)/iu;
const MONEY_RE = /(?:฿\s*|THB\s*)?(?:\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d{1,7}(?:\.\d{2})?)/giu;
const THAI_MONTHS = new Map<string,number>([
  ['ม.ค.',1],['มกราคม',1],['jan',1],['january',1],
  ['ก.พ.',2],['กุมภาพันธ์',2],['feb',2],['february',2],
  ['มี.ค.',3],['มีนาคม',3],['mar',3],['march',3],
  ['เม.ย.',4],['เมษายน',4],['apr',4],['april',4],
  ['พ.ค.',5],['พฤษภาคม',5],['may',5],
  ['มิ.ย.',6],['มิถุนายน',6],['jun',6],['june',6],
  ['ก.ค.',7],['กรกฎาคม',7],['jul',7],['july',7],
  ['ส.ค.',8],['สิงหาคม',8],['aug',8],['august',8],
  ['ก.ย.',9],['กันยายน',9],['sep',9],['sept',9],['september',9],
  ['ต.ค.',10],['ตุลาคม',10],['oct',10],['october',10],
  ['พ.ย.',11],['พฤศจิกายน',11],['nov',11],['november',11],
  ['ธ.ค.',12],['ธันวาคม',12],['dec',12],['december',12],
]);
const MONTH_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december|sept|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b|(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/iu;

/** OCR can emit Thai sara-am as combining nikhahit + sara-aa. Normalize before matching labels. */
export function normalizeSlipOcrText(text:string):string {
  return text.normalize('NFC')
    .replace(/\u0e4d\s*\u0e32/gu,'ำ')
    .replace(/[\u00a0\u200b\u200c\ufeff]/gu,' ')
    .replace(/[：]/gu,':')
    .replace(/[๐-๙]/gu,d=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)));
}

function parseMoney(line:string):number[] {
  const values:number[]=[];
  for(const match of line.matchAll(MONEY_RE)){
    const idx=match.index;
    const before=line[idx-1]||'';
    const after=line[idx+match[0].length]||'';
    // Exclude digits from dates, times, transfer reference numbers, and account numbers.
    if(/[\p{L}\d/.:\-]/u.test(before)||/[\d/.:\-]/u.test(after))continue;
    const amount=match[0].replace(/^(฿\s*|THB\s*)/iu,'').trim();
    const satang=toSatang(amount);
    if(satang&&satang<=999_999_999)values.push(satang);
  }
  return [...new Set(values)];
}

function parseAmount(lines:string[]):number|null {
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(!AMOUNT_LABEL.test(line)||EXCLUDED_AMOUNT.test(line))continue;
    // Keep only text following the label where possible.
    const label=AMOUNT_LABEL.exec(line);
    const after=label?line.slice(label.index+label[0].length):line;
    let candidates=parseMoney(after);
    if(!candidates.length)candidates=parseMoney(line.slice(0,label?.index??0));
    if(candidates.length===1)return candidates[0];
    if(candidates.length>1)continue;
    // A receipt's amount can be separated from its label by a blank/icon line.
    // Never read through a fee or reference label.
    for(let offset=1;offset<=3;offset++){
      const next=lines[i+offset]||'';
      if(!next||EXCLUDED_AMOUNT.test(next))break;
      candidates=parseMoney(next);
      if(candidates.length===1)return candidates[0];
      if(candidates.length>1)break;
    }
  }
  // Without an amount label, use only a single explicit currency value.
  const candidates=new Set<number>();
  for(const line of lines){
    if(EXCLUDED_AMOUNT.test(line)||!/(?:฿|\bTHB\b|บาท)/iu.test(line))continue;
    for(const value of parseMoney(line))candidates.add(value);
  }
  return candidates.size===1?[...candidates][0]:null;
}

function formatDate(y:number,m:number,d:number):string|null {
  const year=y>=2400&&y<=2700?y-543:y>=66&&y<=99?2500+y-543:y>=0&&y<=39?2000+y:y;
  if(year<2000||year>2100)return null;
  const date=new Date(Date.UTC(year,m-1,d));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return null;
  return `${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function parseDateLine(line:string):string|null {
  // ISO-like yyyy-mm-dd, sometimes printed in English on slips.
  const iso=line.match(/(?:^|[^\d])(20\d{2}|25\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/u);
  if(iso){const value=formatDate(+iso[1],+iso[2],+iso[3]);if(value)return value;}
  const numeric=line.match(/(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?!\d)/u);
  if(numeric){const value=formatDate(+numeric[3],+numeric[2],+numeric[1]);if(value)return value;}
  const name=line.match(MONTH_RE);
  if(name){
    const before=line.slice(0,name.index);
    const after=line.slice((name.index||0)+name[0].length);
    const day=before.match(/(\d{1,2})\s*$/u);
    const year=after.match(/^\s*,?\s*(\d{2,4})(?!\d)/u);
    if(day&&year)return formatDate(+year[1],THAI_MONTHS.get(name[0].toLowerCase())||0,+day[1]);
  }
  return null;
}

function parseDate(lines:string[]):string|null {
  // Prefer a value near an explicit date label rather than a second date (e.g. expiry).
  const dateLabel=/(?:วันที่(?:ทำรายการ|โอน)?|date(?:\s*\/\s*time)?|transaction\s*date)/iu;
  for(let i=0;i<lines.length;i++){
    if(dateLabel.test(lines[i])){
      const same=parseDateLine(lines[i]);if(same)return same;
      const next=parseDateLine(lines[i+1]||'');if(next)return next;
    }
  }
  for(const line of lines){const value=parseDateLine(line);if(value)return value;}
  return null;
}


function extractTime(line:string):string|null {
  // Only colon-separated clock values; never treat the cents in a money amount as a time.
  const match=line.match(/(?:^|[^\d])([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)(?!\d)/u);
  return match?`${match[1].padStart(2,'0')}:${match[2]}`:null;
}

function parseTime(lines:string[]):string|null {
  // K PLUS puts the successful payment date and time together near the header.
  const labelled=/(?:วันที่|เวลา|date|time|สำเร็จ)/iu;
  for(let i=0;i<lines.length;i++){
    if(!labelled.test(lines[i])&&!parseDateLine(lines[i]))continue;
    const same=extractTime(lines[i]);if(same)return same;
    const next=extractTime(lines[i+1]||'');
    if(next)return next;
  }
  // Standalone times must be clearly marked so we don't misread reference numbers.
  for(const line of lines){
    if(!/(?:เวลา|time|\bน\.)/iu.test(line))continue;
    const value=extractTime(line);if(value)return value;
  }
  return null;
}

function billRecipient(lines:string[]):string|null {
  // K PLUS bill-payment slips place the biller AFTER the sender's masked account,
  // not after a "ถึง" label. Prefer this block over the sender name above it.
  if(!lines.some(line=>/(?:จ่าย\s*บิล\s*สำเร็จ|ชำระ\s*บิล\s*สำเร็จ|bill\s*pay(?:ment)?\s*(?:success|complete|paid))/iu.test(line)))return null;
  const amountIndex=lines.findIndex(line=>AMOUNT_LABEL.test(line)&&!EXCLUDED_AMOUNT.test(line));
  const beforeAmount=lines.slice(0,amountIndex<0?lines.length:amountIndex);
  const accountIndex=beforeAmount.findIndex(line=>/(?:[xX*]{2,}[-xX*\d]{3,}|\*{3,}\d{2,})/u.test(line));
  if(accountIndex<0)return null; // Do not guess a recipient from an unstructured receipt.
  const biller=beforeAmount.slice(accountIndex+1);
  const selected:string[]=[];
  for(const line of biller){
    if(/^(?:\d[\d A-Za-z-]{5,}|(?:เลข|รหัส|อ้างอิง|reference|ref|account|บัญชี|ค่าธรรมเนียม))/iu.test(line))break;
    if(/[\d]/u.test(line)||!/[\p{L}]/u.test(line))break;
    if(line.length>70||/^(?:ธ\.|ธนาคาร|bank|จำนวน|amount|ยอด|บาท|สำเร็จ)/iu.test(line))break;
    selected.push(line);
    if(selected.length===3)break;
  }
  const name=selected.join(' ').replace(/\s+/gu,' ').trim();
  return name.length>=3&&name.length<=160?name:null;
}

function parseRecipient(lines:string[]):string|null {
  const label=/^(?:ถึง|ผู้รับ(?:เงิน|โอน)?|โอนไปยัง|ร้านค้า|recipient|to|merchant)\s*[:：\-]?\s*(.+)$/iu;
  for(const line of lines){
    const match=line.match(label);
    if(!match)continue;
    const raw=match[1].replace(/(?:\b\d[\d\s*xX*\-]{6,}\b|\b\d{6,}\b).*/u,'').replace(/\s{2,}/g,' ').trim();
    if(/[\p{L}]/u.test(raw)&&raw.length>=2&&!/^(?:ธนาคาร|bank|account|บัญชี)$/iu.test(raw))return raw.slice(0,80);
  }
  return billRecipient(lines);
}


/**
 * Classify only explicit payment or incoming/outgoing transaction language.
 * A generic transfer confirmation is not proof of the uploader's direction:
 * the same receipt can be saved by the sender (expense) or receiver (income).
 */
export function inferSlipDirection(rawText:string):{direction:EntryType|null;directionReason:string} {
  const lines=normalizeSlipOcrText(rawText).split(/\r?\n/u).map(x=>x.trim()).filter(Boolean);
  // Keep detection in the transaction header. Do not interpret beneficiary names,
  // bank descriptions, fee labels, or a transfer reference as account direction.
  const header=lines.slice(0,6)
    .filter(line=>!/^(?:ผู้รับ|ชื่อผู้รับ|ผู้จ่าย|ชื่อผู้จ่าย|ผู้โอน|ชื่อผู้โอน|จาก(?:บัญชี)?|ถึง|โอนไปยัง|เลข(?:บัญชี|ที่)|บัญชี|ธ[.]|ธนาคาร|recipient\s*[:：]|to\s*[:：]|from\s*[:：])/iu.test(line))
    .join(' ');
  const incoming=/(?:รับ\s*โอน(?:\s*เงิน)?\s*สำเร็จ|รับ\s*เงิน\s*สำเร็จ|ได้รับ\s*เงิน|โอน\s*เงิน\s*เข้า|โอน\s*เข้า\s*บัญชี|เงิน\s*เข้า(?:\s*บัญชี)?|ยอด\s*เงิน\s*เข้า|incoming\s*(?:transfer|payment)|money\s*received|payment\s*received|transfer\s*received)/iu.test(header);
  const outgoing=/(?:จ่าย\s*บิล(?:\s*สำเร็จ)?|ชำระ\s*(?:บิล|เงิน)(?:\s*สำเร็จ)?|จ่าย\s*เงิน\s*สำเร็จ|โอน\s*เงิน\s*ออก|โอน\s*ออก(?:\s*สำเร็จ)?|เงิน\s*ออก(?:\s*จาก\s*บัญชี)?|ถอน\s*เงิน\s*สำเร็จ|bill\s*payment\s*(?:success|complete|paid)|paid\s*successfully|payment\s*successful|outgoing\s*transfer)/iu.test(header);
  if(incoming&&outgoing)return {direction:null,directionReason:'พบข้อความทั้งเงินเข้าและเงินออกในสลิป กรุณาตรวจสอบและเลือกเอง'};
  if(incoming)return {direction:'income',directionReason:'พบข้อความระบุการรับเงินหรือโอนเงินเข้าบัญชี'};
  if(outgoing)return {direction:'expense',directionReason:'พบข้อความระบุการจ่ายบิล ชำระเงิน หรือเงินออกจากบัญชี'};
  return {direction:null,directionReason:'สลิปไม่ระบุชัดว่าเป็นเงินเข้าหรือเงินออก โปรดเลือกตามบัญชีของคุณ'};
}

export function parseSlipText(rawText:string,layoutLines:string[]=[]):SlipFields {
  const lines=normalizeSlipOcrText(rawText).split(/\r?\n/u)
    .map(x=>x.replace(/^[0◯○•●@]\s+(?=[A-Z])/u,'').trim())
    .filter(Boolean);
  const special=parseSpecialReceipt(lines);
  const kplus=special?null:parseKPlusSlip(lines);
  // A confirmed bill or wallet payment requires the actual tender/paid amount,
  // never the gross item subtotal or discount.
  const amountSatang=special?special.amountSatang:parseAmount(lines);
  const date=parseDate(lines);
  const time=parseTime(lines);
  const recipient=special?special.recipient:(kplus?.recipient||parseRecipient(lines));
  const inferred=inferSlipDirection(rawText);
  // A complete K PLUS sender-side confirmation is outgoing for its sender.
  // Keep incoming and contradictory OCR evidence conservative.
  const classified=special??(kplus?.direction&&inferred.direction===null&&
    !inferred.directionReason.includes('ทั้งเงินเข้าและเงินออก')?kplus:inferred);
  const {direction,directionReason}=classified;
  const source=special?.source;
  const method=special?.method;
  const category=special?.category;
  const receipt=special?readReceiptDetails(special.source,lines,amountSatang,layoutLines,recipient):
    kplus&&amountSatang!==null?{
      source:'kplus' as const,items:[],paidSatang:amountSatang,itemsComplete:true,
      ...(kplus.reference?{receiptId:kplus.reference}:{}),
      ...(recipient?{storeName:recipient}:{}),
    }:undefined;
  const warnings:string[]=[];
  if(!lines.length)warnings.push('ไม่พบตัวอักษรในรูปภาพ ลองถ่ายใหม่ให้ชัดขึ้น');
  if(amountSatang===null)warnings.push('ไม่สามารถระบุยอดโอนได้อย่างมั่นใจ กรุณากรอกยอดเอง');
  if(date===null)warnings.push('อ่านวันที่ไม่ชัดเจน กรุณาตรวจและกรอกวันที่ก่อนบันทึก');
  if(time===null)warnings.push('อ่านเวลาไม่ชัดเจน กรุณากรอกเวลาตามสลิป');
  if(recipient===null)warnings.push('อ่านชื่อผู้รับไม่ชัดเจน กรุณาตรวจและกรอกชื่อผู้รับ');
  return {amountSatang,date,time,recipient,direction,directionReason,source,method,category,receipt:receipt||undefined,rawText,warnings};
}


/** Only run a recovery OCR pass when one of the four user-required fields is missing. */
export function needsSlipOcrRecovery(result:SlipFields):boolean {
  return result.date===null||result.time===null||result.amountSatang===null||result.recipient===null||result.direction===null||result.receipt?.itemsComplete===false;
}

/** Merge two readings of the SAME photo without inventing conflicting financial data. */
export function mergeSlipOcrReadings(first:SlipFields,second:SlipFields):SlipFields {
  const conflicts:string[]=[];
  const select=<T extends string|number>(label:string,a:T|null,b:T|null):T|null=>{
    if(a===null)return b;
    if(b===null)return a;
    const norm=(v:T)=>typeof v==='string'
      ? normalizeSlipOcrText(v).toLocaleLowerCase('en').replace(/[\s.,\-]/gu,'')
      : v;
    if(norm(a)!==norm(b)){conflicts.push('OCR อ่าน'+label+'ต่างกันระหว่างสองรอบ กรุณาตรวจสอบจากสลิป');return null;}
    return a;
  };
  const amountSatang=select('จำนวนเงิน',first.amountSatang,second.amountSatang);
  const date=select('วันที่',first.date,second.date);
  const time=select('เวลา',first.time,second.time);
  const recipient=select('ชื่อผู้รับ',first.recipient,second.recipient);
  const direction=select('ประเภทรายรับรายจ่าย',first.direction,second.direction);
  const source=first.source&&second.source&&first.source!==second.source?undefined:(first.source||second.source);
  if(first.source&&second.source&&first.source!==second.source)
    conflicts.push('OCR อ่านประเภทสลิปต่างกันระหว่างสองรอบ กรุณาตรวจสอบ');
  const method=source===(first.source||undefined)?first.method:(second.method||first.method);
  const category=source===(first.source||undefined)?first.category:(second.category||first.category);
  const firstReceipt=first.receipt,secondReceipt=second.receipt;
  let receipt=firstReceipt?.itemsComplete?firstReceipt:(secondReceipt?.itemsComplete?secondReceipt:(firstReceipt||secondReceipt));
  if(firstReceipt&&secondReceipt&&firstReceipt.source===secondReceipt.source){
    if(firstReceipt.receiptId&&secondReceipt.receiptId&&firstReceipt.receiptId!==secondReceipt.receiptId){
      conflicts.push('OCR อ่านรหัสใบเสร็จต่างกันระหว่างสองรอบ กรุณาลองรูปใหม่');
      receipt=undefined;
    }else if(firstReceipt.itemsComplete&&secondReceipt.itemsComplete&&
      firstReceipt.items.length>0&&secondReceipt.items.length>0&&
      JSON.stringify(firstReceipt.items)!==JSON.stringify(secondReceipt.items)){
      conflicts.push('OCR อ่านรายการสินค้าต่างกันระหว่างสองรอบ กรุณาลองรูปใหม่');
      receipt=undefined;
    }
  }
  if(receipt&&amountSatang!==receipt.paidSatang)receipt=undefined;
  const directionReason=direction?(first.direction===direction?first.directionReason:second.directionReason):'สลิปยังไม่สามารถระบุรายรับหรือรายจ่ายได้ชัดเจน กรุณาเลือกเอง';
  const warnings=[...conflicts];
  if(amountSatang===null&&!conflicts.some(x=>x.includes('จำนวนเงิน')))warnings.push('อ่านจำนวนเงินไม่ได้ กรุณากรอกเอง');
  if(date===null&&!conflicts.some(x=>x.includes('วันที่')))warnings.push('อ่านวันที่ไม่ได้ กรุณากรอกเอง');
  if(time===null&&!conflicts.some(x=>x.includes('เวลา')))warnings.push('อ่านเวลาไม่ได้ กรุณากรอกเอง');
  if(recipient===null&&!conflicts.some(x=>x.includes('ชื่อผู้รับ')))warnings.push('อ่านชื่อผู้รับไม่ได้ กรุณากรอกเอง');
  return {amountSatang,date,time,recipient,direction,directionReason,source,method,category,receipt,warnings,rawText:
    first.rawText+'\n\n--- รอบปรับภาพ ---\n'+second.rawText};
}

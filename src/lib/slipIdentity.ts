import type {EntryType} from './finance.js';

export type SlipParties={sender:string|null;recipient:string|null};
export type PersonalDirection={direction:EntryType|null;directionReason:string};

/** Exact account-holder aliases only: never use fuzzy/substring matching for money. */
export function normalizeAccountName(value:string):string {
  return value.normalize('NFKC')
    .replace(/\u0e4d\s*\u0e32/gu,'ำ')
    .toLocaleLowerCase('th-TH')
    .trim()
    .replace(/^(?:นาย|นางสาว|นาง|น\.?\s*ส\.?|ด\.?\s*ช\.?|ด\.?\s*ญ\.?|mr\.?|mrs\.?|miss\.?|ms\.?)\s*/iu,'')
    .replace(/[\s.,\-–—'’()]/gu,'');
}

/** At most eight locally stored aliases; keep original names for display/edit. */
export function sanitizeOwnerNames(values:unknown):string[] {
  if(!Array.isArray(values))return [];
  const seen=new Set<string>();
  const names:string[]=[];
  for(const value of values){
    if(typeof value!=='string')continue;
    const original=value.replace(/\s+/gu,' ').trim().slice(0,160);
    const key=normalizeAccountName(original);
    if(key.length<3||seen.has(key))continue;
    seen.add(key);
    names.push(original);
    if(names.length>=8)break;
  }
  return names;
}

const SENDER=/^(?:ชื่อ\s*ผู้(?:โอน|ส่ง|จ่าย)|ผู้(?:โอน|ส่ง|จ่าย)(?:เงิน)?|จาก(?:บัญชี)?|sender|from|payer)\s*[:：\-]?\s*(.*)$/iu;
const RECIPIENT=/^(?:ชื่อ\s*ผู้รับ(?:เงิน)?|ผู้รับ(?:เงิน|โอน)?|โอนไปยัง|ถึง|recipient|to|payee)\s*[:：\-]?\s*(.*)$/iu;
const BAD_NAME=/^(?:ธ\.?|ธนาคาร|bank\b|บัญชี|เลข(?:ที่|บัญชี)|รหัส|prompt\s*pay|พร้อมเพย์|จำนวน|ยอด|วันที่|เวลา|date\b|time\b|reference|ref\b|หมายเหตุ|ชำระ|โอนเงินสำเร็จ|จ่ายบิลสำเร็จ)/iu;
const BANK_NAME=/(?:ธ\.?\s*กสิกรไทย|ธนาคาร\s*กสิกรไทย|kasikorn\s*bank|kbank)/iu;
const MASKED=/[xX*]{2,}(?:[\s-]?[xX*\d]){4,}/u;

function personName(value:string):string|null {
  const cleaned=value.replace(/^[◯○●•▫▸→✓]\s*/u,'')
    .replace(/\s+(?:ธ\.?|ธนาคาร|bank|เลขบัญชี|account)\b.*$/iu,'')
    .replace(/\s+/gu,' ').trim();
  if(cleaned.length<3||cleaned.length>160||BAD_NAME.test(cleaned)||
    /(?:\d{2}[:/]\d{2}|\d{5,}|[xX*]{3})/u.test(cleaned)||
    !/[\p{L}]/u.test(cleaned))return null;
  return cleaned;
}

/** Extract labelled sender/receiver and K PLUS's sender-name / masked-account block. */
export function extractSlipParties(lines:string[],kplusRecipient:string|null=null):SlipParties {
  const found:{sender:Set<string>;recipient:Set<string>}={sender:new Set(),recipient:new Set()};
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    for(const [kind,label] of [['sender',SENDER],['recipient',RECIPIENT]] as const){
      const match=line.match(label);
      if(!match)continue;
      const candidate=personName(match[1]||'')||
        ((!match[1]||!match[1].trim())?personName(lines[i+1]||''):null);
      if(candidate)found[kind].add(candidate);
    }
  }
  if(kplusRecipient){
    found.recipient.add(kplusRecipient);
    const bankIndex=lines.findIndex(line=>BANK_NAME.test(line));
    if(bankIndex>=1&&lines.slice(bankIndex+1,bankIndex+5).some(line=>MASKED.test(line))){
      const sender=personName(lines[bankIndex-1]||'');
      if(sender)found.sender.add(sender);
    }
  }
  const choose=(names:Set<string>):string|null=>{
    const keys=new Set([...names].map(normalizeAccountName));
    return keys.size===1?[...names][0]:null;
  };
  return {sender:choose(found.sender),recipient:choose(found.recipient)};
}

/**
 * User identity is the reference frame for cash flow, not the slip title.
 * Both parties are required to avoid marking a forwarded slip as a payment.
 */
export function classifyByAccountNames(
  parties:SlipParties,ownerNames:readonly string[]
):PersonalDirection {
  const own=new Set(sanitizeOwnerNames([...ownerNames]).map(normalizeAccountName));
  if(!own.size)return {direction:null,directionReason:'ยังไม่ได้ตั้งค่าชื่อเจ้าของบัญชี'};
  if(!parties.sender||!parties.recipient)
    return {direction:null,directionReason:'อ่านชื่อผู้ส่งและผู้รับได้ไม่ครบ จึงยังไม่ระบุรายรับหรือรายจ่ายอัตโนมัติ'};
  const senderMine=own.has(normalizeAccountName(parties.sender));
  const recipientMine=own.has(normalizeAccountName(parties.recipient));
  if(senderMine&&recipientMine)
    return {direction:null,directionReason:'ผู้ส่งและผู้รับเป็นบัญชีของตัวเอง (โอนระหว่างบัญชี) ไม่นับเป็นรายรับหรือรายจ่ายอัตโนมัติ'};
  if(senderMine)
    return {direction:'expense',directionReason:'ชื่อผู้ส่งตรงกับชื่อเจ้าของบัญชี: เงินออก / รายจ่าย'};
  if(recipientMine)
    return {direction:'income',directionReason:'ชื่อผู้รับตรงกับชื่อเจ้าของบัญชี: เงินเข้า / รายรับ'};
  return {direction:null,directionReason:'ชื่อผู้ส่งและผู้รับไม่ตรงกับชื่อเจ้าของบัญชีที่ตั้งค่าไว้ กรุณาตรวจสอบ'};
}

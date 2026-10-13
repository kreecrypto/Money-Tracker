/**
 * Extracts beneficiaries and transaction references from sender-side K PLUS slips.
 * Only consumes OCR text; original bank photos/account numbers are not retained.
 */
export type KPlusSlip = {
  recipient: string | null;
  reference: string | null;
  direction: 'expense' | null;
  directionReason: string;
};
const CONFIRMATION = /(?:โอน\s*เงิน|จ่าย\s*บิล|ชำระ\s*เงิน)\s*สำเร็จ/iu;
const SENDER_BANK = /(?:ธ\.?\s*กสิกรไทย|ธนาคาร\s*กสิกรไทย|kasikorn\s*bank|kbank)/iu;
const MASKED_ACCOUNT = /[xX*]{2,}(?:[\s-]?[xX*\d]){4,}/u;
const AMOUNT_LABEL = /^(?:จำนวน(?:\s*เงิน)?|ยอด(?:เงิน|ชำระ|จ่าย|โอน))\s*[:：]?/iu;
const STOP_LABEL = /^(?:ค่าธรรมเนียม|เลขที่\s*รายการ|รหัส\s*อ้างอิง|สแกน|ตรวจสอบ\s*สลิป|หมายเหตุ|บันทึก\s*ช่วยจำ)/iu;
const DETAIL_LABEL = /^(?:รหัส\s*พร้อมเพย์|พร้อมเพย์|prompt\s*pay|ธ\.|ธนาคาร|เลข(?:\s*ที่)?\s*บัญชี|บัญชี|account|reference|ref\s*[:：]|เลข(?:\s*ที่)?\s*อ้างอิง)/iu;
const NUMERIC_ID = /^(?:[\d\s-]{5,}|[A-Z\d-]{6,})$/u;
function textLine(raw: string): string {
  return raw.normalize('NFC').replace(/\u0e4d\s*\u0e32/gu, 'ำ')
    .replace(/^[\s◯○●•▫▸→✓]*0\s+(?=[A-Za-zก-๙])/u, '')
    .replace(/^[\s◯○●•▫▸→✓]+/u, '')
    .replace(/\s+/gu, ' ').trim();
}
function cleanRecipient(line: string): string {
  return textLine(line).replace(/^(?:ผู้รับ(?:เงิน)?|ถึง|ร้านค้า|recipient|merchant)\s*[:：]\s*/iu, '').trim();
}
function referenceFrom(lines: string[]): string | null {
  for (let i=0; i<lines.length; i++) {
    const match=lines[i].match(/(?:เลขที่\s*รายการ|transaction\s*(?:id|no\.?))\s*[:：#]?\s*([A-Z\d]{12,48})\s*$/iu);
    const next=lines[i].match(/^(?:เลขที่\s*รายการ|transaction\s*(?:id|no\.?))\s*[:：#]?\s*$/iu)
      ? lines[i+1] : undefined;
    const reference=(match?.[1]||next||'').replace(/\s+/gu, '').toUpperCase();
    if (/^[A-Z\d]{12,48}$/u.test(reference) && /\d/u.test(reference)) return reference;
  }
  return null;
}
/** Avoid applying sender-side assumptions to generic receipts or bank notifications. */
export function parseKPlusSlip(ocrLines: string[]): KPlusSlip | null {
  const lines=ocrLines.map(textLine).filter(Boolean);
  const header=lines.slice(0,5).join(' ');
  if (!CONFIRMATION.test(header) || /(?:รับ\s*เงิน\s*สำเร็จ|เงิน\s*เข้า\s*บัญชี)/iu.test(header)) return null;
  const bankIndex=lines.findIndex(line=>SENDER_BANK.test(line));
  if (bankIndex<0) return null;
  let senderAccountIndex=-1;
  for(let i=bankIndex+1; i<Math.min(bankIndex+5,lines.length); i++) {
    if (MASKED_ACCOUNT.test(lines[i])) {senderAccountIndex=i;break;}
    if (AMOUNT_LABEL.test(lines[i])) break;
  }
  if(senderAccountIndex<0)return null;
  const recipientLines:string[]=[];
  for(const line of lines.slice(senderAccountIndex+1)) {
    if(AMOUNT_LABEL.test(line)||STOP_LABEL.test(line)||DETAIL_LABEL.test(line))break;
    if(MASKED_ACCOUNT.test(line)||(NUMERIC_ID.test(line)&&/\d/u.test(line))||
      /^(?:SCB|KTB|KBANK)$/u.test(line)||!/[\p{L}]/u.test(line))break;
    const name=cleanRecipient(line);
    if(!name||name.length>90)break;
    recipientLines.push(name);
    if(recipientLines.length>=3)break;
  }
  const recipient=recipientLines.reduce((joined,part)=>joined.endsWith('-')?joined+part:joined?joined+' '+part:part,'')
    .replace(/\s+/gu,' ').trim()||null;
  const reference=referenceFrom(lines);
  const expense=!!recipient&&lines.some(line=>AMOUNT_LABEL.test(line));
  return {
    recipient, reference,
    direction:expense?'expense':null,
    directionReason:expense
      ?'สลิป K PLUS ระบุบัญชีผู้โอนและผู้รับชัดเจน (ถือเป็นรายจ่ายของผู้โอน)'
      :'สลิป K PLUS ยังระบุบัญชีผู้โอนหรือผู้รับไม่ครบ กรุณาตรวจสอบ',
  };
}

/**
 * Wallet funding is an asset transfer (bank -> wallet), not necessarily a
 * purchase. Recording it as an expense and then recording wallet purchases
 * again would double count spending. Require a deliberate user decision.
 */
export function parseKPlusTopUp(ocrLines:string[]):{recipient:string;directionReason:string}|null{
  const lines=ocrLines.map(textLine).filter(Boolean);
  const header=lines.slice(0,5).join(' ');
  if(!/เติม\s*เงิน\s*สำเร็จ/iu.test(header))return null;
  if(!lines.some(line=>SENDER_BANK.test(line)))return null;
  if(!lines.some(line=>MASKED_ACCOUNT.test(line)))return null;
  const wallet=lines.find(line=>/(?:g[\s-]*wallet|พร้อม\s*เพย์\s*อี[\s-]*วอลเล็ต|e[\s-]*wallet)/iu.test(line));
  if(!wallet)return null;
  return {
    recipient: wallet.slice(0,160),
    directionReason:'เติมเงินเข้า e-Wallet อาจเป็นการโอนเงินระหว่างบัญชีของตนเอง จึงยังไม่บันทึกเป็นรายจ่ายอัตโนมัติ',
  };
}

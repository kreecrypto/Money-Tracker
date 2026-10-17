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
const CONFIRMATION = /(?:โอน\s*เงิน|จ่าย\s*บิล|ชำระ\s*เงิน|เติม\s*เงิน)\s*สำเร็จ/iu;
const SENDER_BANK = /(?:ธ\.?\s*กสิกรไทย|ธนาคาร\s*กสิกรไทย|kasikorn\s*bank|kbank)/iu;
const MASKED_ACCOUNT = /[xX*]{2,}(?:[\s-]?[xX*\d]){4,}/u;
const AMOUNT_LABEL = /^(?:จำนวน(?:\s*เงิน)?|ยอด(?:เงิน|ชำระ|จ่าย|โอน))\s*[:：]?/iu;
const STOP_LABEL = /^(?:ค่าธรรมเนียม|เลขที่\s*รายการ|รหัส\s*อ้างอิง|สแกน|ตรวจสอบ\s*สลิป|หมายเหตุ|บันทึก\s*ช่วยจำ)/iu;
const DETAIL_LABEL = /^(?:รหัส\s*พร้อมเพย์|พร้อมเพย์|prompt\s*pay|ธ\.|ธนาคาร|เลข(?:\s*ที่)?\s*บัญชี|บัญชี|account|reference|ref\s*[:：]|เลข(?:\s*ที่)?\s*อ้างอิง)/iu;
const NUMERIC_ID = /^(?:[\d\s-]{5,}|[A-Z\d-]{6,})$/u;
/** Limit focused OCR retries to explicit K PLUS payment confirmations.
 * Top-ups count as bank outflows, not deposits into the user's budget. */
export function isKPlusPaymentForOcrRecovery(text:string):boolean {
  return (SENDER_BANK.test(text)||/(?:K\s*PLUS|kasikorn)/iu.test(text))
    && CONFIRMATION.test(text);
}
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
    // Promotional text in the right column sometimes precedes or gets merged
    // with recipient text in Tesseract's full-page reading order.
    if(/^(?:THAILAND\s*2026|ไทยพร้อมเป็นเจ้าภาพ|การประชุมประจำปี|กองทุนการเงินระหว่างประเทศ)/iu.test(line))continue;
    if(AMOUNT_LABEL.test(line)||STOP_LABEL.test(line)||DETAIL_LABEL.test(line))break;
    if(MASKED_ACCOUNT.test(line)||(NUMERIC_ID.test(line)&&/\d/u.test(line))||
      /^(?:SCB|KTB|KBANK)$/u.test(line)||!/[\p{L}]/u.test(line))break;
    const name=cleanRecipient(line).replace(/\s+(?:THAILAND\s*2026|ไทยพร้อมเป็นเจ้าภาพ).*$/iu,'').trim();
    if(!name||name.length>90)break;
    recipientLines.push(name);
    if(recipientLines.length>=3)break;
  }
  const recipient=recipientLines.reduce((joined,part)=>joined.endsWith(' -')?joined+' '+part:joined.endsWith('-')?joined+part:joined?joined+' '+part:part,'')
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
 * Read a recipient from a tightly bounded K PLUS beneficiary image region.
 * Unlike whole-page OCR, the crop has already been anchored between the
 * sender's masked account and the payment heading. Never inspect payer names.
 * Skip the promotional watermark, bank sublabels and payment identifiers.
 */
export function parseKPlusRecipientRegion(ocrText:string):string|null {
  const rows=ocrText.split(/\r?\n/u).map(textLine).filter(Boolean);
  const selected:string[]=[];
  for(const original of rows.slice(0,18)){
    let line=cleanRecipient(original).replace(
      /\s+(?:THAILAND\s*2026|ไทยพร้อมเป็นเจ้าภาพ|สแกน\s*ตรวจสอบสลิป).*$/iu,''
    ).trim();
    if(!line)continue;
    if(AMOUNT_LABEL.test(line)||STOP_LABEL.test(line))break;
    if(DETAIL_LABEL.test(line)||MASKED_ACCOUNT.test(line)){
      if(selected.length)break;
      continue;
    }
    if(/(?:THAILAND\s*2026|ไทยพร้อมเป็นเจ้าภาพ|การประชุมประจำปี|กองทุนการเงินระหว่างประเทศ)/iu.test(line))continue;
    if(/^(?:โอนเงินสำเร็จ|ชำระเงินสำเร็จ|จ่ายบิลสำเร็จ|(?:วันที่|เวลา|amount|fee|reference|เลขที่รายการ)\b|สแกน|ตรวจสอบสลิป)/iu.test(line))continue;
    if(NUMERIC_ID.test(line)&&/\d/u.test(line))break;
    if(/^\d/u.test(line)||line.length>90||!/[\p{L}]/u.test(line)){
      if(selected.length)break;
      continue;
    }
    selected.push(line);
    if(selected.length>=3)break;
  }
  const name=selected.join(' ').replace(/\s+/gu,' ').trim();
  return name.length>=3&&name.length<=160?name:null;
}

/** A verified K PLUS "เติมเงินสำเร็จ" is an expense in Money Tracker's
 * bank-outflow ledger. Later wallet purchases should not be counted twice. */
export function parseKPlusTopUp(ocrLines:string[]):{recipient:string;directionReason:string;kind:'truemoney'|'wallet_transfer'}|null{
  const lines=ocrLines.map(textLine).filter(Boolean);
  const header=lines.slice(0,5).join(' ');
  if(!/เติม\s*เงิน\s*สำเร็จ/iu.test(header))return null;
  if(!lines.some(line=>SENDER_BANK.test(line)))return null;
  if(!lines.some(line=>MASKED_ACCOUNT.test(line)))return null;
  const walletIndex=lines.findIndex(line=>/(?:g[\s-]*wallet|พร้อม\s*เพย์\s*อี[\s-]*วอลเล็ต|e[\s-]*wallet|ทรู\s*มัน\s*นี่|true\s*money(?:\s*wallet)?)/iu.test(line));
  if(walletIndex<0)return null;
  const wallet=lines[walletIndex];
  // K PLUS may put "พร้อมเพย์ อี-วอลเล็ต /" and "G-Wallet" on separate lines.
  const next=lines[walletIndex+1]||'';
  const walletName=wallet.endsWith('/')&&/^g[\s-]*wallet$/iu.test(next)?wallet+' '+next:wallet;
  // Money Tracker counts bank-to-wallet funding as an outgoing expense.
  const trueMoney=/(?:ทรู\s*มัน\s*นี่|true\s*money)/iu.test(walletName);
  return {
    recipient: walletName.slice(0,160),
    kind:trueMoney?'truemoney':'wallet_transfer',
    directionReason:trueMoney
      ?'เติมเงินเข้า e-Wallet TrueMoney จากบัญชีธนาคาร (รายจ่าย)'
      :'เติมเงินเข้า e-Wallet จากบัญชีธนาคาร (รายจ่าย)',
  };
}

import {toSatang,type Method} from './finance.js';

export type ReceiptSource='seven_eleven'|'paotang';
export type ReceiptExtraction={
  source:ReceiptSource;
  direction:'expense';
  directionReason:string;
  amountSatang:number|null;
  recipient:string|null;
  method:Method;
  category:string;
};

/** Read the last monetary value, not item count, order ID, or discount. */
function trailingMoney(line:string):number|null {
  const match=line.match(/(?:^|[^\d./:-])(\d{1,3}(?:,\d{3})+|\d{1,7})(?:\.(\d{2}))?\s*(?:บาท)?\s*$/iu);
  if(!match)return null;
  const value=toSatang(match[1]+'.'+(match[2]||'00'));
  return value!==null&&value<=999_999_999?value:null;
}
function labelledValue(lines:string[],index:number):number|null {
  const inline=trailingMoney(lines[index]);
  if(inline!==null)return inline;
  if(index+1<lines.length&&/^\s*(?:฿\s*)?[\d,.]+\s*(?:บาท)?$/u.test(lines[index+1]))
    return trailingMoney(lines[index+1].replace(/^฿\s*/u,''));
  return null;
}
function uniqueAmounts(lines:string[],pattern:RegExp):number[]{
  const hits=new Set<number>();
  for(let i=0;i<lines.length;i++){
    if(!pattern.test(lines[i]))continue;
    const value=labelledValue(lines,i);
    if(value!==null)hits.add(value);
  }
  return [...hits];
}
const SEVEN=/7[\s-]*(?:eleven|delivery|app)|เซเว่น(?:อีเลฟเว่น)?|ทรูวอลเล็ต7app/iu;
const SEVEN_RECEIPT=/(?:รายการสินค้า|รายการสั่งซื้อ|สาขา|รหัสร้าน|ยอดสุทธิ|ทรูวอลเล็ต7app|7delivery)/iu;
const PAOTANG=/(?:เป๋าตัง|g[\s-]*wallet|ไทยช่วยไทย(?:พลัส)?|ถุงเงิน)/iu;
const SUCCESS=/(?:ทำรายการสำเร็จ|ชำระเงินสำเร็จ|จ่ายเงินสำเร็จ|transaction successful|payment successful)/iu;

function parse7Eleven(lines:string[]):ReceiptExtraction {
  // Receipt total is not necessarily what actually left the user's wallet.
  // Require a tender line; never silently book an unconfirmed order.
  const tender=/ทรู\s*วอลเล็ต|ทรูมันนี่|7\s*app|true\s*(?:money|wallet)|เงินสด|บัตร\s*(?:เครดิต|เดบิต)|ยอด(?:เงิน)?ที่ชำระ|ชำระเงินด้วย|promptpay/iu;
  const total=/ยอด\s*สุทธิ|ยอด\s*รวม(?:ทั้งสิ้น)?|รวม(?:สุทธิ|เงินทั้งสิ้น)|net\s*total/iu;
  const paid=uniqueAmounts(lines,tender);
  const totals=uniqueAmounts(lines,total);
  let amountSatang:number|null=paid.length===1?paid[0]:null;
  if(amountSatang!==null&&totals.length===1&&totals[0]!==amountSatang)amountSatang=null;
  if(totals.length>1)amountSatang=null;
  // Merchant must come from the store/branch section, never the ordered item.
  const branchLine=lines.find(x=>/^สาขา\s*(?:7[\s-]*eleven|เซเว่น(?:อีเลฟเว่น)?)/iu.test(x));
  const branch=branchLine?.replace(/^สาขา\s*(?:7[\s-]*eleven|เซเว่น(?:อีเลฟเว่น)?)\s*/iu,'').trim();
  const recipient=branch?('7-Eleven — '+branch).slice(0,160):'7-Eleven';
  const paymentText=lines.filter(x=>tender.test(x)).join(' ');
  const method:Method=/เงินสด/iu.test(paymentText)?'cash':/(?:บัตร\s*(?:เครดิต|เดบิต))/iu.test(paymentText)?'card':
    /(?:ทรู\s*วอลเล็ต|ทรูมันนี่|7\s*app|true\s*(?:money|wallet))/iu.test(paymentText)?'wallet':'bank';
  return {
    source:'seven_eleven',direction:'expense',
    directionReason:'ใบเสร็จ 7-Eleven ที่พบช่องทางชำระเงินจริง',
    amountSatang,recipient,method,
    category:'อาหารและเครื่องดื่ม',
  };
}
function parsePaotang(lines:string[]):ReceiptExtraction {
  // The government subsidy is NOT a charge to the user's account.
  // Only "จำนวนเงินที่ชำระ" (16), never gross goods (40) or benefit (24).
  const paid=uniqueAmounts(lines,/(?:จำนวน\s*เงิน\s*ที่\s*ชำระ|ยอด\s*ชำระ\s*จริง|ยอด(?:เงิน)?ที่ชำระ|จ่าย\s*จริง|amount\s*paid|net\s*paid)/iu);
  const amountSatang=paid.length===1?paid[0]:null;
  const marker=lines.findIndex(x=>/(?:g[\s-]*wallet\s*id|เลข(?:บัญชี|ที่)\s*(?:g[\s-]*wallet)|กระเป๋า\s*เงิน)/iu.test(x));
  let recipient:string|null=null;
  if(marker>=0){
    for(const raw of lines.slice(marker+1,marker+7)){
      const line=raw.replace(/^[↓→➜⟶\-]+\s*/u,'').trim();
      if(!line||/^(?:ถุงเงิน|เป๋าตัง|g[\s-]*wallet|ร้านค้า|อาหาร\s*ของหวาน\s*เครื่องดื่ม)$/iu.test(line))continue;
      if(!/[\p{L}]/u.test(line)||/[\d]/u.test(line)||/^(?:อาหาร|ของหวาน|เครื่องดื่ม|ค่าสินค้า|สิทธิ|จำนวน|ยอด|รหัส|อ้างอิง|ธนาคาร)/iu.test(line))continue;
      recipient=line.slice(0,160);break;
    }
  }
  const food=lines.some(x=>/(?:อาหาร\s*ของหวาน\s*เครื่องดื่ม|ร้านอาหาร|เครื่องดื่ม|ของหวาน)/iu.test(x));
  return {
    source:'paotang',direction:'expense',
    directionReason:'เป๋าตัง / G-Wallet แสดงจำนวนเงินที่ชำระหลังหักสิทธิ',
    amountSatang,recipient,method:'wallet',
    category:food?'อาหารและเครื่องดื่ม':'อื่น ๆ',
  };
}

/** For recognized formats, never fall back to generic OCR amount heuristics. */
export function parseSpecialReceipt(lines:string[]):ReceiptExtraction|null {
  const all=lines.join(' ');
  const isPaotang=PAOTANG.test(all)&&SUCCESS.test(all)&&/(?:g[\s-]*wallet|จำนวน\s*เงิน\s*ที่\s*ชำระ)/iu.test(all);
  if(isPaotang)return parsePaotang(lines);
  if(SEVEN.test(all)&&SEVEN_RECEIPT.test(all))return parse7Eleven(lines);
  return null;
}

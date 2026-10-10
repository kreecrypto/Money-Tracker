import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, toSatang,
  type EntryType, type Method
} from '../../src/lib/finance';

export type LineEntry = {
  type: EntryType;
  amountSatang: number;
  category: string;
  note: string;
  method: Method;
};
export type LineParseResult =
  | { ok: true; value: LineEntry }
  | { ok: false; reason: 'no_amount' | 'multiple_amounts' | 'ambiguous_direction' | 'invalid_amount' };

const thaiNumbers = '๐๑๒๓๔๕๖๗๘๙';
const normalize = (s: string) => s.replace(/[๐-๙]/g, c => String(thaiNumbers.indexOf(c))).replace(/\s+/g,' ').trim();

const incomeWord = /(?:^|\s)(?:รับ|รายรับ|เงินเข้า|ได้เงิน)(?:\s|$)|เงินเดือน|โบนัส|เงินคืน|ดอกเบี้ย|ค่าจ้าง|รายได้|ลูกค้าโอนให้/;
const expenseWord = /(?:^|\s)(?:จ่าย|รายจ่าย|เงินออก|ซื้อ)(?:\s|$)|ค่า(?:อาหาร|กาแฟ|รถ|ไฟ|น้ำ|เน็ต|เช่า|โทร|เทอม|ยา|ทางด่วน)/;

function categorize(type: EntryType, text: string): string {
  if(type==='income'){
    if(/เงินเดือน/.test(text)) return INCOME_CATEGORIES[0];
    if(/โบนัส/.test(text)) return INCOME_CATEGORIES[2];
    if(/ดอกเบี้ย|ปันผล|ลงทุน/.test(text)) return INCOME_CATEGORIES[3];
    if(/เงินคืน|คืนเงิน|refund/i.test(text)) return INCOME_CATEGORIES[4];
    if(/งานเสริม|ค่าจ้าง|ฟรีแลนซ์|ขายของ|ลูกค้า/.test(text)) return INCOME_CATEGORIES[1];
    return INCOME_CATEGORIES[5];
  }
  if(/กาแฟ|ชา|ข้าว|อาหาร|ก๋วยเตี๋ยว|ขนม|น้ำดื่ม|ร้านอาหาร|มื้อ|เบเกอรี่/.test(text)) return EXPENSE_CATEGORIES[0];
  if(/แท็กซี่|taxi|grab|รถไฟ|รถเมล์|รถตู้|ค่าน้ำมัน|เติมน้ำมัน|ค่ารถ|เดินทาง|bts|mrt|ทางด่วน/i.test(text)) return EXPENSE_CATEGORIES[1];
  if(/ช้อป|shopping|เสื้อ|รองเท้า|ซื้อของ|ห้าง|ซูเปอร์/i.test(text)) return EXPENSE_CATEGORIES[2];
  if(/ค่าไฟ|ค่าน้ำ|ค่าเน็ต|อินเทอร์เน็ต|ค่าเช่า|ค่าบ้าน|โทรศัพท์/.test(text)) return EXPENSE_CATEGORIES[3];
  if(/โรงพยาบาล|หมอ|ยา|รักษา|คลินิก/.test(text)) return EXPENSE_CATEGORIES[4];
  if(/ดูหนัง|เกม|คอนเสิร์ต|บันเทิง/.test(text)) return EXPENSE_CATEGORIES[5];
  if(/ค่าเทอม|โรงเรียน|หนังสือ|เรียน/.test(text)) return EXPENSE_CATEGORIES[6];
  if(/ผ่อน|บัตรเครดิต|หนี้|สินเชื่อ/.test(text)) return EXPENSE_CATEGORIES[7];
  return EXPENSE_CATEGORIES[8];
}

/** Only single, unambiguous amounts are auto-booked; never invent values or types. */
export function parseLineExpense(input: string): LineParseResult {
  const text=normalize(input);
  if(!text || text.length>500) return {ok:false,reason:'no_amount'};
  const found=[...text.matchAll(/(?<![A-Za-z0-9])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?(?![A-Za-z0-9])/g)];
  if(!found.length) return {ok:false,reason:'no_amount'};
  if(found.length!==1) return {ok:false,reason:'multiple_amounts'};
  const raw=found[0][0];
  const amountSatang=toSatang(raw);
  if(!amountSatang) return {ok:false,reason:'invalid_amount'};
  const remaining=text.slice(0,found[0].index)+text.slice((found[0].index||0)+raw.length);
  const hasIncome=incomeWord.test(remaining);
  const hasExpense=expenseWord.test(remaining);
  if(hasIncome&&hasExpense) return {ok:false,reason:'ambiguous_direction'};
  const type:EntryType=hasIncome?'income':'expense';
  const method:Method=/บัตรเครดิต|credit card/i.test(remaining)?'card'
    :/wallet|วอลเล็ต|ทรูมันนี่|true money/i.test(remaining)?'wallet'
    :/โอน|ธนาคาร|พร้อมเพย์|promptpay|mobile banking/i.test(remaining)?'bank':'cash';
  const note=remaining.replace(/\b(?:บาท|thb)\b/gi,'').replace(/บาท/g,'').replace(/(?:^|\s)(?:รายรับ|รายจ่าย|เงินเข้า|เงินออก|ได้รับ|รับ|จ่าย|ซื้อ)(?=\s|$)/g,' ').trim().slice(0,500);
  return {ok:true,value:{
    type, amountSatang, category:categorize(type,remaining),
    note:note|| (type==='income'?'รายรับจาก LINE':'รายจ่ายจาก LINE'), method
  }};
}

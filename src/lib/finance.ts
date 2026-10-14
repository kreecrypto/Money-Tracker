export type EntryType = 'income' | 'expense';
export type Method = 'cash' | 'bank' | 'card' | 'wallet';
export type ReceiptItem = {
  name: string;
  quantity: number;
  lineTotalSatang: number;
  unitPriceSatang?: number;
};
export type ReceiptDetails = {
  source: 'seven_eleven' | 'paotang' | 'kplus' | 'generic';
  receiptId?: string;
  storeName?: string;
  items: ReceiptItem[];
  /** Receipt goods/services amount, before discounts/subsidies. */
  subtotalSatang?: number;
  discountSatang?: number;
  subsidySatang?: number;
  feeSatang?: number;
  /** Authoritative actual money leaving the user's account. */
  paidSatang: number;
  /** Whether the full item list was reconciled against the receipt totals. */
  itemsComplete: boolean;
};
export type Transaction = {
  id: string;
  type: EntryType;
  amountSatang: number;
  category: string;
  note: string;
  date: string;
  /** Local transaction clock time, HH:mm. Optional for older/manual transactions. */
  time?: string;
  /** Payee printed on the slip; never inferred from the sender. */
  recipient?: string;
  /** Sender printed on a classified transfer slip, if recognized. */
  sender?: string;
  method: Method;
  receipt?: ReceiptDetails;
  /** SHA-256 of original uploaded bytes; no photo is retained. */
  slipHash?: string;
  createdAt: number;
};
export type Settings = { monthlyBudgetSatang: number; accountHolderNames?: string[] };
export const DEFAULT_SETTINGS: Settings = { monthlyBudgetSatang: 0, accountHolderNames: [] };
export const EXPENSE_CATEGORIES = ['อาหารและเครื่องดื่ม','เดินทาง','ช้อปปิ้ง','บ้านและค่าน้ำไฟ','สุขภาพ','บันเทิง','การศึกษา','ผ่อนชำระ/หนี้','อื่น ๆ'] as const;
export const INCOME_CATEGORIES = ['เงินเดือน','งานเสริม','โบนัส','ดอกเบี้ย/ลงทุน','เงินคืน','อื่น ๆ'] as const;
export const METHODS: Record<Method,string> = {cash:'เงินสด',bank:'โอน/ธนาคาร',card:'บัตรเครดิต',wallet:'e-Wallet'};
export const CATEGORY_ICONS: Record<string,string> = {
  'อาหารและเครื่องดื่ม':'🍜','เดินทาง':'🚗','ช้อปปิ้ง':'🛍️','บ้านและค่าน้ำไฟ':'🏡',
  'สุขภาพ':'💊','บันเทิง':'🎬','การศึกษา':'📚','ผ่อนชำระ/หนี้':'💳','อื่น ๆ':'✨',
  'เงินเดือน':'💼','งานเสริม':'🧑‍💻','โบนัส':'🎁','ดอกเบี้ย/ลงทุน':'📈','เงินคืน':'↩️'
};
export const formatter = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const baht = (satang:number) => formatter.format(satang/100);
export const todayLocal = (date = new Date()) => [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
export const monthLocal = (date = new Date()) => todayLocal(date).slice(0,7);
export const toSatang = (input: string): number | null => {
  const cleaned = input.replace(/,/g,'').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, cents=''] = cleaned.split('.');
  const num = Number(whole) * 100 + Number(cents.padEnd(2,'0'));
  return Number.isSafeInteger(num) && num > 0 ? num : null;
};
export function summarize(items: Transaction[]) {
  const income = items.filter(x=>x.type==='income').reduce((a,x)=>a+x.amountSatang,0);
  const expense = items.filter(x=>x.type==='expense').reduce((a,x)=>a+x.amountSatang,0);
  return {income,expense,net:income-expense};
}
export function monthly(items:Transaction[],month:string){return items.filter(x=>x.date.startsWith(month));}
export function expenseByCategory(items:Transaction[]) {
  const cat = new Map<string,number>();
  items.filter(x=>x.type==='expense').forEach(x=>cat.set(x.category,(cat.get(x.category)||0)+x.amountSatang));
  return [...cat.entries()].map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total);
}
export function lastMonths(n:number, now=new Date()) {
  return Array.from({length:n},(_,i)=>{
    const d=new Date(now.getFullYear(),now.getMonth()-(n-1-i),1);
    return {key:monthLocal(d),label:new Intl.DateTimeFormat('th-TH',{month:'short'}).format(d)};
  });
}
export function isValidReceiptDetails(value:unknown,paidSatang:number):value is ReceiptDetails {
  if(!value||typeof value!=='object')return false;
  const r=value as Partial<ReceiptDetails>;
  const money=(n:unknown)=>Number.isSafeInteger(n)&&typeof n==='number'&&n>=0&&n<=999_999_999;
  if(!['seven_eleven','paotang','kplus','generic'].includes(r.source||'')||
    !money(r.paidSatang)||r.paidSatang!==paidSatang||
    !Array.isArray(r.items)||r.items.length>100||typeof r.itemsComplete!=='boolean')return false;
  if(r.receiptId!==undefined&&(typeof r.receiptId!=='string'||r.receiptId.length>150))return false;
  if(r.storeName!==undefined&&(typeof r.storeName!=='string'||r.storeName.length>160))return false;
  if([r.subtotalSatang,r.discountSatang,r.subsidySatang,r.feeSatang].some(x=>x!==undefined&&!money(x)))return false;
  return r.items.every(row=>row&&typeof row==='object'&&typeof row.name==='string'&&
    row.name.trim().length>0&&row.name.length<=160&&Number.isInteger(row.quantity)&&
    row.quantity>0&&row.quantity<=999&&money(row.lineTotalSatang)&&
    (row.unitPriceSatang===undefined||money(row.unitPriceSatang)));
}
export function isValidTransaction(x:unknown):x is Transaction {
  if (!x || typeof x!=='object') return false;
  const t = x as Partial<Transaction>;
  return typeof t.id==='string' && t.id.length>0 && t.id.length<150 &&
    (t.type==='income'||t.type==='expense') && Number.isSafeInteger(t.amountSatang) && (t.amountSatang??0)>0 &&
    typeof t.category==='string' && (t.type==='income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).some(c=>c===t.category) &&
    typeof t.note==='string' && t.note.length<=500 && typeof t.date==='string' &&
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(t.date) &&
    !Number.isNaN(new Date(`${t.date}T12:00:00`).getTime()) && todayLocal(new Date(`${t.date}T12:00:00`))===t.date &&
    (t.time===undefined || (typeof t.time==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time))) &&
    (t.recipient===undefined || (typeof t.recipient==='string' && t.recipient.length<=160)) &&
    (t.sender===undefined || (typeof t.sender==='string' && t.sender.length<=160)) &&
    (t.receipt===undefined||isValidReceiptDetails(t.receipt,t.amountSatang!)) &&
    (t.slipHash===undefined||(typeof t.slipHash==='string'&&/^[a-f0-9]{64}$/.test(t.slipHash))) &&
    (t.method==='cash'||t.method==='bank'||t.method==='card'||t.method==='wallet') &&
    typeof t.createdAt==='number' && Number.isFinite(t.createdAt);
}

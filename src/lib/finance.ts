export type EntryType = 'income' | 'expense';
export type Method = 'cash' | 'bank' | 'card' | 'wallet';
export type Transaction = {
  id: string;
  type: EntryType;
  amountSatang: number;
  category: string;
  note: string;
  date: string;
  method: Method;
  createdAt: number;
};
export type Settings = { monthlyBudgetSatang: number };
export const DEFAULT_SETTINGS: Settings = { monthlyBudgetSatang: 0 };
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
export function isValidTransaction(x:unknown):x is Transaction {
  if (!x || typeof x!=='object') return false;
  const t = x as Partial<Transaction>;
  return typeof t.id==='string' && t.id.length>0 && t.id.length<150 &&
    (t.type==='income'||t.type==='expense') && Number.isSafeInteger(t.amountSatang) && (t.amountSatang??0)>0 &&
    typeof t.category==='string' && (t.type==='income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).some(c=>c===t.category) &&
    typeof t.note==='string' && t.note.length<=500 && typeof t.date==='string' &&
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(t.date) &&
    !Number.isNaN(new Date(`${t.date}T12:00:00`).getTime()) && todayLocal(new Date(`${t.date}T12:00:00`))===t.date &&
    (t.method==='cash'||t.method==='bank'||t.method==='card'||t.method==='wallet') &&
    typeof t.createdAt==='number' && Number.isFinite(t.createdAt);
}

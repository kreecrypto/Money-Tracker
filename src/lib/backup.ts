import {METHODS,type Settings,type Transaction,isValidTransaction,baht} from './finance';
export function createBackup(items:Transaction[],settings:Settings){return JSON.stringify({app:'ngoentoday',version:1,exportedAt:new Date().toISOString(),transactions:items,settings},null,2);}
export function parseBackup(text:string){
  const data:unknown=JSON.parse(text);
  if (!data || typeof data!=='object') throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
  const value = data as Record<string,unknown>;
  if (value.app!=='ngoentoday'||value.version!==1||!Array.isArray(value.transactions)||!value.transactions.every(isValidTransaction)) throw new Error('ไฟล์สำรองไม่ถูกต้องหรือเวอร์ชันไม่รองรับ');
  if (value.transactions.length>200000) throw new Error('ไฟล์สำรองมีรายการมากเกินกำหนด');
  const ids=new Set(value.transactions.map(x=>(x as Transaction).id));
  if(ids.size!==value.transactions.length) throw new Error('มีหมายเลขรายการซ้ำ');
  const s=value.settings as Partial<Settings>|null;
  const budget=s?.monthlyBudgetSatang;
  if(!Number.isSafeInteger(budget)||!Number.isInteger(budget)|| (budget??-1)<0) throw new Error('งบประมาณในไฟล์ไม่ถูกต้อง');
  return {transactions:value.transactions as Transaction[],settings:{monthlyBudgetSatang:budget!}};
}
function safeCsvCell(s:string){const safe=/^[\s]*[=+\-@\t\r]/.test(s)?`'${s}`:s; return `"${safe.replaceAll('"','""')}"`;}
export function toCsv(items:Transaction[]){
  const headers=['วันที่','ประเภท','จำนวน (บาท)','หมวดหมู่','หมายเหตุ','ช่องทาง','รหัสรายการ'];
  const rows=items.map(x=>[x.date,x.type==='income'?'รายรับ':'รายจ่าย',baht(x.amountSatang),x.category,x.note,METHODS[x.method],x.id]);
  return '\uFEFF'+[headers,...rows].map(r=>r.map(v=>safeCsvCell(String(v))).join(',')).join('\r\n');
}
export function downloadText(filename:string,text:string,type:string){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1500);}

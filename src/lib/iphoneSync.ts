import {isValidTransaction,type Transaction} from './finance';
import {loadTransactions,saveTransaction} from './storage';

export type IPhoneDraft={
  id:string;amountSatang:number|null;type:'income'|'expense'|null;
  date:string|null;category:string;note:string;method:'bank'|'cash'|'card'|'wallet';
  source:string;createdAt:string;
};
const TOKEN_KEY='money-tracker-iphone-review-token-v1';
const SEEN_KEY='money-tracker-iphone-seen-v1';

function host(){
  const text=String(import.meta.env.VITE_IPHONE_BRIDGE_URL||'').trim();
  try{const u=new URL(text);return u.protocol==='https:'?u.origin:null;}
  catch{return null;}
}
export function iphoneConfigured(){return host()!==null;}
export function iphoneConnected(){
  try{return /^[a-fA-F0-9]{64}$/.test(localStorage.getItem(TOKEN_KEY)||'');}
  catch{return false;}
}
export function iphoneDisconnect(){try{localStorage.removeItem(TOKEN_KEY);}catch{}}
export function iphoneConnect(token:string){
  if(!host())throw new Error('ยังไม่ได้ตั้งค่า iPhone API');
  if(!/^[a-fA-F0-9]{64}$/.test(token))throw new Error('รหัสเชื่อมต้องเป็น 64 ตัวอักษร');
  localStorage.setItem(TOKEN_KEY,token.toUpperCase());
}
async function call(path:string,method:'GET'|'POST',data?:object){
  const base=host(),token=localStorage.getItem(TOKEN_KEY)||'';
  if(!base||!/^[a-fA-F0-9]{64}$/.test(token))throw new Error('ยังไม่ได้เชื่อม iPhone Shortcut');
  const r=await fetch(base+path,{method,headers:{
    authorization:'Bearer '+token,...(data?{'content-type':'application/json'}:{})
  },body:data?JSON.stringify(data):undefined,cache:'no-store'});
  if(r.status===401){iphoneDisconnect();throw new Error('รหัสเชื่อมหมดอายุหรือไม่ถูกต้อง');}
  if(!r.ok)throw new Error(r.status===409?'รายการนี้ถูกจัดการไปแล้ว':'ไม่สามารถเชื่อมต่อ iPhone Inbox ได้');
  return await r.json() as Record<string,unknown>;
}
export async function iphoneDrafts():Promise<IPhoneDraft[]>{
  const r=await call('/api/iphone/drafts','GET');
  return Array.isArray(r.drafts)?(r.drafts as IPhoneDraft[]):[];
}
export async function iphoneReview(id:string,decision:'confirm'|'discard',input?:{
  type:'income'|'expense';amountSatang:number;date:string;
  category:string;note:string;method:'cash'|'bank'|'card'|'wallet';
}){
  return call('/api/iphone/drafts','POST',{id,decision,...(input||{})});
}
function seen(){
  try{const v=JSON.parse(localStorage.getItem(SEEN_KEY)||'[]') as unknown;
    return new Set<string>(Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.startsWith('iphone-')):[]);
  }catch{return new Set<string>();}
}
export async function iphoneSync():Promise<{imported:number;received:number}>{
  const r=await call('/api/iphone/ledger','GET');
  if(!Array.isArray(r.transactions))throw new Error('ข้อมูลจาก iPhone ไม่ถูกต้อง');
  const rows=r.transactions.filter(isValidTransaction) as Transaction[];
  const local=new Set((await loadTransactions()).map(x=>x.id));
  const seenItems=seen();
  let imported=0;
  for(const row of rows){
    if(!row.id.startsWith('iphone-')||seenItems.has(row.id)||local.has(row.id))continue;
    await saveTransaction(row);
    seenItems.add(row.id);local.add(row.id);imported++;
    localStorage.setItem(SEEN_KEY,JSON.stringify([...seenItems].slice(-3000)));
  }
  return {imported,received:rows.length};
}

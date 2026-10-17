import {isValidTransaction,type Transaction} from './finance';
import {loadTransactions,saveTransaction} from './storage';

export type IPhoneDraft={
  id:string;amountSatang:number|null;type:'income'|'expense'|null;
  date:string|null;category:string;note:string;method:'bank'|'cash'|'card'|'wallet';
  source:string;createdAt:string;time:string|null;recipient:string|null;
};
const TOKEN_KEY='money-tracker-iphone-review-token-v1';
const SEEN_KEY='money-tracker-iphone-seen-v1';

function host(){
  const configured=String(import.meta.env.VITE_IPHONE_BRIDGE_URL||'').trim();
  // Keep explicit bridge URLs for existing deployments, but let the unified
  // Money Tracker project call its own /api endpoints without a second domain.
  if(configured){
    try{const u=new URL(configured);return u.protocol==='https:'?u.origin:null;}
    catch{return null;}
  }
  if(typeof window==='undefined')return null;
  const {protocol,hostname,origin}=window.location;
  return protocol==='https:'||(protocol==='http:'&&hostname==='localhost')?origin:null;
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
  if(r.status===401){iphoneDisconnect();throw new Error('Review Token ไม่ถูกต้อง กรุณาเชื่อมใหม่');}
  if(r.status===403)throw new Error('เว็บ Money Tracker ไม่ได้รับอนุญาตให้เชื่อม API (ตรวจ Allowed App Origin)');
  if(r.status===503){
    const details=await r.json().catch(()=>({})) as {code?:string};
    throw new Error('Backend หรือฐานข้อมูลยังไม่พร้อม'+(details.code?' ('+details.code+')':'')+' กรุณาตรวจ Vercel/Supabase');
  }
  if(r.status===429)throw new Error('ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลัง');
  if(!r.ok)throw new Error(r.status===409?'รายการนี้ถูกจัดการไปแล้ว':'ไม่สามารถเชื่อมต่อ iPhone Inbox ได้');
  return await r.json() as Record<string,unknown>;
}
/** Only recipient can be corrected on confirmed iPhone transactions.
 * All financial fields stay immutable on the server through this action. */
export async function iphoneCorrectRecipient(id:string,recipient:string|null):Promise<void>{
  const uuid=id.startsWith('iphone-')?id.slice('iphone-'.length):'';
  if(!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(uuid))
    throw new Error('รหัสรายการ iPhone ไม่ถูกต้อง');
  await call('/api/iphone/ledger','POST',{id:uuid,recipient});
}

export async function iphoneDrafts():Promise<IPhoneDraft[]>{
  const r=await call('/api/iphone/drafts','GET');
  return Array.isArray(r.drafts)?(r.drafts as IPhoneDraft[]):[];
}
export async function iphoneReview(id:string,decision:'confirm'|'discard',input?:{
  type:'income'|'expense';amountSatang:number;date:string;
  category:string;note:string;method:'cash'|'bank'|'card'|'wallet';time?:string|null;recipient?:string|null;
}){
  return call('/api/iphone/drafts','POST',{id,decision,...(input||{})});
}
/** Retain Review Token; clear only the import cursor for a safe repair retry. */
export function resetIphoneImportHistory():void{
  localStorage.removeItem(SEEN_KEY);
}
function seen(){
  try{const v=JSON.parse(localStorage.getItem(SEEN_KEY)||'[]') as unknown;
    return new Set<string>(Array.isArray(v)?v.filter((x):x is string=>typeof x==='string'&&x.startsWith('iphone-')):[]);
  }catch{return new Set<string>();}
}
export async function iphoneSync():Promise<{imported:number;repaired:number;received:number;invalid:number}>{
  const r=await call('/api/iphone/ledger','GET');
  if(!Array.isArray(r.transactions))throw new Error('ข้อมูลจาก iPhone ไม่ถูกต้อง');
  const rows=r.transactions.filter(isValidTransaction) as Transaction[];
  // Never silently treat rejected cloud rows as a successful import.
  // Keep valid records flowing while surfacing malformed rows to the UI.
  const invalid=r.transactions.length-rows.length;
  const existing=await loadTransactions();
  const local=new Map(existing.map(x=>[x.id,x]));
  const seenItems=seen();
  let imported=0;
  let repaired=0;
  for(const row of rows){
    // Preserve deliberate local deletions; only an explicit repair resets this history.
    if(!row.id.startsWith('iphone-'))continue;
    const previous=local.get(row.id);
    // Reconcile only the known corrupted OCR watermark. Preserve any recipient
    // that the user already corrected locally, and retain all financial fields.
    if(previous){
      if(/^THAILAND(?:\\s+2026)?$/i.test(previous.recipient?.trim()||'')&&
        previous.recipient!==row.recipient){
        const repairedRow={...previous};
        if(row.recipient)repairedRow.recipient=row.recipient;
        else delete repairedRow.recipient;
        await saveTransaction(repairedRow);
        local.set(row.id,repairedRow);
        repaired++;
      }
      continue;
    }
    if(seenItems.has(row.id))continue; // preserve intentionally deleted entries
    await saveTransaction(row);
    seenItems.add(row.id);local.set(row.id,row);imported++;
    localStorage.setItem(SEEN_KEY,JSON.stringify([...seenItems].slice(-3000)));
  }
  return {imported,repaired,received:r.transactions.length,invalid};
}

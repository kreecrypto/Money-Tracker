import {DEFAULT_SETTINGS,type Settings,type Transaction,isValidTransaction} from './finance';
import {isValidPendingSlip,pendingFingerprintMatch,type PendingSlip} from './pendingSlips';
import {sanitizeOwnerNames} from './slipIdentity';
import {isLikelyEmailDuplicate} from './emailLedger';
import {suggestCategory} from './categorySuggestions';
const DB_NAME='ngoentoday-db';
const VERSION=2;
const STORE='transactions';
const SETTINGS='settings';
const PENDING='pending_slips';
let opening:Promise<IDBDatabase>|null=null;
function getDB():Promise<IDBDatabase>{
  if (!('indexedDB' in window)) return Promise.reject(new Error('เบราว์เซอร์นี้ไม่รองรับการบันทึกข้อมูล'));
  if (!opening) opening=new Promise<IDBDatabase>((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS,{keyPath:'key'});
      if(!db.objectStoreNames.contains(PENDING)) db.createObjectStore(PENDING,{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('เปิดฐานข้อมูลไม่สำเร็จ'));
    req.onblocked=()=>reject(new Error('กรุณาปิดแท็บแอปอื่นและลองใหม่'));
  }).catch(e=>{ opening=null; throw e; });
  return opening!;
}
function request<T>(req:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function loadTransactions(){ const db=await getDB(); const data=await request<Transaction[]>(db.transaction(STORE,'readonly').objectStore(STORE).getAll()); return data.filter(isValidTransaction).sort((a,b)=>b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||'')||b.createdAt-a.createdAt); }
export async function saveTransaction(item:Transaction){const db=await getDB(); const tx=db.transaction(STORE,'readwrite'); await request(tx.objectStore(STORE).put(item)); await completed(tx);}

/** Confirmed category-only edits in a single IndexedDB transaction. */
export async function applySuggestedCategories(ids:readonly string[]):Promise<number>{
  if(ids.length>2000||ids.some(id=>typeof id!=='string'||id.length>149))
    throw new Error('จำนวนรายการจัดหมวดไม่ถูกต้อง');
  const selected=new Set(ids);
  if(!selected.size)return 0;
  const db=await getDB();
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
  const records=await request<Transaction[]>(store.getAll());
  let updated=0;
  for(const item of records){
    if(!selected.has(item.id)||!isValidTransaction(item))continue;
    const suggestion=suggestCategory(item);
    if(!suggestion)continue;
    store.put({...item,category:suggestion.category});
    updated++;
  }
  await completed(tx);
  return updated;
}

/** Append private email records atomically; never erase or overwrite existing transactions. */
export async function appendEmailTransactions(candidates:Transaction[]):Promise<{imported:number;duplicates:number}>{
  if(candidates.length>2000||candidates.some(item=>!isValidTransaction(item)||!item.id.startsWith('email-')))
    throw new Error('รายการนำเข้าไม่ถูกต้อง');
  const db=await getDB();
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
  const existing=(await request<Transaction[]>(store.getAll())).filter(isValidTransaction);
  let imported=0,duplicates=0;
  for(const item of candidates){
    if(existing.some(other=>isLikelyEmailDuplicate(item,other))){duplicates++;continue;}
    store.add(item);
    existing.push(item);
    imported++;
  }
  await completed(tx);
  return {imported,duplicates};
}
/** Clear only this browser's Money Tracker data. Never touches Supabase. */
export async function clearLocalData():Promise<void>{
  const db=await getDB();
  const tx=db.transaction([STORE,SETTINGS,PENDING],'readwrite');
  tx.objectStore(STORE).clear();
  tx.objectStore(SETTINGS).clear();
  tx.objectStore(PENDING).clear();
  await completed(tx);
}
export async function deleteTransaction(id:string){const db=await getDB();const tx=db.transaction(STORE,'readwrite');await request(tx.objectStore(STORE).delete(id));await completed(tx);}
export async function loadSettings():Promise<Settings>{
  const db=await getDB();const tx=db.transaction(SETTINGS,'readonly');const store=tx.objectStore(SETTINGS);
  const [row,names]=await Promise.all([
    request<{key:string;value:number}|undefined>(store.get('monthlyBudgetSatang')),
    request<{key:string;value:unknown}|undefined>(store.get('ownerNames')),
  ]);
  return {
    monthlyBudgetSatang:Number.isSafeInteger(row?.value)&&row!.value>=0?row!.value:DEFAULT_SETTINGS.monthlyBudgetSatang,
    ownerNames:sanitizeOwnerNames(names?.value),
  };
}
export async function saveSettings(settings:Settings){const db=await getDB(); const tx=db.transaction(SETTINGS,'readwrite'); tx.objectStore(SETTINGS).put({key:'monthlyBudgetSatang',value:settings.monthlyBudgetSatang});
  tx.objectStore(SETTINGS).put({key:'ownerNames',value:sanitizeOwnerNames(settings.ownerNames)});
  await completed(tx);}
function completed(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('บันทึกไม่สำเร็จ'));});}
export async function replaceAll(transactions:Transaction[],settings:Settings){
  const db=await getDB();const tx=db.transaction([STORE,SETTINGS],'readwrite');
  const store=tx.objectStore(STORE);store.clear(); transactions.forEach(t=>store.put(t));
  tx.objectStore(SETTINGS).put({key:'monthlyBudgetSatang',value:settings.monthlyBudgetSatang});
  tx.objectStore(SETTINGS).put({key:'ownerNames',value:sanitizeOwnerNames(settings.ownerNames)});
  await completed(tx);
}

/** Pending OCR drafts live in the same local IndexedDB, but are NOT transactions. */
export async function loadPendingSlips():Promise<PendingSlip[]>{
  const db=await getDB();
  const rows=await request<unknown[]>(db.transaction(PENDING,'readonly').objectStore(PENDING).getAll());
  return rows.filter(isValidPendingSlip).sort((a,b)=>b.updatedAt-a.updatedAt);
}

/** Use one read/write transaction so simultaneous batches cannot duplicate a pending slip. */
export async function savePendingSlip(item:PendingSlip):Promise<{id:string;duplicate:boolean}>{
  if(!isValidPendingSlip(item))throw new Error('ข้อมูลรายการรอตรวจไม่ถูกต้อง');
  const db=await getDB();
  const tx=db.transaction(PENDING,'readwrite');
  const store=tx.objectStore(PENDING);
  const existing=await request<unknown[]>(store.getAll());
  const duplicate=existing.filter(isValidPendingSlip).find(p=>pendingFingerprintMatch(p,item));
  if(!duplicate||duplicate.id===item.id)store.put(item);
  await completed(tx);
  return {id:duplicate?.id||item.id,duplicate:!!duplicate&&duplicate.id!==item.id};
}
export async function deletePendingSlip(id:string):Promise<void>{
  const db=await getDB();
  const tx=db.transaction(PENDING,'readwrite');
  tx.objectStore(PENDING).delete(id);
  await completed(tx);
}

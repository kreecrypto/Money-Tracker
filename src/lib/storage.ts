import {DEFAULT_SETTINGS,type Settings,type Transaction,isValidTransaction} from './finance';
import {isValidPendingSlip,pendingFingerprintMatch,type PendingSlip} from './pendingSlips';
import {parseAccountHolderNames} from './slipIdentity';
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
export async function deleteTransaction(id:string){const db=await getDB();const tx=db.transaction(STORE,'readwrite');await request(tx.objectStore(STORE).delete(id));await completed(tx);}
export async function loadSettings():Promise<Settings>{
  const db=await getDB();
  const tx=db.transaction(SETTINGS,'readonly');
  const store=tx.objectStore(SETTINGS);
  const [budget,owner]=await Promise.all([
    request<{key:string;value:number}|undefined>(store.get('monthlyBudgetSatang')),
    request<{key:string;value:unknown}|undefined>(store.get('accountHolderNames')),
  ]);
  let names:string[]=[];
  if(Array.isArray(owner?.value)&&owner.value.every((v:unknown)=>typeof v==='string')){
    try{names=parseAccountHolderNames(owner.value.join('\n'));}catch{names=[];}
  }
  return {monthlyBudgetSatang:Number.isSafeInteger(budget?.value)&&budget!.value>=0
    ?budget!.value:DEFAULT_SETTINGS.monthlyBudgetSatang,accountHolderNames:names};
}
export async function saveSettings(settings:Settings){
  const names=parseAccountHolderNames((settings.accountHolderNames||[]).join('\n'));
  const db=await getDB(),tx=db.transaction(SETTINGS,'readwrite'),store=tx.objectStore(SETTINGS);
  store.put({key:'monthlyBudgetSatang',value:settings.monthlyBudgetSatang});
  store.put({key:'accountHolderNames',value:names});
  await completed(tx);
}
function completed(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('บันทึกไม่สำเร็จ'));});}
export async function replaceAll(transactions:Transaction[],settings:Settings){
  const db=await getDB();const tx=db.transaction([STORE,SETTINGS],'readwrite');
  const store=tx.objectStore(STORE);store.clear(); transactions.forEach(t=>store.put(t));
  tx.objectStore(SETTINGS).put({key:'monthlyBudgetSatang',value:settings.monthlyBudgetSatang});
  tx.objectStore(SETTINGS).put({key:'accountHolderNames',value:parseAccountHolderNames((settings.accountHolderNames||[]).join('\n'))});
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

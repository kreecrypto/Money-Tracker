import {DEFAULT_SETTINGS,type Settings,type Transaction,isValidTransaction} from './finance';
const DB_NAME='ngoentoday-db';
const VERSION=1;
const STORE='transactions';
const SETTINGS='settings';
let opening:Promise<IDBDatabase>|null=null;
function getDB():Promise<IDBDatabase>{
  if (!('indexedDB' in window)) return Promise.reject(new Error('เบราว์เซอร์นี้ไม่รองรับการบันทึกข้อมูล'));
  if (!opening) opening=new Promise<IDBDatabase>((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'});
      if(!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS,{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('เปิดฐานข้อมูลไม่สำเร็จ'));
    req.onblocked=()=>reject(new Error('กรุณาปิดแท็บแอปอื่นและลองใหม่'));
  }).catch(e=>{ opening=null; throw e; });
  return opening!;
}
function request<T>(req:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function loadTransactions(){ const db=await getDB(); const data=await request<Transaction[]>(db.transaction(STORE,'readonly').objectStore(STORE).getAll()); return data.filter(isValidTransaction).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt); }
export async function saveTransaction(item:Transaction){const db=await getDB(); const tx=db.transaction(STORE,'readwrite'); await request(tx.objectStore(STORE).put(item)); await completed(tx);}
export async function deleteTransaction(id:string){const db=await getDB();const tx=db.transaction(STORE,'readwrite');await request(tx.objectStore(STORE).delete(id));await completed(tx);}
export async function loadSettings():Promise<Settings>{const db=await getDB(); const row=await request<{key:string;value:number}|undefined>(db.transaction(SETTINGS,'readonly').objectStore(SETTINGS).get('monthlyBudgetSatang'));return {monthlyBudgetSatang:Number.isSafeInteger(row?.value)&&row!.value>=0 ? row!.value:DEFAULT_SETTINGS.monthlyBudgetSatang};}
export async function saveSettings(settings:Settings){const db=await getDB(); const tx=db.transaction(SETTINGS,'readwrite'); await request(tx.objectStore(SETTINGS).put({key:'monthlyBudgetSatang',value:settings.monthlyBudgetSatang}));await completed(tx);}
function completed(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('บันทึกไม่สำเร็จ'));});}
export async function replaceAll(transactions:Transaction[],settings:Settings){
  const db=await getDB();const tx=db.transaction([STORE,SETTINGS],'readwrite');
  const store=tx.objectStore(STORE);store.clear(); transactions.forEach(t=>store.put(t));
  tx.objectStore(SETTINGS).put({key:'monthlyBudgetSatang',value:settings.monthlyBudgetSatang});
  await completed(tx);
}

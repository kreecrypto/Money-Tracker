import {isValidTransaction,type Transaction} from './finance';
import {loadTransactions,saveTransaction} from './storage';
import {potentialCrossChannelDuplicates} from './duplicateReview';

const SESSION='ngoentoday-line-session-v1';
const SEEN='ngoentoday-line-seen-v1';

function base():string|null{
  const url=String(import.meta.env.VITE_LINE_BRIDGE_URL||'').replace(/\/$/,'');
  try{
    const uri=new URL(url);
    if(uri.protocol!=='https:')return null;
    return uri.origin;
  }catch{return null;}
}
export function lineBridgeConfigured(){return base()!==null;}
export function lineLinked(){try{return /^[0-9A-F]{64}$/.test(localStorage.getItem(SESSION)||'');}catch{return false;}}
export function unlinkLine(){
  try{localStorage.removeItem(SESSION);}catch{}
}
export async function pairLine(code:string):Promise<void>{
  const host=base();
  if(!host)throw new Error('ยังไม่ได้ตั้งค่า URL สำหรับเชื่อม LINE');
  if(!/^[0-9A-F]{20}$/.test(code.trim().toUpperCase()))throw new Error('รหัสเชื่อมไม่ถูกต้อง');
  const res=await fetch(host+'/api/line/pair',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({code:code.trim().toUpperCase()})
  });
  if(!res.ok)throw new Error(res.status===400?'รหัสหมดอายุหรือถูกใช้ไปแล้ว':'ไม่สามารถเชื่อม LINE ได้');
  const data=await res.json() as {token?:string};
  if(!data.token||!/^[0-9A-F]{64}$/.test(data.token))throw new Error('รหัสยืนยันไม่ถูกต้อง');
  localStorage.setItem(SESSION,data.token);
}
function seenIDs():Set<string>{
  try{
    const parsed=JSON.parse(localStorage.getItem(SEEN)||'[]') as unknown;
    return new Set(Array.isArray(parsed)?parsed.filter(x=>typeof x==='string'&&x.startsWith('line-')):[]);
  }catch{return new Set();}
}
export async function syncLineInbox():Promise<{imported:number;received:number;possibleDuplicates:number}>{
  const host=base(),token=localStorage.getItem(SESSION)||'';
  if(!host||!/^[0-9A-F]{64}$/.test(token))return {imported:0,received:0,possibleDuplicates:0};
  const res=await fetch(host+'/api/line/inbox',{
    headers:{authorization:'Bearer '+token},
    cache:'no-store'
  });
  if(res.status===401){unlinkLine();throw new Error('หมดอายุการเชื่อม LINE กรุณาเชื่อมใหม่');}
  if(!res.ok)throw new Error('ซิงก์รายการจาก LINE ไม่สำเร็จ');
  const data=await res.json() as {transactions?:unknown};
  if(!Array.isArray(data.transactions))throw new Error('ข้อมูลรายการจาก LINE ไม่ถูกต้อง');
  const incoming=data.transactions.filter(isValidTransaction) as Transaction[];
  const current=await loadTransactions();
  const have=new Set(current.map(x=>x.id));
  const seen=seenIDs();
  let imported=0,possibleDuplicates=0;
  for(const row of incoming){
    if(!row.id.startsWith('line-')||seen.has(row.id)||have.has(row.id))continue;
    // Advisory only: a same-amount transfer may be legitimate. Do not drop it.
    if(potentialCrossChannelDuplicates(row,current,'line').length>0)possibleDuplicates++;
    await saveTransaction(row);
    seen.add(row.id);have.add(row.id);current.push(row);
    imported++;
    // Persist only after each successful local write.
    localStorage.setItem(SEEN,JSON.stringify([...seen].slice(-5000)));
  }
  return {imported,received:incoming.length,possibleDuplicates};
}

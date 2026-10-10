import type {EntryType,Method} from '../../src/lib/finance';
export type LineRow={
  line_event_id:string;line_user_id:string;type:EntryType;amount_satang:number;
  category:string;note:string;method:Method;transaction_date:string;
  source_kind:'text'|'bank_text'|'bank_image';
  status:'pending'|'confirmed'|'cancelled';
  fingerprint:string|null;
};
export type SavedLineRow=LineRow&{id:string;created_at:string;reviewed_at:string|null};

function setup(){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('STORAGE_NOT_CONFIGURED');
  const origin=new URL(url);
  if(origin.protocol!=='https:')throw new Error('INVALID_STORAGE_URL');
  return {origin,key};
}
async function query(path:string,method:'GET'|'POST'|'PATCH',body?:object){
  const {origin,key}=setup();
  const r=await fetch(new URL('/rest/v1/'+path,origin),{
    method,headers:{
      apikey:key,authorization:'Bearer '+key,
      'content-type':'application/json',
      prefer:method==='POST'?'resolution=ignore-duplicates,return=representation':'return=representation'
    },
    body:body?JSON.stringify(body):undefined
  });
  if(!r.ok){
    if(r.status===409)throw new Error('DUPLICATE_FINANCIAL_NOTICE');
    throw new Error('STORAGE_WRITE_FAILED_'+r.status);
  }
  return await r.json() as SavedLineRow[];
}
const eq=(v:string)=>encodeURIComponent(v);
export async function insertLineRow(row:LineRow){
  const rows=await query('money_tracker_line_transactions?on_conflict=line_event_id','POST',row);
  return rows.length>0;
}
export async function getLineRow(eventId:string,userId:string){
  const r=await query('money_tracker_line_transactions?line_event_id=eq.'+eq(eventId)+'&line_user_id=eq.'+eq(userId)+'&select=*&limit=1','GET');
  return r[0]||null;
}
export async function reviewLineRow(
  eventId:string,userId:string,decision:'income'|'expense'|'cancelled'
):Promise<'confirmed'|'cancelled'|'already'|'missing'>{
  const row=await getLineRow(eventId,userId);
  if(!row)return 'missing';
  if(row.status!=='pending')return 'already';
  // Atomically change pending status. Client cannot arbitrarily select a LINE user.
  const next=decision==='cancelled'
    ?{status:'cancelled',reviewed_at:new Date().toISOString()}
    :{type:decision,category:decision==='income'?'อื่น ๆ':'อื่น ๆ',status:'confirmed',reviewed_at:new Date().toISOString()};
  const rows=await query('money_tracker_line_transactions?line_event_id=eq.'+eq(eventId)+'&line_user_id=eq.'+eq(userId)+'&status=eq.pending','PATCH',next);
  return rows.length>0?(decision==='cancelled'?'cancelled':'confirmed'):'already';
}
export async function fingerprint(value:string){
  const sum=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  return Array.from(sum,b=>b.toString(16).padStart(2,'0')).join('');
}

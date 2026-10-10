const baseTable='money_tracker_line_links';
type LinkRow={line_user_id:string;pair_code_digest:string|null;pair_expires_at:string|null;session_digest:string|null;session_expires_at:string|null};
function setup(){
  const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error('STORAGE_NOT_CONFIGURED');
  const u=new URL(url);
  if(u.protocol!=='https:')throw new Error('INVALID_STORAGE_URL');
  return {u,key};
}
async function query(path:string,method:'GET'|'PATCH'|'POST',body?:object){
  const {u,key}=setup();
  const r=await fetch(new URL('/rest/v1/'+path,u),{
    method,headers:{
      apikey:key,authorization:'Bearer '+key,'content-type':'application/json',
      prefer:method==='POST'?'resolution=merge-duplicates,return=representation':'return=representation'
    },
    body:body?JSON.stringify(body):undefined
  });
  if(!r.ok)throw new Error('LINK_STORAGE_FAILED_'+r.status);
  return await r.json() as LinkRow[];
}
const eq=(s:string)=>encodeURIComponent(s);
const randomHex=(count:number)=>{
  const data=crypto.getRandomValues(new Uint8Array(count));
  return Array.from(data,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
};
const hash=async(v:string)=>{
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
  return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
};
export async function issuePairCode(lineId:string){
  // 80-bit code valid for five minutes. Reissuing deliberately invalidates old device tokens.
  const code=randomHex(10);
  const digest=await hash(code);
  await query(baseTable+'?on_conflict=line_user_id','POST',{
    line_user_id:lineId,pair_code_digest:digest,
    pair_expires_at:new Date(Date.now()+5*60*1000).toISOString(),
    session_digest:null,session_expires_at:null,linked_at:null
  });
  return code;
}
export async function claimPairCode(input:string){
  const code=input.trim().toUpperCase();
  if(!/^[0-9A-F]{20}$/.test(code))return null;
  const digest=await hash(code);
  const rows=await query(baseTable+'?pair_code_digest=eq.'+eq(digest)+'&pair_expires_at=gt.'+eq(new Date().toISOString())+'&select=line_user_id&limit=1','GET');
  const lineId=rows[0]?.line_user_id;
  if(!lineId)return null;
  const token=randomHex(32);
  const sessionDigest=await hash(token);
  const claimed=await query(baseTable+'?line_user_id=eq.'+eq(lineId)+'&pair_code_digest=eq.'+eq(digest)+'&pair_expires_at=gt.'+eq(new Date().toISOString()),'PATCH',{
    pair_code_digest:null,pair_expires_at:null,session_digest:sessionDigest,
    session_expires_at:new Date(Date.now()+90*24*60*60*1000).toISOString(),
    linked_at:new Date().toISOString()
  });
  return claimed.length?token:null;
}
export async function sessionLineId(token:string):Promise<string|null>{
  if(!/^[0-9A-F]{64}$/.test(token))return null;
  const digest=await hash(token);
  const rows=await query(baseTable+'?session_digest=eq.'+eq(digest)+'&session_expires_at=gt.'+eq(new Date().toISOString())+'&select=line_user_id&limit=1','GET');
  return rows[0]?.line_user_id||null;
}
export async function revokeLineSession(lineId:string){
  await query(baseTable+'?line_user_id=eq.'+eq(lineId),'PATCH',{
    pair_code_digest:null,pair_expires_at:null,session_digest:null,session_expires_at:null,linked_at:null
  });
}
export async function confirmedRows(lineId:string){
  const {u,key}=setup();
  const path='money_tracker_line_transactions?line_user_id=eq.'+eq(lineId)+'&status=eq.confirmed&select=id,type,amount_satang,category,note,method,transaction_date,created_at&order=created_at.desc&limit=500';
  const r=await fetch(new URL('/rest/v1/'+path,u),{headers:{apikey:key,authorization:'Bearer '+key}});
  if(!r.ok)throw new Error('INBOX_QUERY_FAILED_'+r.status);
  return await r.json() as Array<{
    id:string;type:'income'|'expense';amount_satang:number;category:string;note:string;
    method:'cash'|'bank'|'card'|'wallet';transaction_date:string;created_at:string
  }>;
}

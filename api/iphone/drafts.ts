import {auth,appCors,json,options,pendingDrafts,reviewDraft} from '../../server/iphone/bridge';
import {EXPENSE_CATEGORIES,INCOME_CATEGORIES,validDate} from '../../src/lib/finance';
export const maxDuration=15;
export {options as OPTIONS};
function grant(request:Request){
  const cors=appCors(request);
  if(!cors)return {status:403,headers:null};
  const result=auth(request,'review');
  return {status:result==='unconfigured'?503:result==='unauthorized'?401:200,headers:cors};
}
export async function GET(request:Request){
  const g=grant(request);
  if(!g.headers)return json({error:'ORIGIN_DENIED'},403);
  if(g.status!==200)return json({error:g.status===503?'NOT_CONFIGURED':'UNAUTHORIZED'},g.status,g.headers);
  try{
    const rows=await pendingDrafts();
    return json({drafts:rows.map(x=>({
      id:x.id,amountSatang:x.amount_satang,type:x.type,date:x.transaction_date,
      category:x.category,note:x.note,method:x.method,source:x.source_label,createdAt:x.created_at
    }))},200,g.headers);
  }catch{return json({error:'STORAGE_UNAVAILABLE'},503,g.headers);}
}
export async function POST(request:Request){
  const g=grant(request);
  if(!g.headers)return json({error:'ORIGIN_DENIED'},403);
  if(g.status!==200)return json({error:g.status===503?'NOT_CONFIGURED':'UNAUTHORIZED'},g.status,g.headers);
  if(Number(request.headers.get('content-length')||0)>3000)return json({error:'BAD_INPUT'},400,g.headers);
  let input:Record<string,unknown>;
  try{input=await request.json() as Record<string,unknown>}
  catch{return json({error:'BAD_INPUT'},400,g.headers)}
  if(!/^[a-f0-9-]{36}$/i.test(String(input.id||'')) ||
    !['confirm','discard'].includes(String(input.decision||'')))
    return json({error:'BAD_INPUT'},400,g.headers);
  const decision=input.decision as 'confirm'|'discard';
  let entry:{type:'income'|'expense';amountSatang:number;date:string;category:string;note:string;method:'cash'|'bank'|'card'|'wallet'}|undefined;
  if(decision==='confirm'){
    if(!['income','expense'].includes(String(input.type)) ||
      !Number.isSafeInteger(input.amountSatang) || Number(input.amountSatang)<=0 ||
      Number(input.amountSatang)>999999999999 ||
      typeof input.date!=='string' || !validDate(input.date) ||
      typeof input.category!=='string'||input.category.length>80 ||
      typeof input.note!=='string'||input.note.length>500 ||
      !['cash','bank','card','wallet'].includes(String(input.method)))
      return json({error:'INVALID_TRANSACTION'},400,g.headers);
    const type=input.type as 'income'|'expense';
    if(!(type==='income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES).some(x=>x===input.category))
      return json({error:'INVALID_CATEGORY'},400,g.headers);
    entry={type,amountSatang:input.amountSatang as number,date:input.date,
      category:input.category,note:input.note,method:input.method as 'cash'|'bank'|'card'|'wallet'};
  }
  try{
    const row=await reviewDraft(input.id as string,decision,entry);
    if(!row)return json({error:'ALREADY_REVIEWED_OR_MISSING'},409,g.headers);
    return json({status:row.status,id:row.id},200,g.headers);
  }catch{return json({error:'STORAGE_UNAVAILABLE'},503,g.headers);}
}

import {auth,appCors,json,options,confirmedDrafts,correctConfirmedRecipient} from '../../server/iphone/bridge.js';
export const maxDuration=15;
export {options as OPTIONS};
/** Review-token authenticated, recipient-only correction for saved Shortcut entries.
 * Deliberately does not allow edits to financial fields or arbitrary row IDs. */
export async function POST(request:Request){
  const headers=appCors(request);
  if(!headers)return json({error:'ORIGIN_DENIED'},403);
  const grant=auth(request,'review');
  if(grant!=='ok')return json({error:grant==='unconfigured'?'NOT_CONFIGURED':'UNAUTHORIZED'},
    grant==='unconfigured'?503:401,headers);
  let input:unknown;
  try {
    const raw=await request.text();
    if(new TextEncoder().encode(raw).byteLength>600)return json({error:'BAD_INPUT'},400,headers);
    input=JSON.parse(raw) as unknown;
  }catch{return json({error:'BAD_INPUT'},400,headers);}
  if(!input||typeof input!=='object'||Array.isArray(input))
    return json({error:'BAD_INPUT'},400,headers);
  const data=input as Record<string,unknown>;
  if(Object.keys(data).length!==2||!('recipient' in data)||
    !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(String(data.id||'')))
    return json({error:'BAD_INPUT'},400,headers);
  const recipient=data.recipient;
  if(recipient!==null&&(typeof recipient!=='string'||recipient.trim().length<2||
    recipient.trim().length>160||/^THAILAND(?:\s+2026)?$/i.test(recipient.trim())))
    return json({error:'INVALID_RECIPIENT'},400,headers);
  try{
    const ok=await correctConfirmedRecipient(String(data.id),
      recipient===null?null:(recipient as string).trim());
    if(!ok)return json({error:'NOT_FOUND'},404,headers);
    return json({status:'updated'},200,headers);
  }catch{return json({error:'STORAGE_UNAVAILABLE'},503,headers);}
}
export async function GET(request:Request){
  const headers=appCors(request);
  if(!headers)return json({error:'ORIGIN_DENIED'},403);
  const grant=auth(request,'review');
  if(grant!=='ok')return json({error:grant==='unconfigured'?'NOT_CONFIGURED':'UNAUTHORIZED'},grant==='unconfigured'?503:401,headers);
  try{
    const rows=await confirmedDrafts();
    return json({transactions:rows.map(x=>({
      id:'iphone-'+x.id,amountSatang:Number(x.amount_satang),type:x.type,
      date:x.transaction_date,category:x.category,note:x.note,method:x.method,
      ...(x.transaction_time?{time:x.transaction_time}:{}),
      ...(x.recipient?{recipient:x.recipient}:{}),
      createdAt:Date.parse(x.reviewed_at||x.created_at)
    }))},200,headers);
  }catch{return json({error:'STORAGE_UNAVAILABLE'},503,headers);}
}

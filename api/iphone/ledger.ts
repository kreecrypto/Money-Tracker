import {auth,appCors,json,options,confirmedDrafts} from '../../server/iphone/bridge.js';
export const maxDuration=15;
export {options as OPTIONS};
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
      createdAt:Date.parse(x.reviewed_at||x.created_at)
    }))},200,headers);
  }catch{return json({error:'STORAGE_UNAVAILABLE'},503,headers);}
}

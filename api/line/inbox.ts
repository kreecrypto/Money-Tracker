import {sessionLineId,confirmedRows} from './_link';
import {cors,json,options} from './_cors';
export const maxDuration=15;
export {options as OPTIONS};
export async function GET(request:Request){
  const headers=cors(request);
  if(!headers)return new Response('Forbidden',{status:403});
  const m=(request.headers.get('authorization')||'').match(/^Bearer\s+([0-9A-F]{64})$/);
  if(!m)return json({error:'UNAUTHORIZED'},401,headers);
  try{
    const lineId=await sessionLineId(m[1]);
    if(!lineId)return json({error:'UNAUTHORIZED'},401,headers);
    const rows=await confirmedRows(lineId);
    return json({transactions:rows.map(x=>({
      id:'line-'+x.id,type:x.type,amountSatang:Number(x.amount_satang),
      category:x.category,note:x.note,method:x.method,
      date:x.transaction_date,createdAt:Date.parse(x.created_at)
    }))},200,headers);
  }catch{return json({error:'TEMPORARILY_UNAVAILABLE'},503,headers);}
}

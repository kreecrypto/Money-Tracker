import {claimPairCode} from './_link';
import {cors,json,options} from './_cors';

export const maxDuration=15;
export {options as OPTIONS};
export async function POST(request:Request){
  const headers=cors(request);
  if(!headers)return new Response('Forbidden',{status:403});
  if(Number(request.headers.get('content-length')||0)>4096)return json({error:'BAD_INPUT'},413,headers);
  let data:unknown;
  try{data=await request.json();}
  catch{return json({error:'BAD_INPUT'},400,headers);}
  if(!data||typeof data!=='object'||typeof (data as {code?:unknown}).code!=='string')
    return json({error:'BAD_INPUT'},400,headers);
  try{
    const token=await claimPairCode((data as {code:string}).code);
    return token?json({token},200,headers):json({error:'CODE_INVALID_OR_EXPIRED'},400,headers);
  }catch{return json({error:'TEMPORARILY_UNAVAILABLE'},503,headers);}
}

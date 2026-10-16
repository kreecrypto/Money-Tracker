import {json,storageHealth} from '../../server/iphone/bridge.js';

export const maxDuration=15;

/**
 * Privacy-preserving readiness probe for production monitoring.
 * It only tests whether Supabase REST responds to a zero-row query.
 * No financial data, owner identifiers, or secrets leave the endpoint.
 */
export async function GET(request:Request):Promise<Response>{
  // This repository deploys as two Vercel projects. When the app has an
  // explicit backend URL, probe that storage instead of reporting that the
  // static frontend project is missing Supabase credentials.
  const bridge=process.env.VITE_IPHONE_BRIDGE_URL?.trim();
  if(bridge){
    try{
      const target=new URL(bridge);
      if(target.protocol!=='https:'||target.origin===new URL(request.url).origin)
        return json({status:'unavailable',storage:'unavailable',code:'BRIDGE_URL_INVALID'},503);
      const response=await fetch(new URL('/api/iphone/health',target.origin),{
        cache:'no-store',signal:AbortSignal.timeout(8000)
      });
      const result=await response.json().catch(()=>null) as {status?:string;storage?:string}|null;
      if(response.ok&&result?.status==='ok'&&result.storage==='ready')
        return json({status:'ok',storage:'ready',backend:'remote'});
      return json({status:'unavailable',storage:'unavailable',code:'BRIDGE_UNAVAILABLE'},503);
    }catch{
      return json({status:'unavailable',storage:'unavailable',code:'BRIDGE_CONNECTION'},503);
    }
  }
  try{
    await storageHealth();
    return json({status:'ok',storage:'ready'});
  }catch(e){
    const message=e instanceof Error?e.message:'';
    const code=message==='SUPABASE_URL_NOT_CONFIGURED'?'SUPABASE_URL_MISSING':
      message==='SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED'?'SUPABASE_SERVICE_KEY_MISSING':
      message==='INVALID_SUPABASE_URL'?'SUPABASE_URL_INVALID':
      message.startsWith('STORAGE_NOT_CONFIGURED')?'STORAGE_CONFIGURATION':
      /^DATABASE_ERROR_(401|403)(?:\s|$)/.test(message)?'STORAGE_AUTH':
      message.startsWith('DATABASE_ERROR_404')?'STORAGE_SCHEMA':
      /^DATABASE_ERROR_/.test(message)?'STORAGE_QUERY':'STORAGE_CONNECTION';
    console.error('[iphone-health] unavailable:',code);
    return json({status:'unavailable',storage:'unavailable',code},503);
  }
}
export function POST(){return json({error:'METHOD_NOT_ALLOWED'},405);}

import {json,storageHealth} from '../../server/iphone/bridge.js';

export const maxDuration=15;

/**
 * Privacy-preserving readiness probe for production monitoring.
 * It only tests whether Supabase REST responds to a zero-row query.
 * No financial data, owner identifiers, or secrets leave the endpoint.
 */
export async function GET():Promise<Response>{
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

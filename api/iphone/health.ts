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
    const code=/STORAGE_NOT_CONFIGURED|INVALID_SUPABASE_URL/.test(message)?'STORAGE_CONFIGURATION':
      /DATABASE_ERROR_(?:401|403)/.test(message)?'STORAGE_AUTH':
      /DATABASE_ERROR_404/.test(message)?'STORAGE_SCHEMA':
      /DATABASE_ERROR_/.test(message)?'STORAGE_QUERY':'STORAGE_CONNECTION';
    console.error('[iphone-health] unavailable:',code);
    return json({status:'unavailable',storage:'unavailable',code},503);
  }
}
export function POST(){return json({error:'METHOD_NOT_ALLOWED'},405);}

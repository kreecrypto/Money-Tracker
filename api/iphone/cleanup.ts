import {timingSafeEqual} from 'node:crypto';
import {json} from '../../server/iphone/bridge.js';
import {purgeCandidates,purgeRow} from '../../server/iphone/imageStorage.js';
export const maxDuration=60;
function authorized(request:Request){
  const expected=(process.env.SLIP_CLEANUP_SECRET||'').trim();
  const given=(request.headers.get('authorization')||'').match(/^Bearer ([a-fA-F0-9]{64})$/)?.[1]||'';
  if(!/^[a-fA-F0-9]{64}$/.test(expected)||!given)return false;
  return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(given,'hex'));
}
/** Hourly Supabase pg_cron invokes this route with a standalone Vault-held secret. */
export async function POST(request:Request):Promise<Response>{
  if(!process.env.SLIP_CLEANUP_SECRET)return json({error:'NOT_CONFIGURED'},503);
  if(!authorized(request))return json({error:'UNAUTHORIZED'},401);
  try{
    const rows=await purgeCandidates(new Date(),40);
    let removed=0,failed=0;
    for(const row of rows){
      try{const result=await purgeRow(row);if(result.deleted)removed++;else failed++;}
      catch{failed++;}
    }
    return json({processed:rows.length,removed,failed,hasMore:rows.length===40});
  }catch{return json({error:'CLEANUP_UNAVAILABLE'},503);}
}
export function GET(){return json({error:'METHOD_NOT_ALLOWED'},405);}
import {currentConnection,noStore,oauthConfig,sameAppOrigin} from '../../server/gmail/oauth.js';
import {scanKplusMailbox} from '../../server/gmail/mailbox.js';

export const maxDuration=60;

/** Read-only Gmail scan initiated by the linked account; never writes finance rows. */
export async function POST(request:Request):Promise<Response>{
  const config=oauthConfig();
  if(!config)return Response.json({error:'GMAIL_NOT_CONFIGURED'},{status:503,headers:noStore()});
  if(!sameAppOrigin(request,config)||request.headers.get('origin')!==config.origin||
    request.headers.get('sec-fetch-site')==='cross-site')
    return Response.json({error:'ORIGIN_DENIED'},{status:403,headers:noStore()});
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))
    return Response.json({error:'JSON_REQUIRED'},{status:415,headers:noStore()});
  if(await request.text()!=='{}')
    return Response.json({error:'BAD_INPUT'},{status:400,headers:noStore()});
  try{
    const link=await currentConnection(request);
    if(!link)return Response.json({error:'NOT_CONNECTED'},{status:401,headers:noStore()});
    const scan=await scanKplusMailbox(link);
    return Response.json({mode:'preview',saved:0,...scan},{headers:noStore()});
  }catch(e){
    const code=e instanceof Error?e.message:'';
    const expected=['GMAIL_RECONNECT_REQUIRED','GMAIL_PERMISSION_DENIED','GMAIL_SCOPE_MISSING'];
    return Response.json({error:expected.includes(code)?code:'GMAIL_SCAN_UNAVAILABLE'},
      {status:expected.includes(code)?403:503,headers:noStore()});
  }
}
export function GET():Response{return Response.json({error:'METHOD_NOT_ALLOWED'},
  {status:405,headers:noStore()});}

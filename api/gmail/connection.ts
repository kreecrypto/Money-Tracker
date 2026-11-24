import {
  clearSessionCookie,currentConnection,maskEmail,noStore,oauthConfig,sameAppOrigin,
  unlinkConnection,unseal
} from '../../server/gmail/oauth.js';

export async function GET(request:Request):Promise<Response>{
  const config=oauthConfig();
  if(!config)return Response.json({available:false,connected:false},{headers:noStore()});
  if(!sameAppOrigin(request,config))
    return Response.json({error:'ORIGIN_DENIED'},{status:403,headers:noStore()});
  try{
    const link=await currentConnection(request);
    if(!link)return Response.json({available:true,connected:false},{headers:noStore()});
    return Response.json({available:true,connected:true,email:maskEmail(link.email),
      linkedAt:link.linked_at},{headers:noStore()});
  }catch{
    return Response.json({error:'GMAIL_CONNECTION_UNAVAILABLE'},{status:503,headers:noStore()});
  }
}
export async function POST(request:Request):Promise<Response>{
  const config=oauthConfig();
  if(!config)return Response.json({error:'GMAIL_OAUTH_NOT_CONFIGURED'},{status:503,headers:noStore()});
  if(!sameAppOrigin(request,config)||request.headers.get('origin')!==config.origin||
    !['same-origin','none',null].includes(request.headers.get('sec-fetch-site')))
    return Response.json({error:'ORIGIN_DENIED'},{status:403,headers:noStore()});
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))
    return Response.json({error:'JSON_REQUIRED'},{status:415,headers:noStore()});
  let input:unknown;
  try{
    const body=await request.text();
    if(body.length>200)return Response.json({error:'BAD_INPUT'},{status:400,headers:noStore()});
    input=JSON.parse(body);
  }catch{return Response.json({error:'BAD_INPUT'},{status:400,headers:noStore()});}
  if(!input||typeof input!=='object'||Array.isArray(input)||
    Object.keys(input).length!==1||(input as {action?:unknown}).action!=='disconnect')
    return Response.json({error:'BAD_INPUT'},{status:400,headers:noStore()});
  try{
    const link=await currentConnection(request);
    let googleRevoked=false;
    if(link){
      const token=unseal(config,'refresh-v1',link.encrypted_refresh_token);
      if(token){
        try{
          const response=await fetch('https://oauth2.googleapis.com/revoke',{
            method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
            body:new URLSearchParams({token}),cache:'no-store',signal:AbortSignal.timeout(8000)
          });
          googleRevoked=response.ok;
        }catch{/* Local disconnect remains possible when Google is unavailable. */}
      }
    }
    await unlinkConnection(request);
    return Response.json({disconnected:true,googleRevoked},{
      headers:{...noStore(),'set-cookie':clearSessionCookie(config)}
    });
  }catch{
    return Response.json({error:'GMAIL_DISCONNECT_FAILED'},{status:503,headers:noStore()});
  }
}

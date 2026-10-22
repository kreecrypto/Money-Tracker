import {
  clearStateCookie,exchangeCode,googleIdentity,noStore,oauthConfig,persistConnection,
  randomToken,sameAppOrigin,sessionCookie,validateState
} from '../../../server/gmail/oauth.js';

const safeRedirect=(base:string,reason:string,headers:Headers)=>
  new Response(null,{status:302,headers:(headers.set('location',base+'/?gmail='+reason),headers)});

export async function GET(request:Request):Promise<Response>{
  const config=oauthConfig();
  if(!config)return Response.json({error:'GMAIL_OAUTH_NOT_CONFIGURED'},{status:503,headers:noStore()});
  if(!sameAppOrigin(request,config))return Response.json({error:'ORIGIN_DENIED'},{status:403,headers:noStore()});
  const headers=new Headers(noStore());
  headers.append('set-cookie',clearStateCookie(config));
  const search=new URL(request.url).searchParams;
  const verifier=validateState(config,request,search.get('state'));
  if(!verifier)return safeRedirect(config.origin,'state_error',headers);
  const code=search.get('code')||'';
  if(search.has('error')||code.length<10||code.length>2048)return safeRedirect(config.origin,'authorization_failed',headers);
  try{
    const result=await exchangeCode(config,code,verifier);
    if(!result)return safeRedirect(config.origin,'authorization_failed',headers);
    const tokens=JSON.parse(result) as {access:string;refresh:string};
    const identity=await googleIdentity(tokens.access);
    if(!identity)return safeRedirect(config.origin,'identity_failed',headers);
    const session=randomToken();
    await persistConnection(identity,tokens.refresh,session,config);
    headers.append('set-cookie',sessionCookie(session,config));
    return safeRedirect(config.origin,'connected',headers);
  }catch{
    return safeRedirect(config.origin,'connection_failed',headers);
  }
}
export function POST():Response{return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers:noStore()});}

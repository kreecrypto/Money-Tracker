import {createLogin,noStore,oauthConfig,sameAppOrigin} from '../../../server/gmail/oauth.js';

export async function GET(request:Request):Promise<Response>{
  const config=oauthConfig();
  if(!config)return Response.json({error:'GMAIL_OAUTH_NOT_CONFIGURED'},{status:503,headers:noStore()});
  if(!sameAppOrigin(request,config))return Response.json({error:'ORIGIN_DENIED'},{status:403,headers:noStore()});
  const login=createLogin(config);
  return new Response(null,{status:302,headers:{
    ...noStore(),location:login.url,'set-cookie':login.cookie
  }});
}
export function POST():Response{return Response.json({error:'METHOD_NOT_ALLOWED'},{status:405,headers:noStore()});}

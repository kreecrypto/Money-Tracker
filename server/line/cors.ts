export function cors(request:Request){
  const expected=process.env.LINE_ALLOWED_APP_ORIGIN||'';
  const origin=request.headers.get('origin')||'';
  if(!expected||!origin||origin!==expected)return null;
  return {
    'access-control-allow-origin':expected,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'Content-Type,Authorization',
    'cache-control':'no-store',
    vary:'Origin'
  };
}
export function options(request:Request){
  const headers=cors(request);
  return headers?new Response(null,{status:204,headers}):new Response('Forbidden',{status:403});
}
export function json(value:object,status:number,headers:Record<string,string>){
  return new Response(JSON.stringify(value),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}});
}

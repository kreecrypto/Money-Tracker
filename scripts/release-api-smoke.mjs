/** Non-destructive negative security smoke for an EXPLICIT Money Tracker API target.
 * No real tokens, financial records or bank-slip bytes are sent. Bypass secret remains in Actions secret.
 * Requires RELEASE_API_BASE_URL and RELEASE_APP_ORIGIN. Fails closed when target is unknown.
 */
import fs from 'node:fs';
import path from 'node:path';
const BASE=(process.env.RELEASE_API_BASE_URL||'').replace(/\/+$/,'').trim();
const ORIGIN=(process.env.RELEASE_APP_ORIGIN||'').trim();
const BYPASS=(process.env.VERCEL_AUTOMATION_BYPASS_SECRET||'').trim();
const approvedHosts=new Set([
  'money-tracker-api-blush.vercel.app',
  'money-tracker-api-git-feat-0dc0ed-kreetaphongame-3572s-projects.vercel.app'
]);
let target;
try{target=new URL(BASE);}catch{throw Error('RELEASE_GATE_BLOCKED: RELEASE_API_BASE_URL must be an HTTPS URL');}
if(target.protocol!=='https:'||target.pathname!=='/'||target.search||target.hash||!approvedHosts.has(target.hostname)){
  throw Error('RELEASE_GATE_BLOCKED: API host not allowlisted. Never send bypass credentials to arbitrary destinations.');
}
if(!/^https:\/\/money-tracker-(?:beta-teal\.vercel\.app|git-feat-mob-91aa1e-kreetaphongame-3572s-projects\.vercel\.app)$/.test(ORIGIN)){
  throw Error('RELEASE_GATE_BLOCKED: RELEASE_APP_ORIGIN must match an approved web origin');
}
const reportPath=process.env.RELEASE_REPORT_PATH||'release-artifacts/api-negative-smoke.json';
const bogus='0'.repeat(64);
const tests=[
  {name:'private image denies missing Origin',route:'/api/iphone/image?id=11111111-1111-4111-8111-111111111111',method:'GET',expected:403,code:'ORIGIN_DENIED'},
  {name:'drafts deny missing Origin',route:'/api/iphone/drafts',method:'GET',expected:403,code:'ORIGIN_DENIED'},
  {name:'drafts reject untrusted Origin',route:'/api/iphone/drafts',method:'OPTIONS',origin:'https://untrusted.example',expected:403,plain:'Forbidden'},
  {name:'drafts reject invalid review token',route:'/api/iphone/drafts',method:'GET',origin:ORIGIN,token:bogus,expected:401,code:'UNAUTHORIZED'},
  {name:'upload rejects anonymous call',route:'/api/iphone/upload',method:'POST',expected:401,code:'UNAUTHORIZED'},
  {name:'upload rejects invalid bearer',route:'/api/iphone/upload',method:'POST',token:bogus,expected:401,code:'UNAUTHORIZED'},
  {name:'cleanup rejects anonymous call',route:'/api/iphone/cleanup',method:'POST',expected:401,code:'UNAUTHORIZED'},
  {name:'cleanup rejects invalid bearer',route:'/api/iphone/cleanup',method:'POST',token:bogus,expected:401,code:'UNAUTHORIZED'},
  {name:'cleanup cannot run over GET',route:'/api/iphone/cleanup',method:'GET',expected:405,code:'METHOD_NOT_ALLOWED'}
];
const results=[];
for(const t of tests){
  let status=0,passed=false,error='';
  try{
    const r=await fetch(BASE+t.route,{
      method:t.method,headers:{
        ...(t.origin?{origin:t.origin}:{}),
        ...(t.token?{authorization:'Bearer '+t.token}:{}),
        ...(BYPASS?{'x-vercel-protection-bypass':BYPASS}:{})
      },redirect:'manual',signal:AbortSignal.timeout(12000),cache:'no-store'
    });
    status=r.status;
    // Compare API-owned error code. Vercel Authentication HTML 401 must never be a false PASS.
    const body=await r.text();
    const type=r.headers.get('content-type')||'';
    if(t.code&&type.includes('application/json')){
      let parsed;try{parsed=JSON.parse(body);}catch{}
      passed=status===t.expected&&parsed?.error===t.code;
    }else if(t.plain){
      passed=status===t.expected&&body.trim()===t.plain;
    }
  }catch(e){error=e instanceof Error?e.name:'NETWORK_ERROR';}
  results.push({name:t.name,status,expected:t.expected,passed,error});
  console.log((passed?'PASS':'FAIL')+' '+t.name+' (HTTP '+status+' expected '+t.expected+')');
}
fs.mkdirSync(path.dirname(reportPath),{recursive:true});
fs.writeFileSync(reportPath,JSON.stringify({timestamp:new Date().toISOString(),host:target.hostname,results,allPassed:results.every(x=>x.passed),scope:'negative-only; NOT E2E'},null,2));
if(results.some(x=>!x.passed)){
  console.error('RELEASE_GATE_BLOCKED: API negative smoke is not fully passing');
  process.exitCode=1;
}else console.log('API_NEGATIVE_SMOKE_PASS: upload/expiry/storage-delete/iPhone UAT remain independent release gates');

/** Read-only/negative live API security gate. No real tokens, files or user records are sent.
 * Run only against the configured Money Tracker API domain after approved deployment.
 */
import fs from 'node:fs';
import pathUtil from 'node:path';
const BASE='https://money-tracker-api-blush.vercel.app';
const path=process.env.RELEASE_REPORT_PATH||'release-artifacts/api-negative-smoke.json';
const bogus='0'.repeat(64);
const cases=[
  {name:'private image requires allowed Origin',route:'/api/iphone/image?id=11111111-1111-4111-8111-111111111111',method:'GET',expected:403},
  {name:'drafts require allowed Origin',route:'/api/iphone/drafts',method:'GET',expected:403},
  {name:'drafts reject untrusted Origin',route:'/api/iphone/drafts',method:'OPTIONS',origin:'https://untrusted.example',expected:403},
  {name:'drafts reject invalid review secret',route:'/api/iphone/drafts',method:'GET',origin:'https://money-tracker-beta-teal.vercel.app',token:bogus,expected:401},
  {name:'upload rejects anonymous calls',route:'/api/iphone/upload',method:'POST',expected:401},
  {name:'cleanup rejects anonymous calls',route:'/api/iphone/cleanup',method:'POST',expected:401},
  {name:'cleanup cannot be triggered by GET',route:'/api/iphone/cleanup',method:'GET',expected:405}
];
const results=[];
for(const test of cases){
  let status=0,passed=false,error='';
  try{
    const response=await fetch(BASE+test.route,{
      method:test.method,headers:{
        ...(test.origin?{origin:test.origin}:{}),
        ...(test.token?{authorization:'Bearer '+test.token}:{})
      },redirect:'manual',signal:AbortSignal.timeout(12000),cache:'no-store'
    });
    status=response.status;
    passed=status===test.expected;
    // Do not record response bodies: they could contain sensitive application details.
  }catch(e){error=e instanceof Error?e.name:'NETWORK_ERROR';}
  results.push({name:test.name,expected:test.expected,status,passed,error});
  console.log((passed?'PASS':'FAIL')+' '+test.name+' (HTTP '+status+', expected '+test.expected+')');
}
fs.mkdirSync(pathUtil.dirname(path),{recursive:true});
fs.writeFileSync(path,JSON.stringify({timestamp:new Date().toISOString(),base:BASE,results,allPassed:results.every(x=>x.passed)},null,2));
if(results.some(x=>!x.passed)){
  console.error('RELEASE_GATE_BLOCKED: API negative smoke is not fully passing');
  process.exitCode=1;
}else console.log('API_NEGATIVE_SMOKE_PASS — Does NOT substitute for upload/expiry/physical-delete E2E');

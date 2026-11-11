/** Strict parser for K PLUS notification emails; no OCR or account-number storage. */
export type EmailDecision = {
  status:'ready'|'pending'|'skipped';
  reason:string;
  type:'income'|'expense'|null;
  amountSatang:number|null;
  date:string|null;
  time:string|null;
  reference:string|null;
  recipient:string|null;
  sender:string|null;
};

const clean=(s:string)=>s.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').trim();
const unique=<T>(items:T[]):T[]=>[...new Set(items)];
const capture=(body:string,re:RegExp):string[]=>Array.from(body.matchAll(re),m=>(m[1]||'').trim()).filter(Boolean);
const one=(items:string[]):string|null=>{
  const values=unique(items);
  return values.length===1?values[0]:null;
};
function satang(value:string):number|null{
  const s=value.replace(/,/g,'').trim();
  const m=s.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if(!m)return null;
  const n=Number(m[1])*100+Number((m[2]||'').padEnd(2,'0'));
  return Number.isSafeInteger(n)&&n>0&&n<=999999999999?n:null;
}
function dateTime(value:string):{date:string;time:string}|null{
  const m=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if(!m)return null;
  const d=Number(m[1]),month=Number(m[2]),year=Number(m[3]);
  if(year<2000||year>2100)return null;
  const t=new Date(Date.UTC(year,month-1,d));
  if(t.getUTCFullYear()!==year||t.getUTCMonth()!==month-1||t.getUTCDate()!==d)return null;
  return {date:String(year)+'-'+String(month).padStart(2,'0')+'-'+String(d).padStart(2,'0'),time:m[4]+':'+m[5]};
}
const empty=(reason:string,status:'pending'|'skipped'='pending'):EmailDecision=>({
  status,reason,type:null,amountSatang:null,date:null,time:null,reference:null,recipient:null,sender:null
});
function safeName(value:string|null):string|null{
  if(!value)return null;
  const name=value.replace(/\s+/g,' ').trim();
  if(name.length<2||name.length>160||/[\r\n<>]/.test(name)||
     /(?:เลขบัญชี|ธนาคาร|account|available balance|ยอดถอนได้)/i.test(name))return null;
  return name;
}
export function isKplusSender(value:string):boolean{
  const m=value.match(/<([^>]+)>/);
  const address=(m?m[1]:value).trim().toLowerCase();
  return address==='kplus@kasikornbank.com';
}
export function parseKplusEmail(subjectInput:string,bodyInput:string,ownNames:string[]=[]):EmailDecision{
  const subject=clean(subjectInput);
  const body=clean(bodyInput);
  if(!subject||!body||body.length>12000)return empty('INVALID_EMAIL','skipped');
  if(/(?:\(failure\)|unsuccessful|failed|ไม่สำเร็จ|รายการล้มเหลว)/i.test(subject))
    return empty('FAILED_NOTICE','skipped');
  const outgoingSubject=/^Result of (?:Funds Transfer|PromptPay Funds Transfer|Bill Payment|Cash Transfer via K PLUS) \(Success\)$/i.test(subject);
  const incomingSignal=/(?:เงินเข้า(?:บัญชี)?|รับโอนเงิน(?:เข้า)?|ได้รับเงินโอน|เครดิตเข้าบัญชี|incoming (?:funds|transfer)|funds received|credited to (?:your )?account)/i;
  const incoming= incomingSignal.test(subject)||incomingSignal.test(body.split('\n').slice(0,25).join('\n'));
  const outgoingSignal=/(?:โอนเงินจากบัญชี|ชำระเงินจากบัญชี|โอนเงินออกจากบัญชี|Paid From Account|From Account)/i;
  const outgoing=outgoingSubject&&outgoingSignal.test(body);
  if(!outgoing&&!incoming)return empty('UNSUPPORTED_OR_AMBIGUOUS_NOTICE','skipped');
  if(outgoing&&incoming)return empty('DIRECTION_CONFLICT');
  const type=incoming?'income':'expense';

  const amountCandidates=capture(body,/^\s*(?:จำนวนเงิน\s*\(บาท\)|Amount\s*\(THB\))\s*[:：]\s*([\d,]+(?:\.\d{1,2})?)\s*$/gim)
    .map(satang);
  const amounts=unique(amountCandidates.filter((n):n is number=>n!==null));
  const amount=amounts.length===1?amounts[0]:null;
  const when=capture(body,/^\s*(?:วันที่ทำรายการ|Transaction Date)\s*[:：]\s*(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)\s*$/gim)
    .map(dateTime);
  const validWhen=unique(when.filter((x):x is {date:string;time:string}=>x!==null)
    .map(x=>x.date+'|'+x.time));
  const current=validWhen.length===1?validWhen[0].split('|'):null;
  const refs=capture(body,/^\s*(?:เลขที่รายการ|Transaction Number)\s*[:：]\s*([A-Z0-9-]{8,56})\s*$/gim)
    .map(x=>x.replace(/-/g,'').toUpperCase()).filter(x=>/\d/.test(x));
  const ref=one(refs);
  const receiver=safeName(one(capture(body,/^\s*(?:ชื่อผู้รับ(?:เงิน)?|ชื่อร้านค้า|Received Name|Company Name|ชื่อ)\s*[:：]?\s+(.+?)\s*$/gim)));
  const payer=safeName(one(capture(body,/^\s*(?:ชื่อผู้โอน|ชื่อผู้ส่ง|Sender Name|From Name)\s*[:：]?\s+(.+?)\s*$/gim)));
  const result:EmailDecision={
    status:'pending',reason:'INCOMPLETE_OR_AMBIGUOUS',type,
    amountSatang:amount??null,date:current?.[0]||null,time:current?.[1]||null,
    reference:ref,recipient:type==='expense'?receiver:null,sender:type==='income'?payer:null
  };
  if(!current||!amount||!ref||amounts.length!==1||validWhen.length!==1||
     (type==='expense'&&!receiver))return result;
  // Owner-to-owner bank transfers do not change personal cash flow.
  const own=new Set(ownNames.map(x=>x.trim().toLocaleLowerCase('th-TH')).filter(Boolean));
  if(type==='expense'&&!/Bill Payment/i.test(subject)&&receiver&&own.has(receiver.toLocaleLowerCase('th-TH')))
    return {...result,status:'skipped',reason:'OWN_ACCOUNT_TRANSFER'};
  return {...result,status:'ready',reason:'COMPLETE'};
}

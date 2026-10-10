import type {EntryType} from '../../src/lib/finance';

export type BankNotice={
  type:EntryType; amountSatang:number; date:string|null; time:string|null;
  bank:'kbank'|'unknown'; fingerprintSource:string|null; requiresConfirmation:true;
};
const thDigits='๐๑๒๓๔๕๖๗๘๙';
const digits=(s:string)=>s.replace(/[๐-๙]/g,c=>String(thDigits.indexOf(c)));
const months:Record<string,number>={'ม.ค.':1,'ก.พ.':2,'มี.ค.':3,'เม.ย.':4,'พ.ค.':5,'มิ.ย.':6,'ก.ค.':7,'ส.ค.':8,'ก.ย.':9,'ต.ค.':10,'พ.ย.':11,'ธ.ค.':12};
const compact=(s:string)=>digits(s).replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').replace(/−/g,'-');
function validDate(y:number,m:number,d:number){
  const x=new Date(Date.UTC(y,m-1,d));
  return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d;
}
function parseThaiDate(text:string):{date:string,time:string|null}|null{
  const match=text.match(/(\d{1,2})\s*(ม\.\s*ค\.|ก\.\s*พ\.|มี\.\s*ค\.|เม\.\s*ย\.|พ\.\s*ค\.|มิ\.\s*ย\.|ก\.\s*ค\.|ส\.\s*ค\.|ก\.\s*ย\.|ต\.\s*ค\.|พ\.\s*ย\.|ธ\.\s*ค\.)\s*(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if(!match)return null;
  const m=months[match[2].replace(/\s/g,'')];
  let y=Number(match[3]);if(y<100)y+=2500;if(y>=2400)y-=543;
  const d=Number(match[1]);if(!m||!validDate(y,m,d))return null;
  const time=match[4]!==undefined?match[4].padStart(2,'0')+':'+match[5]:null;
  if(time&&(Number(match[4])>23||Number(match[5])>59))return null;
  return {date:y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'),time};
}
/** Read ONLY the amount adjacent to จำนวนเงิน. Never treat account balance as an entry. */
export function parseBankNotice(source:string):BankNotice|null{
  const s=compact(source);
  if(!s||s.length>20000)return null;
  const marker=s.match(/จำนวนเงิน\s*[:：]?\s*([+-]?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)\s*(?:บาท|THB)?/i);
  if(!marker)return null;
  const number=marker[1].replace(/\s/g,'').replace(/,/g,'');
  if(!/^[+-]?\d+(?:\.\d{1,2})?$/.test(number))return null;
  const amount=Math.round(Number(number)*100);
  if(!Number.isSafeInteger(amount)||amount===0)return null;
  const heading=s.slice(0,s.indexOf('จำนวนเงิน'));
  const incoming=/รับโอน|โอนเข้า|เงินเข้า|รับเงิน/.test(heading);
  const outgoing=/โอน\/ถอน|โอนออก|ถอนเงิน|เงินออก|หักบัญชี/.test(heading)||amount<0;
  if(incoming===outgoing)return null;
  const type:EntryType=incoming?'income':'expense';
  if(type==='income'&&amount<0)return null;
  const when=parseThaiDate(s);
  const masked=s.match(/(?:x{2,}|X{2,}|[*]{2,})[-xX*0-9]+/);
  const bank=/KBank|K PLUS|กสิกร/i.test(s)?'kbank':'unknown';
  const fingerprintSource=when?.date&&when.time
    ?[bank,when.date,when.time,type,Math.abs(amount),masked?.[0]||'unknown'].join('|')
    :null;
  return {
    type,amountSatang:Math.abs(amount),date:when?.date||null,time:when?.time||null,bank,
    fingerprintSource,requiresConfirmation:true
  };
}

import {isValidTransaction,toSatang,type Transaction} from './finance';

export type EmailLedgerExcluded = {date:string;time:string;name:string;status:string;reason:string};
export type EmailLedgerParsed = {confirmed:Transaction[];excluded:EmailLedgerExcluded[]};
const FIELDS=['วันที่','เวลา','ผู้รับเงิน/ร้านค้า','รายละเอียดชี้แจง','หมวดหมู่','จำนวนเงิน','ค่าธรรมเนียม','สถานะ','รวมรายจ่าย','เลขอ้างอิง','Gmail URL'] as const;

/** RFC 4180 quotes, escaped quotes, CRLF and multiline cells; no third-party parser needed. */
export function csvRows(text:string):string[][] {
  if(text.length>1_000_000)throw new Error('ไฟล์ใหญ่เกิน 1 MB');
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
  const append=()=>{row.push(field);field='';if(row.some(cell=>cell.trim()))rows.push(row);row=[];if(rows.length>2001)throw new Error('เกิน 2,000 แถว');};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(c==='"'){quoted=false;closed=true;}
      else field+=c;
    }else if(c===','){row.push(field);field='';closed=false;}
    else if(c==='\n'||c==='\r'){append();if(c==='\r'&&text[i+1]==='\n')i++;closed=false;}
    else if(c==='"'&&!field&&!closed)quoted=true;
    else if(c==='"'||closed)throw new Error('รูปแบบเครื่องหมายอัญประกาศ CSV ไม่ถูกต้อง');
    else field+=c;
  }
  if(quoted)throw new Error('CSV มีข้อความที่ปิดเครื่องหมายอัญประกาศไม่ครบ');
  if(field||row.length)append();
  return rows;
}
function mapCategory(label:string):Transaction['category'] {
  if(/อาหาร|กาแฟ|เครื่องดื่ม/.test(label))return 'อาหารและเครื่องดื่ม';
  if(/บันเทิง|เกม/.test(label))return 'บันเทิง';
  if(/เดินทาง|ทางด่วน|ยานพาหนะ|ประกันภัย/.test(label))return 'เดินทาง';
  if(/โทรศัพท์|อินเทอร์เน็ต|สาธารณูปโภค/.test(label))return 'บ้านและค่าน้ำไฟ';
  if(/ผ่อน|หนี้/.test(label))return 'ผ่อนชำระ/หนี้';
  return 'อื่น ๆ'; // wallet top-up remains an expense, with original subcategory in the note
}
function validDate(date:string):boolean {
  if(!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date))return false;
  const t=new Date(date+'T12:00:00');
  return !Number.isNaN(t.getTime())&&[t.getFullYear(),String(t.getMonth()+1).padStart(2,'0'),String(t.getDate()).padStart(2,'0')].join('-')===date;
}
function moneyZero(value:string){return /^(?:0|0\.0{1,2})$/.test(value.trim());}
function gmailEvidence(url:string):string {
  if(!url)return '';
  try{
    const parsed=new URL(url);
    if(parsed.protocol!=='https:'||parsed.hostname!=='mail.google.com'||parsed.username||parsed.password||url.length>500)throw new Error();
    return url;
  }catch{throw new Error('ลิงก์หลักฐาน Gmail ไม่ถูกต้อง');}
}
export function parseEmailLedgerCsv(csv:string,now=Date.now()):EmailLedgerParsed {
  const rows=csvRows(csv.replace(/^\uFEFF/,''));
  if(rows.length<2)throw new Error('ไม่พบรายการใน CSV');
  const cols=FIELDS.map(x=>rows[0].indexOf(x));
  if(cols.some(x=>x<0))throw new Error('หัวตาราง CSV ไม่ตรงกับไฟล์คำชี้แจงจาก Money Tracker');
  const get=(row:string[],name:typeof FIELDS[number])=>(row[cols[FIELDS.indexOf(name)]]||'').trim();
  const confirmed:Transaction[]=[],excluded:EmailLedgerExcluded[]=[],seen=new Set<string>();
  for(let i=1;i<rows.length;i++){
    const r=rows[i],date=get(r,'วันที่'),time=get(r,'เวลา'),name=get(r,'ผู้รับเงิน/ร้านค้า');
    const status=get(r,'สถานะ'),description=get(r,'รายละเอียดชี้แจง');
    if(status!=='ยืนยันรายจ่าย'){
      excluded.push({date,time,name,status:status||'ไม่ทราบสถานะ',reason:description});
      continue;
    }
    const amountSatang=toSatang(get(r,'จำนวนเงิน'));
    const totalSatang=toSatang(get(r,'รวมรายจ่าย'));
    const ref=get(r,'เลขอ้างอิง'),subcategory=get(r,'หมวดหมู่'),fee=get(r,'ค่าธรรมเนียม');
    if(!amountSatang||totalSatang!==amountSatang||!moneyZero(fee)||!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||
      !/^[A-Za-z0-9_-]{8,90}$/.test(ref)||!name||name.length>160||!description)
      throw new Error('แถว '+(i+1)+' มีวันเวลา จำนวนเงิน ค่าธรรมเนียม หรือเลขอ้างอิงไม่ถูกต้อง');
    if(seen.has(ref)){excluded.push({date,time,name,status:'เลขอ้างอิงซ้ำในไฟล์',reason:'พบหลักฐานธุรกรรมซ้ำ ไม่เพิ่มยอด'});continue;}
    seen.add(ref);
    const gmail=gmailEvidence(get(r,'Gmail URL'));
    const note=['หมวดย่อย: '+subcategory,description,'เลขอ้างอิง: '+ref,gmail?'Gmail: '+gmail:''].filter(Boolean).join('\n');
    const tx:Transaction={id:'email-'+ref,type:'expense',amountSatang,category:mapCategory(subcategory),note,date,time,recipient:name,method:'bank',createdAt:now+i};
    if(!isValidTransaction(tx))throw new Error('แถว '+(i+1)+' มีข้อมูลเกินขอบเขตการบันทึก');
    confirmed.push(tx);
  }
  return {confirmed,excluded};
}
/** Treat same minute, date and amount as a collision requiring manual review, not a new expense. */
export function isLikelyEmailDuplicate(item:Transaction,other:Transaction):boolean {
  if(item.id===other.id)return true;
  if(item.type!==other.type)return false;
  const reference=item.id.startsWith('email-')?item.id.slice(6):'';
  if(reference&&(other.receipt?.receiptId===reference||
    other.note.split('\\n').includes('เลขอ้างอิง: '+reference)))return true;
  if(item.date!==other.date||item.amountSatang!==other.amountSatang)return false;
  if(item.time&&other.time)return item.time===other.time;
  // shortcut: a missing clock time requires matching counterpart before treating the amount as possibly duplicated.
  const counterpart=(s?:string)=>s?.trim().toLocaleLowerCase('th-TH')||'';
  return counterpart(item.recipient)!==''&&counterpart(item.recipient)===counterpart(other.recipient);
}
export function partitionEmailLedger(items:Transaction[],existing:Transaction[]){
  const ready:Transaction[]=[],duplicates:Transaction[]=[];
  for(const item of items){
    if([...existing,...ready].some(saved=>isLikelyEmailDuplicate(item,saved)))duplicates.push(item);
    else ready.push(item);
  }
  return {ready,duplicates};
}

/** Email evidence links are rendered only when they stay on Gmail over HTTPS. */
export function emailLedgerEvidence(note:string):string|undefined {
  const match=note.match(/(?:^|\n)Gmail: (https:\/\/mail\.google\.com\/[^\s]+)/);
  if(!match)return undefined;
  try{return gmailEvidence(match[1]);}catch{return undefined;}
}
export function emailLedgerCategory(item:Transaction):string {
  if(!item.id.startsWith('email-'))return item.category;
  return item.note.match(/^หมวดย่อย: ([^\n]+)/)?.[1]||item.category;
}
export function emailLedgerExplanation(item:Transaction):string {
  if(!item.id.startsWith('email-'))return item.note;
  return item.note.replace(/^หมวดย่อย: [^\n]*\n/,'').replace(/\nGmail: https:\/\/mail\.google\.com\/[^\s]+/,'');
}

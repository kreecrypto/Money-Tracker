import {toSatang} from './finance';

/** OCR parsing is intentionally conservative: uncertain values stay empty for human review. */
export type SlipFields = {
  amountSatang: number | null;
  date: string | null;
  recipient: string | null;
  rawText: string;
  warnings: string[];
};

const AMOUNT_LABEL = /(?:จำนวน\s*เงิน(?:ที่\s*โอน)?|ยอด(?:เงิน|โอน|ชำระ|จ่าย)|จำนวนที่โอน|total\s*(?:amount|paid)?|amount(?:\s*paid)?)/iu;
const EXCLUDED_AMOUNT = /(?:ค่าธรรมเนียม|ค่าบริการ|ยอดคงเหลือ|คงเหลือ|balance|fee|ค่าธรรมเนียมการโอน|เลขที่|รหัสอ้างอิง|reference|เลขอ้างอิง|บัญชี|account|หมายเลข)/iu;
const MONEY_RE = /(?:฿\s*|THB\s*)?(?:\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d{1,7}(?:\.\d{2})?)/giu;
const THAI_MONTHS = new Map<string,number>([
  ['ม.ค.',1],['มกราคม',1],['jan',1],['january',1],
  ['ก.พ.',2],['กุมภาพันธ์',2],['feb',2],['february',2],
  ['มี.ค.',3],['มีนาคม',3],['mar',3],['march',3],
  ['เม.ย.',4],['เมษายน',4],['apr',4],['april',4],
  ['พ.ค.',5],['พฤษภาคม',5],['may',5],
  ['มิ.ย.',6],['มิถุนายน',6],['jun',6],['june',6],
  ['ก.ค.',7],['กรกฎาคม',7],['jul',7],['july',7],
  ['ส.ค.',8],['สิงหาคม',8],['aug',8],['august',8],
  ['ก.ย.',9],['กันยายน',9],['sep',9],['sept',9],['september',9],
  ['ต.ค.',10],['ตุลาคม',10],['oct',10],['october',10],
  ['พ.ย.',11],['พฤศจิกายน',11],['nov',11],['november',11],
  ['ธ.ค.',12],['ธันวาคม',12],['dec',12],['december',12],
]);
const MONTH_RE = /\b(january|february|march|april|may|june|july|august|september|october|november|december|sept|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\b|(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/iu;

function toAscii(text:string):string {
  return text.replace(/[๐-๙]/g,d=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)));
}

function parseMoney(line:string):number[] {
  const values:number[]=[];
  for(const match of line.matchAll(MONEY_RE)){
    const idx=match.index;
    const before=line[idx-1]||'';
    const after=line[idx+match[0].length]||'';
    // Exclude digits from dates, times, transfer reference numbers, and account numbers.
    if(/[\p{L}\d/.:\-]/u.test(before)||/[\d/.:\-]/u.test(after))continue;
    const amount=match[0].replace(/^(฿\s*|THB\s*)/iu,'').trim();
    const satang=toSatang(amount);
    if(satang&&satang<=999_999_999)values.push(satang);
  }
  return [...new Set(values)];
}

function parseAmount(lines:string[]):number|null {
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(!AMOUNT_LABEL.test(line)||EXCLUDED_AMOUNT.test(line))continue;
    // Keep only text following the label where possible.
    const label=AMOUNT_LABEL.exec(line);
    const after=label?line.slice(label.index+label[0].length):line;
    let candidates=parseMoney(after);
    if(!candidates.length)candidates=parseMoney(line.slice(0,label?.index??0));
    if(candidates.length===1)return candidates[0];
    if(candidates.length>1)continue;
    const next=lines[i+1]||'';
    if(!EXCLUDED_AMOUNT.test(next)){
      candidates=parseMoney(next);
      if(candidates.length===1)return candidates[0];
    }
  }
  // Without an amount label, use only a single explicit currency value.
  const candidates=new Set<number>();
  for(const line of lines){
    if(EXCLUDED_AMOUNT.test(line)||!/(?:฿|\bTHB\b|บาท)/iu.test(line))continue;
    for(const value of parseMoney(line))candidates.add(value);
  }
  return candidates.size===1?[...candidates][0]:null;
}

function formatDate(y:number,m:number,d:number):string|null {
  const year=y>=2400&&y<=2700?y-543:y>=66&&y<=99?2500+y-543:y>=0&&y<=39?2000+y:y;
  if(year<2000||year>2100)return null;
  const date=new Date(Date.UTC(year,m-1,d));
  if(date.getUTCFullYear()!==year||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return null;
  return `${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function parseDateLine(line:string):string|null {
  // ISO-like yyyy-mm-dd, sometimes printed in English on slips.
  const iso=line.match(/(?:^|[^\d])(20\d{2}|25\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/u);
  if(iso){const value=formatDate(+iso[1],+iso[2],+iso[3]);if(value)return value;}
  const numeric=line.match(/(?:^|[^\d])(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?!\d)/u);
  if(numeric){const value=formatDate(+numeric[3],+numeric[2],+numeric[1]);if(value)return value;}
  const name=line.match(MONTH_RE);
  if(name){
    const before=line.slice(0,name.index);
    const after=line.slice((name.index||0)+name[0].length);
    const day=before.match(/(\d{1,2})\s*$/u);
    const year=after.match(/^\s*,?\s*(\d{2,4})(?!\d)/u);
    if(day&&year)return formatDate(+year[1],THAI_MONTHS.get(name[0].toLowerCase())||0,+day[1]);
  }
  return null;
}

function parseDate(lines:string[]):string|null {
  // Prefer a value near an explicit date label rather than a second date (e.g. expiry).
  const dateLabel=/(?:วันที่(?:ทำรายการ|โอน)?|date(?:\s*\/\s*time)?|transaction\s*date)/iu;
  for(let i=0;i<lines.length;i++){
    if(dateLabel.test(lines[i])){
      const same=parseDateLine(lines[i]);if(same)return same;
      const next=parseDateLine(lines[i+1]||'');if(next)return next;
    }
  }
  for(const line of lines){const value=parseDateLine(line);if(value)return value;}
  return null;
}

function parseRecipient(lines:string[]):string|null {
  const label=/^(?:ถึง|ผู้รับ(?:เงิน|โอน)?|โอนไปยัง|ร้านค้า|recipient|to|merchant)\s*[:：\-]?\s*(.+)$/iu;
  for(const line of lines){
    const match=line.match(label);
    if(!match)continue;
    const raw=match[1].replace(/(?:\b\d[\d\s*xX*\-]{6,}\b|\b\d{6,}\b).*/u,'').replace(/\s{2,}/g,' ').trim();
    if(/[\p{L}]/u.test(raw)&&raw.length>=2&&!/^(?:ธนาคาร|bank|account|บัญชี)$/iu.test(raw))return raw.slice(0,80);
  }
  return null;
}

export function parseSlipText(rawText:string):SlipFields {
  const lines=toAscii(rawText).split(/\r?\n/u).map(x=>x.trim()).filter(Boolean);
  const amountSatang=parseAmount(lines);
  const date=parseDate(lines);
  const recipient=parseRecipient(lines);
  const warnings:string[]=[];
  if(!lines.length)warnings.push('ไม่พบตัวอักษรในรูปภาพ ลองถ่ายใหม่ให้ชัดขึ้น');
  if(amountSatang===null)warnings.push('ไม่สามารถระบุยอดโอนได้อย่างมั่นใจ กรุณากรอกยอดเอง');
  if(date===null)warnings.push('อ่านวันที่ไม่ชัดเจน จะใช้วันที่ในฟอร์มเดิม');
  return {amountSatang,date,recipient,rawText,warnings};
}

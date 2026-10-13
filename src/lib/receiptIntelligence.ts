import {toSatang,type ReceiptDetails,type ReceiptItem} from './finance.js';
import type {ReceiptSource} from './receiptFormats';

type Rect={x0:number;y0:number;x1:number;y1:number};
type Fragment={text:string;rect:Rect};
const isRect=(v:unknown):v is Rect=>{
  if(!v||typeof v!=='object')return false;
  const b=v as Partial<Rect>;
  return [b.x0,b.y0,b.x1,b.y1].every(Number.isFinite);
};
/**
 * Rebuild visual rows from Tesseract word bounding boxes.
 * A price may be a separate OCR line or block from its item description.
 * Only text coordinates (not the screenshot) are retained transiently.
 */
export function receiptLayoutLines(blocks:unknown):string[]{
  if(!Array.isArray(blocks))return [];
  const fragments:Fragment[]=[];
  for(const block of blocks.slice(0,100)){
    if(!block||typeof block!=='object')continue;
    const paragraphs=(block as {paragraphs?:unknown}).paragraphs;
    if(!Array.isArray(paragraphs))continue;
    for(const paragraph of paragraphs.slice(0,100)){
      const lines=(paragraph as {lines?:unknown})?.lines;
      if(!Array.isArray(lines))continue;
      for(const line of lines.slice(0,150)){
        const words=(line as {words?:unknown})?.words;
        if(!Array.isArray(words))continue;
        for(const word of words.slice(0,100)){
          const w=word as {text?:unknown;bbox?:unknown};
          if(typeof w.text==='string'&&w.text.trim()&&isRect(w.bbox))
            fragments.push({text:w.text.trim().slice(0,160),rect:w.bbox});
          if(fragments.length>2500)break;
        }
      }
    }
  }
  if(!fragments.length)return [];
  fragments.sort((a,b)=>(a.rect.y0+a.rect.y1)/2-(b.rect.y0+b.rect.y1)/2||a.rect.x0-b.rect.x0);
  const rows:{y:number;height:number;tokens:Fragment[]}[]=[];
  for(const item of fragments){
    const y=(item.rect.y0+item.rect.y1)/2,h=Math.max(1,item.rect.y1-item.rect.y0);
    // Avoid merging two tightly packed receipt rows.
    const row=rows.find(r=>Math.abs(r.y-y)<=Math.min(7,Math.max(3,Math.min(h,r.height)*0.32)));
    if(row){row.tokens.push(item);row.y=(row.y*(row.tokens.length-1)+y)/row.tokens.length;}
    else rows.push({y,height:h,tokens:[item]});
  }
  return rows.sort((a,b)=>a.y-b.y).map(row=>row.tokens.sort((a,b)=>a.rect.x0-b.rect.x0)
    .map(t=>t.text).join(' ').replace(/\s+/gu,' ').trim()).filter(Boolean).slice(0,300);
}

const moneyValue=(text:string):number|null=>{
  const normalized=text.replace(/^[−–-]/u,'').replace(/บาท|THB|฿/giu,'').replace(/,/gu,'').trim();
  if(!/^\d{1,7}(?:\.\d{1,2})?$/u.test(normalized))return null;
  if(/^0+(?:\.0{1,2})?$/u.test(normalized))return 0;
  return toSatang(normalized);
};
const endingAmount=(text:string):number|null=>{
  const m=text.match(/(?:^|\s|:)([−–-]?(?:\d{1,3}(?:,\d{3})+|\d{1,7})(?:\.\d{1,2})?)\s*(?:บาท)?\s*$/iu);
  return m?moneyValue(m[1]):null;
};
const currencyLabel=(lines:string[],pattern:RegExp)=>{
  const values=new Set<number>();
  for(let i=0;i<lines.length;i++){
    if(!pattern.test(lines[i]))continue;
    let amount=endingAmount(lines[i]);
    if(amount===null&&i+1<lines.length)amount=moneyValue(lines[i+1].replace(/\s*บาท\s*$/u,''));
    if(amount!==null)values.add(amount);
  }
  return values.size===1?[...values][0]:undefined;
};
const itemLine=(line:string):ReceiptItem|null=>{
  const m=line.match(/^\s*(\d{1,3})\s+(.+?)\s+((?:\d{1,3}(?:,\d{3})+|\d{1,7})\.\d{2})\s*(?:บาท)?\s*$/u);
  if(!m)return null;
  const quantity=Number(m[1]),name=m[2].replace(/\s+/gu,' ').trim(),lineTotalSatang=moneyValue(m[3]);
  if(!lineTotalSatang||!Number.isInteger(quantity)||quantity<1||quantity>999||name.length<2||name.length>160)return null;
  if(/(?:รายการ|ยอด|สุทธิ|ส่วนลด|ชำระ|ทรูวอลเล็ต|จำนวน|สินค้า\s*ทั้งหมด)/iu.test(name))return null;
  const unitPriceSatang=lineTotalSatang%quantity===0?lineTotalSatang/quantity:undefined;
  return {name,quantity,lineTotalSatang,...(unitPriceSatang!==undefined?{unitPriceSatang}:{})};
};
function parse7Items(lines:string[]):ReceiptItem[]{
  const start=lines.findIndex(s=>/รายการ\s*สินค้า|items\s*(?:list|details)?/iu.test(s));
  if(start<0)return [];
  const stop=/(?:ยอด\s*สุทธิ|ยอด\s*รวม|รวม\s*ทั้งสิ้น|ชำระ|เงินสด|ทรู\s*วอลเล็ต|true\s*wallet|7\s*app|TID#|R#|รหัส\s*อ้างอิง|เลขที่\s*ใบเสร็จ)/iu;
  const items:ReceiptItem[]=[];
  for(const line of lines.slice(start+1,start+101)){
    if(stop.test(line))break;
    const item=itemLine(line);
    if(item)items.push(item);
  }
  return items.slice(0,100);
}
const itemCount=(lines:string[])=>{
  const line=lines.find(s=>/(?:ยอด\s*สุทธิ|ยอด\s*รวม|รวม\s*ทั้งสิ้น)/iu.test(s));
  const count=line?.match(/(?:ยอด\s*สุทธิ|ยอด\s*รวม|รวม\s*ทั้งสิ้น)\s+(\d{1,3})\s*(?:ชิ้น|รายการ)/iu);
  return count?Number(count[1]):undefined;
};
function receiptReference(lines:string[],source:ReceiptSource):string|undefined{
  const labelled=source==='seven_eleven'
    ? /(?:^|\s)(?:TID#|R#|เลขที่(?:ใบเสร็จ|รายการ)|receipt\s*(?:no|id)|order\s*id)\s*[:#]?\s*([a-z0-9_-]{6,100})/iu
    : /(?:รหัส\s*อ้างอิง|เลขที่\s*รายการ|reference(?:\s*no)?)[\s:：#]*([a-z0-9_-]{8,100})/iu;
  for(const line of lines){
    const found=line.match(labelled);
    if(found)return found[1].slice(0,100);
  }
  return undefined;
}

/** Derive an optional but structured receipt payload. Do not record the item sum
 * as a second payment: the transaction's amount is exclusively actual paid. */
export function readReceiptDetails(
  source:ReceiptSource,
  rawLines:string[],
  paidSatang:number|null,
  layoutLines:string[]=[],
  storeName?:string|null,
):ReceiptDetails|null {
  if(paidSatang===null||paidSatang<=0)return null;
  const lines=rawLines.map(x=>x.trim()).filter(Boolean);
  const layout=layoutLines.map(x=>x.trim()).filter(Boolean);
  const itemsFromText=source==='seven_eleven'?parse7Items(lines):[];
  const itemsFromLayout=source==='seven_eleven'?parse7Items(layout):[];
  const items=itemsFromLayout.length>itemsFromText.length?itemsFromLayout:itemsFromText;
  const count=itemCount(lines)??itemCount(layout);
  const detectedSection=lines.some(s=>/รายการ\s*สินค้า/iu.test(s))||layout.some(s=>/รายการ\s*สินค้า/iu.test(s));
  const itemSum=items.reduce((sum,item)=>sum+item.lineTotalSatang,0);
  const subtotalSatang=source==='paotang'
    ?currencyLabel(lines,/(?:ค่า\s*สินค้า\s*\/\s*บริการ|สินค้า\s*\/\s*บริการ|gross\s*(?:price|total))/iu)
    :currencyLabel(lines,/(?:ยอด\s*สุทธิ|ยอด\s*รวม(?:ทั้งสิ้น)?|รวม\s*ทั้งสิ้น|net\s*total)/iu);
  const discountSatang=currencyLabel(lines,/(?:ส่วน\s*ลด|discount)/iu);
  const subsidySatang=currencyLabel(lines,/(?:สิทธิ(?:ไทยช่วยไทย|คนละครึ่ง)|รัฐบาล\s*ช่วย|เงินสนับสนุน|subsidy)/iu);
  const feeSatang=currencyLabel(lines,/(?:ค่า\s*ธรรมเนียม|fee)/iu);
  const completeByValue=items.length>0&&(
    (subtotalSatang!==undefined&&itemSum===subtotalSatang)||
    (subtotalSatang===undefined&&itemSum===paidSatang)
  );
  const itemsComplete=!detectedSection||(
    completeByValue&&(count===undefined||items.reduce((sum,item)=>sum+item.quantity,0)===count)
  );
  // No source photo, masked account numbers or raw OCR are persisted.
  return {
    source,
    ...(receiptReference(lines,source)?{receiptId:receiptReference(lines,source)}:{}),
    ...(storeName?{storeName:storeName.slice(0,160)}:{}),
    items,
    ...(subtotalSatang!==undefined?{subtotalSatang}:{}),
    ...(discountSatang!==undefined?{discountSatang}:{}),
    ...(subsidySatang!==undefined?{subsidySatang}:{}),
    ...(feeSatang!==undefined?{feeSatang}:{}),
    paidSatang,itemsComplete,
  };
}

/** Block auto-save on contradictory money equations; keep partial nonitem receipts
 * allowed if total paid is definite and no explicit item section is present. */
export function receiptReconciliationError(receipt:ReceiptDetails):string|null{
  if(!receipt.itemsComplete)return 'อ่านรายการสินค้าในบิลไม่ครบหรือรวมราคาไม่ตรง กรุณาใช้รูปที่ชัดขึ้น';
  const {subtotalSatang,discountSatang=0,subsidySatang=0,feeSatang=0,paidSatang}=receipt;
  if(subtotalSatang!==undefined){
    const computed=subtotalSatang-discountSatang-subsidySatang+feeSatang;
    if(computed!==paidSatang)return 'ยอดก่อนส่วนลด หักส่วนลด/สิทธิ และยอดที่จ่ายจริงไม่ตรงกัน จึงยังไม่บันทึก';
  }
  return null;
}

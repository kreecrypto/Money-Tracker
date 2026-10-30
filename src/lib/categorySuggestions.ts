import type {Transaction} from './finance';
import {accountantBucketFor} from './accountantAudit';

export type CategorySuggestion = {category:Transaction['category']; reason:string};

/** Conservative local-only classification. Unknown transfers remain unknown. */
export function suggestCategory(item:Transaction):CategorySuggestion|null {
  if(item.type!=='expense'||item.category!=='อื่น ๆ'||accountantBucketFor(item)==='walletTopups')
    return null;

  const explicit=item.note.match(/หมวดย่อย:\s*([^\n|]+)/u)?.[1]?.trim()||'';
  const groups:readonly [string,RegExp][]=[
    ['ผ่อนชำระ/หนี้',/^(?:ชำระบัตรเครดิต|ชำระหนี้|ผ่อนบ้าน|ค่างวดสินเชื่อ)/iu],
    ['อาหารและเครื่องดื่ม',/^(?:อาหาร|ร้านอาหาร|กาแฟ|เครื่องดื่ม|ของกิน)/iu],
    ['เดินทาง',/^(?:เดินทาง|รถไฟฟ้า|BTS|MRT|ทางด่วน|ค่าน้ำมัน|ค่าโดยสาร)/iu],
    ['ช้อปปิ้ง',/^(?:ช้อปปิ้ง|ซื้อสินค้า|สินค้าอุปโภค)/iu],
    ['บ้านและค่าน้ำไฟ',/^(?:ค่าไฟ|ค่าน้ำ|ค่าเช่า|อินเทอร์เน็ตบ้าน)/iu],
    ['สุขภาพ',/^(?:สุขภาพ|โรงพยาบาล|คลินิก|ค่ารักษา)/iu],
    ['บันเทิง',/^(?:บันเทิง|ดูหนัง|สตรีมมิง)/iu],
    ['การศึกษา',/^(?:การศึกษา|ค่าเทอม|ค่าเรียน)/iu],
  ];
  if(explicit&&!/ไม่ระบุ|ไม่ทราบ|โอนให้บุคคล|โอนระหว่างบัญชี|โอนบัญชีตัวเอง/u.test(explicit)){
    for(const [category,pattern] of groups)
      if(pattern.test(explicit))return {category,reason:'หมวดย่อยระบุว่า '+explicit};
  }

  // Use only distinctive merchant/service evidence, not generic personal names.
  const payee=[item.recipient||'',item.receipt?.storeName||''].join(' ');
  const merchants:readonly [string,RegExp,string][]=[
    ['อาหารและเครื่องดื่ม',/\b(?:grabfood|foodpanda|starbucks|mcdonald'?s|kfc)\b|(?:ร้านกาแฟ|ร้านอาหาร|ก๋วยเตี๋ยว)/iu,'ร้านอาหารหรือบริการสั่งอาหาร'],
    ['ช้อปปิ้ง',/\b(?:shopee|lazada)\b/iu,'แพลตฟอร์มซื้อสินค้า'],
    ['เดินทาง',/\b(?:grabcar|grabbike|bts|mrt)\b|(?:รถไฟฟ้า|ทางด่วน)/iu,'บริการเดินทาง'],
    ['บ้านและค่าน้ำไฟ',/(?:การไฟฟ้า|การประปา|ค่าน้ำประปา)/iu,'หน่วยงานสาธารณูปโภค'],
    ['สุขภาพ',/(?:โรงพยาบาล|คลินิก|ร้านขายยา)/iu,'สถานพยาบาลหรือร้านยา'],
    ['บันเทิง',/\b(?:netflix|spotify)\b/iu,'บริการความบันเทิง'],
    ['การศึกษา',/(?:โรงเรียน|มหาวิทยาลัย)/iu,'สถานศึกษา'],
  ];
  // A bank transfer with a bill/top-up purpose can be a different category.
  if(/เติมเงิน|top[ -]?up|ชำระบิล|bill payment|refund|โอนระหว่างบัญชี/iu.test(item.note))
    return null;
  for(const [category,pattern,reason] of merchants)
    if(pattern.test(payee))return {category,reason};
  return null;
}

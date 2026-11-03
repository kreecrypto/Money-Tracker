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
    ['ของใช้ประจำวัน',/^(?:ของใช้ประจำวัน|น้ำยาทำความสะอาด|กระดาษทิชชู)/iu],
    ['รถยนต์และยานพาหนะ',/^(?:เติมน้ำมัน|ค่าน้ำมัน|ค่าซ่อมรถ|ค่าจอดรถ|ค่าทางด่วนที่ใช้จริง)/iu],
    ['โทรศัพท์และอินเทอร์เน็ต',/^(?:ค่า(?:โทรศัพท์|มือถือ|อินเทอร์เน็ต)|อินเทอร์เน็ตบ้าน|บริการสื่อสาร|AIS)/iu],
    ['ประกันภัย',/^(?:ประกันภัย|ประกันรถ|ประกันชีวิต|เบี้ยประกัน|พ\.ร\.บ\.?)/iu],
    ['ครอบครัวและสังคม',/^(?:ของขวัญ|บริจาค|เลี้ยงสังสรรค์)/iu],
    ['ค่าธรรมเนียมและดอกเบี้ย',/^(?:ค่าธรรมเนียม|ดอกเบี้ย|ค่าปรับ)/iu],
    ['เดินทาง',/^(?:เดินทาง|รถไฟฟ้า|BTS|MRT|ทางด่วน|ค่าโดยสาร)/iu],
    ['ช้อปปิ้ง',/^(?:ช้อปปิ้ง|เสื้อผ้า|รองเท้า|เครื่องสำอาง|สินค้าแฟชั่น)/iu],
    ['บ้านและค่าน้ำไฟ',/^(?:ค่าไฟ|ค่าน้ำ|ค่าเช่า)/iu],
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
    ['เดินทาง',/\b(?:grabcar|grabbike|bts|mrt)\b|(?:รถไฟฟ้า|ทางด่วน)/iu,'บริการเดินทาง'],
    ['บ้านและค่าน้ำไฟ',/(?:การไฟฟ้า|การประปา|ค่าน้ำประปา)/iu,'หน่วยงานสาธารณูปโภค'],
    ['โทรศัพท์และอินเทอร์เน็ต',/\b(?:AIS|DTAC)\b|(?:เอไอเอส|ทรูมูฟ)/iu,'ผู้ให้บริการสื่อสาร'],
    ['ประกันภัย',/(?:บริษัท\s*กลางคุ้มครองผู้ประสบภัยจากรถ)/iu,'ผู้รับเบี้ยประกันภัย'],
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

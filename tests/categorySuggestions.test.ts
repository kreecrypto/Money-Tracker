import {describe,expect,it} from 'vitest';
import {suggestCategory} from '../src/lib/categorySuggestions';
import type {Transaction} from '../src/lib/finance';

const tx=(patch:Partial<Transaction>={}):Transaction=>({
  id:'case',type:'expense',category:'อื่น ๆ',amountSatang:12550,
  date:'2026-10-30',time:'12:30',recipient:'บุคคลทั่วไป',
  method:'bank',note:'',createdAt:1,...patch
});
describe('conservative local category suggestions',()=>{
  it('recognizes explicit subcategory while leaving the source unchanged',()=>{
    const item=tx({note:'หมวดย่อย: อาหาร/ร้านอาหาร\nเลขอ้างอิง: ABC123'});
    const before=JSON.stringify(item);
    expect(suggestCategory(item)).toEqual({category:'อาหารและเครื่องดื่ม',reason:'หมวดย่อยระบุว่า อาหาร/ร้านอาหาร'});
    expect(JSON.stringify(item)).toBe(before);
  });
  it('recognizes high-signal merchants without guessing generic retailers',()=>{
    expect(suggestCategory(tx({recipient:'GrabFood'}))?.category).toBe('อาหารและเครื่องดื่ม');
    expect(suggestCategory(tx({recipient:'Shopee Thailand'}))).toBeNull();
    expect(suggestCategory(tx({recipient:'Lazada'}))).toBeNull();
    expect(suggestCategory(tx({recipient:'HomePro'}))).toBeNull();
    expect(suggestCategory(tx({recipient:'PTT'}))).toBeNull();
    expect(suggestCategory(tx({recipient:'การไฟฟ้านครหลวง'}))?.category).toBe('บ้านและค่าน้ำไฟ');
    expect(suggestCategory(tx({recipient:'Netflix'}))?.category).toBe('บันเทิง');
    expect(suggestCategory(tx({recipient:'7-Eleven'}))).toBeNull();
  });
  it('recognizes explicit goods and service subcategories, without guessing generic stores',()=>{
    expect(suggestCategory(tx({note:'หมวดย่อย: ค่าโทรศัพท์ AIS'}))?.category).toBe('โทรศัพท์และอินเทอร์เน็ต');
    expect(suggestCategory(tx({note:'หมวดย่อย: เบี้ยประกันรถ'}))?.category).toBe('ประกันภัย');
    expect(suggestCategory(tx({note:'หมวดย่อย: ค่าน้ำมัน'}))?.category).toBe('รถยนต์และยานพาหนะ');
    expect(suggestCategory(tx({note:'หมวดย่อย: น้ำยาทำความสะอาด'}))?.category).toBe('ของใช้ประจำวัน');
    expect(suggestCategory(tx({note:'หมวดย่อย: ดอกเบี้ย'}))?.category).toBe('ค่าธรรมเนียมและดอกเบี้ย');
    expect(suggestCategory(tx({note:'หมวดย่อย: ซื้อสินค้า',recipient:'Lazada'}))).toBeNull();
  });
  it('never overwrites existing categorized expenses or income',()=>{
    expect(suggestCategory(tx({category:'เดินทาง',recipient:'GrabFood'}))).toBeNull();
    expect(suggestCategory(tx({type:'income',category:'อื่น ๆ',note:'หมวดย่อย: อาหาร'}))).toBeNull();
  });
  it('does not turn wallet funding into food, shopping or ordinary spending',()=>{
    expect(suggestCategory(tx({recipient:'Shopee',note:'เติมเงิน Wallet'}))).toBeNull();
    expect(suggestCategory(tx({recipient:'BTS',note:'หมวดย่อย: เติมเงิน Easy Pass'}))).toBeNull();
    expect(suggestCategory(tx({recipient:'Netflix',note:'top-up'}))).toBeNull();
  });
  it('leaves personal transfers, ambiguous notes and recipient names for manual review',()=>{
    expect(suggestCategory(tx({recipient:'นายสมชาย ใจดี'}))).toBeNull();
    expect(suggestCategory(tx({note:'หมวดย่อย: โอนให้บุคคล/วัตถุประสงค์ไม่ระบุ'}))).toBeNull();
    expect(suggestCategory(tx({note:'ชำระบิล',recipient:'Shopee'}))).toBeNull();
    expect(suggestCategory(tx({note:'หมวดย่อย: ไม่ทราบวัตถุประสงค์',recipient:'นายสมชาย'}))).toBeNull();
    expect(suggestCategory(tx({note:'หมวดย่อย: ไม่ทราบสินค้า',recipient:'Netflix'}))).toBeNull();
  });
  it('never guesses from the amount, date, or note about a merchant alone',()=>{
    expect(suggestCategory(tx({amountSatang:12345,note:'โอนเงินเรียบร้อย'}))).toBeNull();
    expect(suggestCategory(tx({recipient:'บัญชีของตัวเอง',note:'โอนระหว่างบัญชี'}))).toBeNull();
  });
});

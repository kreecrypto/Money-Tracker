import {describe,expect,it} from 'vitest';
import {parseSlipText,needsSlipOcrRecovery,inferSlipDirection} from '../src/lib/slip';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';

/**
 * Ten privacy-safe, synthetic OCR fixtures based on the *layouts* of K PLUS
 * screenshots. No original screenshots, real account numbers, real personal
 * names, or actual transaction references are committed to this public repo.
 */
const samples=[
  {title:'โอนเงินสำเร็จ',when:'13 ต.ค. 69 18:42 น.',payee:['นาง ผู้รับ ตัวอย่างหนึ่ง','รหัสพร้อมเพย์','xxx-xxx-1234'],name:'นาง ผู้รับ ตัวอย่างหนึ่ง',amount:'41.00',money:4100},
  {title:'โอนเงินสำเร็จ',when:'13 ต.ค. 69 18:31 น.',payee:['นาย ผู้รับ ตัวอย่างสอง','รหัสพร้อมเพย์','x-xxxx-xxxx1-23-4'],name:'นาย ผู้รับ ตัวอย่างสอง',amount:'67.00',money:6700},
  {title:'จ่ายบิลสำเร็จ',when:'13 ต.ค. 69 14:26 น.',payee:['HOME PRODUCT','CENTER PCL.','0000002201519535','SAMPLE-BILL-REF'],name:'HOME PRODUCT CENTER PCL.',amount:'279.07',money:27907},
  {title:'ชำระเงินสำเร็จ',when:'13 ต.ค. 69 14:05 น.',payee:['เดอะเรสเตอรองท์ กรุ๊ป','เมกาบางนา','บจก. เดอะเรสเตอรองท์ กรุ๊ป','202610131522012'],name:'เดอะเรสเตอรองท์ กรุ๊ป เมกาบางนา บจก. เดอะเรสเตอรองท์ กรุ๊ป',amount:'1,309.82',money:130982},
  {title:'โอนเงินสำเร็จ',when:'12 ต.ค. 69 18:18 น.',payee:['น.ส. ผู้รับ ตัวอย่างสาม','ธ.กสิกรไทย','xxx-x-x1234-x'],name:'น.ส. ผู้รับ ตัวอย่างสาม',amount:'42.00',money:4200},
  {title:'จ่ายบิลสำเร็จ',when:'12 ต.ค. 69 18:16 น.',payee:['ร้านค้าออมสิน มหาเฮง (โจ๊ก','เดอะมั่ง)','08386910016000120324','MHG10000'],name:'ร้านค้าออมสิน มหาเฮง (โจ๊ก เดอะมั่ง)',amount:'53.00',money:5300},
  {title:'จ่ายบิลสำเร็จ',when:'12 ต.ค. 69 16:42 น.',payee:['SCB มณี SHOP (ไก่ย่าง)','014000008389140','SCB'],name:'SCB มณี SHOP (ไก่ย่าง)',amount:'49.00',money:4900},
  {title:'จ่ายบิลสำเร็จ',when:'12 ต.ค. 69 17:28 น.',payee:['บริษัท กรีน โพรพัลชั่น จำกัด','REF001','0'],name:'บริษัท กรีน โพรพัลชั่น จำกัด',amount:'91.00',money:9100},
  {title:'จ่ายบิลสำเร็จ',when:'12 ต.ค. 69 13:15 น.',payee:['SYNPHAET BANGNA','CO.,LTD.','0000002206186967','SAMPLE-BILL-REF'],name:'SYNPHAET BANGNA CO.,LTD.',amount:'2,949.00',money:294900},
  {title:'ชำระเงินสำเร็จ',when:'11 ต.ค. 69 23:27 น.',payee:['SHOPEEPAY','20261011002145246495','20261011002145246495'],name:'SHOPEEPAY',amount:'359.00',money:35900},
] as const;

function textFor(sample:typeof samples[number],index:number){
  const reference='TESTREF202610'+String(index+1).padStart(6,'0');
  return {
    reference,
    text:[
      sample.title,sample.when,'นาย ตัวอย่าง ผู้จ่าย','ธ.กสิกรไทย','xxx-x-x0000-x',
      ...sample.payee,'จำนวน:',sample.amount+' บาท',
      'ค่าธรรมเนียม:','0.00 บาท','เลขที่รายการ:',reference,
      'สแกน','ตรวจสอบสลิป',
    ].join('\n'),
  };
}
describe('K PLUS privacy-safe layout regressions',()=>{
  it.each(samples.map((sample,index)=>({sample,index})))(
    'parses sender-side K PLUS layout $index ($sample.title)',
    ({sample,index})=>{
      const {text,reference}=textFor(sample,index);
      const result=parseSlipText(text);
      expect(result).toMatchObject({
        amountSatang:sample.money,
        date:sample.when.startsWith('11')?'2026-10-11':
          sample.when.startsWith('12')?'2026-10-12':'2026-10-13',
        time:sample.when.match(/\d\d:\d\d/u)?.[0],
        recipient:sample.name,
        direction:'expense',
        method:undefined,
      });
      expect(result.receipt).toMatchObject({
        source:'kplus',paidSatang:sample.money,
        receiptId:reference,items:[],itemsComplete:true,
      });
      expect(needsSlipOcrRecovery(result)).toBe(false);
      const ready=prepareAutoSlip(result,[],'test-'+index,Date.now());
      expect(ready.status).toBe('ready');
    }
  );

  it('blocks a second upload of the same transaction reference, regardless of image hash',()=>{
    const {text}=textFor(samples[0],0);
    const first=parseSlipText(text);
    const saved=prepareAutoSlip(first,[],'first',Date.now());
    expect(saved.status).toBe('ready');
    if(saved.status!=='ready')return;
    const second=parseSlipText(text);
    second.imageHash='b'.repeat(64);
    expect(prepareAutoSlip(second,[saved.transaction],'second',Date.now()).status).toBe('duplicate');
  });
  it('still leaves unrelated generic transfers unclassified',()=>{
    expect(inferSlipDirection('โอนเงินสำเร็จ\nถึง ร้านตัวอย่าง\nจำนวนเงิน 40.00 บาท').direction).toBeNull();
  });
  it('never confuses payer with recipient if masked sender account is missing',()=>{
    const result=parseSlipText('จ่ายบิลสำเร็จ\n13 ต.ค. 69 18:42 น.\nนาย ตัวอย่าง ผู้จ่าย\nธ.กสิกรไทย\nจำนวน:\n88.00 บาท\nเลขที่รายการ: TESTREF202610999999');
    expect(result.recipient).toBeNull();
  });
  it('does not use fee or QR caption as paid amount when main amount was not read',()=>{
    const result=parseSlipText('จ่ายบิลสำเร็จ\n13 ต.ค. 69 18:42 น.\nธ.กสิกรไทย\nxxx-x-x0000-x\nSHOPEEPAY\nจำนวน:\nอ่านไม่ชัด\nค่าธรรมเนียม: 0.00 บาท\nสแกนตรวจสอบสลิป');
    expect(result.amountSatang).toBeNull();
    expect(prepareAutoSlip(result,[],'unreadable',Date.now()).status).toBe('incomplete');
  });
});

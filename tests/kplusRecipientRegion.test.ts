import {describe,expect,it} from 'vitest';
import {parseKPlusRecipientRegion,parseKPlusSlip} from '../src/lib/kplus';
import {findKPlusRecipientCrop} from '../src/lib/slipImage';
import {parseSlipText} from '../src/lib/slip';

/**
 * Entirely fabricated names/account IDs. Regressions cover visual structures
 * of multiple K PLUS October 2026 slips; never commit real banking screenshots.
 */
describe('K PLUS recipient-focused OCR',()=>{
  it.each([
    ['merchant + legal company','BIGMART NAKHONSAWAN\nบมจ. บิ๊กมาร์ท ซูเปอร์เซ็นเตอร์\n202610170000001','BIGMART NAKHONSAWAN บมจ. บิ๊กมาร์ท ซูเปอร์เซ็นเตอร์'],
    ['PromptPay person','นาย ตัวอย่าง สุขใจ\nรหัสพร้อมเพย์\nx-xxxx-xxxx3-08-4','นาย ตัวอย่าง สุขใจ'],
    ['PromptPay bank account','น.ส. ตัวอย่าง ปาลวัฒน์\nธ.กสิกรไทย\nxxx-x-x0000-x','น.ส. ตัวอย่าง ปาลวัฒน์'],
    ['QR merchant in two rows','LINE Pay Merchant (QR\nby ttb)\nLPM20000000000123456','LINE Pay Merchant (QR by ttb)'],
    ['merchant ending with a year','ปตท. เอเชียตัวอย่าง (2528)\nนาย ผู้ประกอบการ ตัวอย่าง\n202610160000001','ปตท. เอเชียตัวอย่าง (2528) นาย ผู้ประกอบการ ตัวอย่าง'],
    ['watermark before payee','THAILAND 2026\nไทยพร้อมเป็นเจ้าภาพ\nนาย ตัวอย่าง ธนากร\nรหัสพร้อมเพย์','นาย ตัวอย่าง ธนากร'],
    ['watermark beside payee','นาย ตัวอย่าง ธนากร THAILAND 2026\nรหัสพร้อมเพย์','นาย ตัวอย่าง ธนากร'],
  ] as const)('parses %s',(_kind,ocr,recipient)=>{
    expect(parseKPlusRecipientRegion(ocr)).toBe(recipient);
  });

  it('refuses promotional artwork, accounts and fees as payees',()=>{
    for(const text of [
      'THAILAND 2026\nไทยพร้อมเป็นเจ้าภาพ',
      'ธ.กสิกรไทย\nxxx-x-x0000-x\nจำนวน: 40.00 บาท',
      'สแกนตรวจสอบสลิป\nค่าธรรมเนียม: 0.00 บาท',
    ])expect(parseKPlusRecipientRegion(text)).toBeNull();
  });

  it('skips K PLUS artwork when parsing full-page transfer OCR',()=>{
    const source=[
      'โอนเงินสำเร็จ','17 ต.ค. 69 08:15 น.','นาย ตัวอย่าง ผู้ส่ง',
      'ธ.กสิกรไทย','xxx-x-x0000-x','THAILAND 2026','ไทยพร้อมเป็นเจ้าภาพ',
      'นาย ตัวอย่าง ผู้รับ','รหัสพร้อมเพย์','xxx-xxx-1234',
      'จำนวน:','30.00 บาท','เลขที่รายการ: TESTRECIP20261017001',
    ];
    expect(parseKPlusSlip(source)?.recipient).toBe('นาย ตัวอย่าง ผู้รับ');
  });

  it('falls back to spatial K PLUS rows when unlabelled recipient disappears from raw OCR order',()=>{
    const raw=['โอนเงินสำเร็จ','17 ต.ค. 69 08:15 น.','นาย ตัวอย่าง ผู้ส่ง',
      'ธ.กสิกรไทย','xxx-x-x0000-x','จำนวน:','30.00 บาท'].join('\n');
    const spatial=['โอนเงินสำเร็จ','17 ต.ค. 69 08:15 น.','นาย ตัวอย่าง ผู้ส่ง',
      'ธ.กสิกรไทย','xxx-x-x0000-x','นาย ตัวอย่าง ผู้รับ',
      'รหัสพร้อมเพย์','xxx-xxx-1234','จำนวน:','30.00 บาท'];
    const parsed=parseSlipText(raw,spatial);
    expect(parsed).toMatchObject({recipient:'นาย ตัวอย่าง ผู้รับ',amountSatang:3000,direction:'expense'});
  });
});

const row=(text:string,x0:number,y0:number,x1:number,y1:number)=>({
  words:[{text,bbox:{x0,y0,x1,y1}}],
});
const blocks=(withSecondAccount=false)=>[{
  paragraphs:[{lines:[
    row('xxx-x-x0000-x',192,455,402,482),
    ...(withSecondAccount?[row('xxx-x-x1111-x',195,685,419,714)]:[]),
    row('จำนวน:',60,865,165,910),
  ]}],
}];

describe('K PLUS recipient geometry is anchored, not a hardcoded vertical guess',()=>{
  it('returns the beneficiary region without the promotional right column',()=>{
    const crop=findKPlusRecipientCrop(blocks(),1080,1400);
    expect(crop).not.toBeNull();
    expect(crop!.x).toBeGreaterThan(0);
    expect(crop!.x+crop!.width).toBeLessThanOrEqual(1080*.73);
    expect(crop!.y).toBeGreaterThan(482);
    expect(crop!.y+crop!.height).toBeLessThan(865);
  });
  it('chooses sender account even when payee also has a masked account',()=>{
    const crop=findKPlusRecipientCrop(blocks(true),1080,1400);
    expect(crop).not.toBeNull();
    expect(crop!.y).toBeLessThan(530);
  });
  it('does not crop without a trustworthy account and payment boundary',()=>{
    expect(findKPlusRecipientCrop([],1080,1400)).toBeNull();
    expect(findKPlusRecipientCrop([{paragraphs:[{lines:[row('จำนวน:',60,865,165,910)]}]}],1080,1400)).toBeNull();
    expect(findKPlusRecipientCrop([{paragraphs:[{lines:[row('xxx-x-x0000-x',192,455,402,482)]}]}],1080,1400)).toBeNull();
  });
});

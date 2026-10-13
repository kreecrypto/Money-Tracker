import {describe,expect,it} from 'vitest';
import {correctionDirection,isWalletFundingSlip,shouldWarnBeforeLeaving,slipBatchHeading,pendingReviewCount} from '../src/lib/slipReview';
import {summarizeSlipBatch} from '../src/lib/slipBatch';
import {parseSlipText} from '../src/lib/slip';

/** UX safety regressions for the "upload -> OCR -> auto-save / needs review" path. */
describe('slip review UX safety',()=>{
  it('never preselects an expense if a receipt has no reliable direction',()=>{
    expect(correctionDirection({direction:null})).toBe('');
    expect(correctionDirection({direction:'income'})).toBe('income');
    expect(correctionDirection({direction:'expense'})).toBe('expense');
  });
  it('identifies wallet funding for a deliberate no-transaction option',()=>{
    const slip=parseSlipText([
      'เติมเงินสำเร็จ','11 ต.ค. 69 17:55 น.','ธ.กสิกรไทย',
      'xxx-x-x0000-x','พร้อมเพย์ อี-วอลเล็ต /','G-Wallet',
      'จำนวน:','150.00 บาท',
    ].join('\n'));
    expect(correctionDirection(slip)).toBe('');
    expect(isWalletFundingSlip(slip)).toBe(true);
    expect(isWalletFundingSlip({directionReason:'พบการจ่ายบิลสำเร็จ'})).toBe(false);
  });
  it('shows a warning headline rather than blanket success for partially completed batches',()=>{
    expect(slipBatchHeading({total:3,saved:1,incomplete:1,errors:1})).toContain('ยังต้องตรวจ 2');
    expect(slipBatchHeading({total:2,saved:0,incomplete:2,errors:0})).toContain('ยังมี 2 รูป');
    expect(slipBatchHeading({total:3,saved:3,incomplete:0,errors:0})).toContain('บันทึกสลิปสำเร็จ 3');
    expect(slipBatchHeading({total:1,saved:0,incomplete:0,errors:0})).toContain('ตรวจสลิปครบ');
  });
  it('supports excluding an internal transfer without counting it as spent or saved',()=>{
    const result=summarizeSlipBatch([
      {name:'funding',status:'excluded',reason:'โอนระหว่างบัญชีตัวเอง'},
      {name:'bank-pay',status:'saved',amountSatang:2500},
      {name:'unreadable',status:'incomplete'},
    ]);
    expect(result).toMatchObject({total:3,saved:1,incomplete:1,excluded:1});
    expect(pendingReviewCount(result)).toBe(1);
    expect(shouldWarnBeforeLeaving(result.incomplete)).toBe(true);
    expect(shouldWarnBeforeLeaving(0)).toBe(false);
  });
});

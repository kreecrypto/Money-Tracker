import {describe,expect,it} from 'vitest';
import {MAX_SLIP_BATCH_FILES,MAX_SLIP_FILE_BYTES,summarizeSlipBatch,savedSlipTotals,validateSlipImage} from '../src/lib/slipBatch';

describe('multi-image slip upload safety',()=>{
  it('accepts iPhone JPEG, PNG and WebP image input',()=>{
    for(const type of ['image/jpeg','image/png','image/webp'])
      expect(validateSlipImage({type,size:524_288})).toBeNull();
  });
  it('accepts iPhone HEIC for local decoding but rejects unsupported file types',()=>{
    expect(validateSlipImage({type:'image/heic',size:128_000})).toBeNull();
    expect(validateSlipImage({type:'application/pdf',size:100})).toContain('JPG');
  });
  it('blocks empty and oversized photos individually while allowing the batch to proceed',()=>{
    expect(validateSlipImage({type:'image/jpeg',size:0})).toContain('10 MB');
    expect(validateSlipImage({type:'image/jpeg',size:MAX_SLIP_FILE_BYTES+1})).toContain('10 MB');
    expect(validateSlipImage({type:'image/jpeg',size:MAX_SLIP_FILE_BYTES})).toBeNull();
  });
  it('limits a batch to 20 selected images for iPhone memory safety',()=>{
    expect(MAX_SLIP_BATCH_FILES).toBe(20);
  });
  it('counts saved, duplicate, incomplete, and failed images independently',()=>{
    const rows=[
      {name:'scan1.jpg',status:'saved' as const},
      {name:'scan2.jpg',status:'saved' as const},
      {name:'scan3.jpg',status:'duplicate' as const,reason:'already imported'},
      {name:'scan4.png',status:'incomplete' as const},
      {name:'scan5.heic',status:'error' as const},
    ];
    expect(summarizeSlipBatch(rows)).toEqual({
      total:5,saved:2,duplicate:1,incomplete:1,errors:1,queued:0,
    });
  });
  it('identifies pending drafts safely stored for later',()=>{
    expect(summarizeSlipBatch([{name:'a',status:'incomplete',pendingId:'pending-a'}]).queued).toBe(1);
  });
  it('shows separate saved income and expense rather than a misleading grand total',()=>{
    const rows=[
      {name:'incoming.jpg',status:'saved' as const,direction:'income' as const,amountSatang:10000},
      {name:'outgoing.jpg',status:'saved' as const,direction:'expense' as const,amountSatang:5000},
      {name:'review.jpg',status:'incomplete' as const,direction:'expense' as const,amountSatang:6000},
      {name:'duplicate.jpg',status:'duplicate' as const,direction:'income' as const,amountSatang:8000},
      {name:'legacy.jpg',status:'saved' as const,amountSatang:1200},
    ];
    expect(savedSlipTotals(rows)).toEqual({incomeSatang:10000,expenseSatang:5000,unknownSatang:1200});
    expect(savedSlipTotals([{name:'undone',status:'undone',direction:'expense',amountSatang:5000}])).toEqual({incomeSatang:0,expenseSatang:0,unknownSatang:0});
  });
  it('reports an empty batch without claiming any save',()=>{
    expect(summarizeSlipBatch([])).toEqual({
      total:0,saved:0,duplicate:0,incomplete:0,errors:0,queued:0,
    });
  });
});
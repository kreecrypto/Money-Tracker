import {describe,expect,it} from 'vitest';
import {potentialCrossChannelDuplicates} from '../src/lib/duplicateReview';
import type {Transaction} from '../src/lib/finance';
const existing:Transaction[]=[
  {id:'line-A',date:'2026-10-10',type:'expense',amountSatang:8900,method:'bank',category:'อื่น ๆ',note:'รับเงิน',createdAt:1},
  {id:'iphone-A',date:'2026-10-10',type:'income',amountSatang:50000,method:'bank',category:'อื่น ๆ',note:'โอนเข้าบัญชี',createdAt:2},
];
describe('cross-channel possible duplicate warning (no auto deletion)',()=>{
  it('matches LINE entries during iPhone financial review',()=>expect(potentialCrossChannelDuplicates({type:'expense',date:'2026-10-10',amountSatang:8900,method:'bank'},existing,'iphone').map(x=>x.id)).toEqual(['line-A']));
  it('matches iPhone entries for a new LINE transfer',()=>expect(potentialCrossChannelDuplicates({type:'income',date:'2026-10-10',amountSatang:50000,method:'bank'},existing,'line').map(x=>x.id)).toEqual(['iphone-A']));
  it('does not flag wrong type, date or amount',()=>expect(potentialCrossChannelDuplicates({type:'income',date:'2026-10-09',amountSatang:50000,method:'bank'},existing,'iphone')).toEqual([]));
  it('does not guess when direction or date is unknown',()=>expect(potentialCrossChannelDuplicates({type:null,date:'2026-10-10',amountSatang:8900,method:'bank'},existing,'iphone')).toEqual([]));
  it('does not mutate existing data',()=>{const copy=JSON.stringify(existing);potentialCrossChannelDuplicates({type:'expense',date:'2026-10-10',amountSatang:8900,method:'bank'},existing,'iphone');expect(JSON.stringify(existing)).toBe(copy);});
});

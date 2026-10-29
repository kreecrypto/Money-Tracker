import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,it,expect} from 'vitest';
import {matchesTransactionSearch} from '../src/lib/transactionSearch';
import StatusToast from '../src/StatusToast';
import type {Transaction} from '../src/lib/finance';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const fixture:Transaction={
  id:'a',type:'income',amountSatang:123400,date:'2026-10-29',time:'14:30',
  sender:'คุณ ชมพู่ ชื่นใจ',recipient:'เจ้าของบัญชี',category:'เงินคืน',note:'คืนเงิน',
  method:'bank',createdAt:1
};

describe('P1 Money Tracker UX regression',()=>{
  it('finds income by the same payer name displayed on Home and Transactions',()=>{
    expect(matchesTransactionSearch(fixture,'ชมพู่')).toBe(true);
    expect(matchesTransactionSearch(fixture,'  ชื่นใจ  ')).toBe(true);
    expect(matchesTransactionSearch(fixture,'เจ้าของบัญชี')).toBe(true);
    expect(matchesTransactionSearch(fixture,'โอน/ธนาคาร')).toBe(true);
    expect(matchesTransactionSearch(fixture,'ไม่ได้อยู่ในรายการ')).toBe(false);
    expect(matchesTransactionSearch({...fixture,type:'expense',recipient:'ร้านค้าทดสอบ'},'ร้านค้าทดสอบ')).toBe(true);
    expect(matchesTransactionSearch(fixture,'   ')).toBe(true);
  });
  it.each(['success','error','warning','info'] as const)('renders an accessible %s notification',tone=>{
    const markup=renderToStaticMarkup(createElement(StatusToast,{notice:{tone,message:'ทดสอบสถานะ'}}));
    expect(markup).toContain('toast--'+tone);
    expect(markup).toContain('ทดสอบสถานะ');
    expect(markup).toContain('role="'+(tone==='error'||tone==='warning'?'alert':'status')+'"');
    if(tone==='error')expect(markup).not.toContain('check-circle');
  });
  it('keeps financial hero palette in one theme, not competing calendar and mobile overrides',()=>{
    const theme=read('src/cute-kawaii-preview.css');
    const calendar=read('src/finance-calendar.css');
    const home=read('src/home-screen.css');
    expect(theme.match(/:root\s*\{/g)).toHaveLength(1);
    expect(theme).toContain('.mt-home-balance.mt-home-calendar-summary');
    expect(theme).toContain('color:#fff!important');
    expect(calendar).not.toMatch(/\.mt-home-screen \.mt-home-calendar-summary\s*\{\s*background/);
    expect(home).not.toContain('body:has(.mt-home-screen),.app-body:has(.mt-home-screen) {background:#fff!important;}');
    for(const tone of ['success','error','warning','info'])expect(theme).toContain('.toast.toast--'+tone);
  });
});

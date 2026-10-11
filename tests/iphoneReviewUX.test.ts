import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Draft} from '../src/IPhoneShortcutSettings';
import type {IPhoneDraft} from '../src/lib/iphoneSync';
import {createElement} from 'react';

const example:IPhoneDraft={
  id:'6d8626ce-fbbe-4f87-adb5-79c9bbd9a0a1',
  amountSatang:50000,type:null,date:null,category:'อื่น ๆ',note:'ทดสอบรับเงิน',
  method:'bank',source:'iPhone Photos',createdAt:'2026-10-10T10:00:00Z'
};
const render=(draft:IPhoneDraft=example)=>renderToStaticMarkup(
  createElement(Draft,{draft,onReviewed:async()=>{}})
);

describe('iPhone financial review — safe initial state',()=>{
  it('does not silently classify incoming or unknown slips as expenses',()=>{
    const html=render();
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html).toContain('ยืนยันประเภทเงิน');
    expect(html).toContain('เงินเข้า / รายรับ');
    expect(html).toContain('เงินออก / รายจ่าย');
    expect(html).not.toContain('selected expense');
  });
  it('does not silently use today when the scanned receipt has no date',()=>{
    const html=render();
    expect(html).toMatch(/type="date"[^>]*value=""/);
  });
  it('even an OCR-suggested incoming transfer requires deliberate confirmation',()=>{
    const html=render({...example,type:'income'});
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html).toContain('ระบบอ่านว่า เงินเข้า');
  });
});

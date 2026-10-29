import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import HomeScreen from '../src/HomeScreen';

describe('Home reference UX hierarchy',()=>{
  it('prioritizes financial briefing and upload ahead of optional calendar exploration',()=>{
    const markup=renderToStaticMarkup(createElement(HomeScreen,{
      month:'2026-10',
      monthLabel:'ตุลาคม 2569',
      net:0,
      income:0,
      expense:0,
      recent:[],
      onMonthChange:()=>{},
      onUpload:()=>{},
      onTransactions:()=>{},
      reportSlot:createElement('section',{'data-reference-briefing':true})
    }));
    const index=(marker:string)=>{
      const result=markup.indexOf(marker);
      expect(result,marker).toBeGreaterThan(-1);
      return result;
    };
    const overview=index('aria-label="ภาพรวมรายเดือน"');
    const briefing=index('data-reference-briefing');
    const upload=index('class="ref-home-upload');
    const recent=index('aria-label="รายการล่าสุด"');
    const calendar=index('aria-label="ปฏิทินรายรับรายจ่าย"');
    const chosenDay=index('aria-label="รายการวันที่เลือก"');

    expect(overview).toBeLessThan(briefing);
    expect(briefing).toBeLessThan(upload);
    expect(upload).toBeLessThan(recent);
    expect(recent).toBeLessThan(calendar);
    expect(calendar).toBeLessThan(chosenDay);
    expect(markup).toContain('สลิป K PLUS หรือใบเสร็จ · เลือกได้หลายรูป');
    expect(markup).toContain('ยังไม่มีรายการในวันที่เลือก');
  });
});

import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import HomeScreen from '../src/HomeScreen';
import {todayLocal,type Transaction} from '../src/lib/finance';

describe('Home reference UX hierarchy',()=>{
  it('puts calendar and selected-day details ahead of the monthly overview and actions',()=>{
    const markup=renderToStaticMarkup(createElement(HomeScreen,{
      month:'2026-10',
      monthLabel:'ตุลาคม 2569',
      net:0,
      income:0,
      expense:0,
      recent:[],
      onMonthChange:()=>{},
      onUpload:()=>{},
      onTransactions:()=>{},onDayTransactions:()=>{},
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

    expect(calendar).toBeLessThan(chosenDay);
    expect(chosenDay).toBeLessThan(overview);
    expect(overview).toBeLessThan(briefing);
    expect(briefing).toBeLessThan(upload);
    expect(upload).toBeLessThan(recent);
    expect(markup).toContain('สลิป K PLUS หรือใบเสร็จ · เลือกได้หลายรูป');
    expect(markup).toContain('ยังไม่มีรายการที่บันทึกในวันที่เลือก');
    expect(markup).not.toContain('ดูรายการเดือนที่เลือก');
    expect(markup).toContain('รายการล่าสุด');
    expect(markup).not.toContain('ยังไม่มีรายการในเดือนนี้');
  });
  it('shows the exact date drill-down only when saved entries exist',()=>{
    const day=todayLocal();
    const month=day.slice(0,7);
    const entries:Transaction[]=Array.from({length:6},(_,i)=>({
      id:'day-'+i,type:'expense',amountSatang:10000+i,
      category:'อาหารและเครื่องดื่ม',note:'',date:day,method:'bank',createdAt:i
    }));
    const markup=renderToStaticMarkup(createElement(HomeScreen,{
      month,monthLabel:'เดือนทดสอบ',net:0,income:0,expense:0,
      recent:entries,onMonthChange:()=>{},onUpload:()=>{},onTransactions:()=>{},
      onDayTransactions:()=>{},reportSlot:createElement('section',{})
    }));
    expect(markup).toContain('ดูทั้งหมด 6 รายการ');
    expect(markup).toContain('อีก 2 รายการ');
    expect(markup).toContain('mt-home-day-detail');
    expect(markup).not.toContain('ดูรายการเดือนที่เลือก');
  });
});

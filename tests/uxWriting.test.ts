import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
import HomeScreen,{HomeTopbar} from '../src/HomeScreen';
import FinanceCalendar from '../src/FinanceCalendar';
import AccountingSecretary from '../src/AccountingSecretary';
import AccountantReview from '../src/AccountantReview';
import {secretaryAnswer} from '../src/lib/accountingSecretary';
import {todayLocal,type Transaction} from '../src/lib/finance';

const item:Transaction={
  id:'ux-writing-income',type:'income',amountSatang:250000,
  category:'เงินเดือน',note:'',sender:'ผู้โอนทดสอบ',recipient:'บัญชีฉัน',
  date:'2026-09-21',method:'bank',createdAt:1
};

describe('Thai UX writing and truthful financial periods',()=>{
  it('shows an actionable review count without falsely marking zero notifications',()=>{
    const awaiting=renderToStaticMarkup(createElement(HomeTopbar,{
      pendingCount:3,onNotifications:()=>{},onSettings:()=>{}
    }));
    expect(awaiting).toContain('เปิดรายการรอตรวจ 3 รายการ');
    expect(awaiting).toContain('mt-home-alert-count');
    const empty=renderToStaticMarkup(createElement(HomeTopbar,{
      pendingCount:0,onNotifications:()=>{},onSettings:()=>{}
    }));
    expect(empty).toContain('ไม่มีรายการรอตรวจ');
    expect(empty).not.toContain('mt-home-alert-count');
  });

  it('separates the actual current day, selected day and an explicit return action',()=>{
    const today=todayLocal();
    const current=renderToStaticMarkup(createElement(FinanceCalendar,{
      month:today.slice(0,7),selectedDate:today,transactions:[],
      onSelect:()=>{},onMonthChange:()=>{}
    }));
    expect(current).toContain('aria-current="date"');
    expect(current).toContain('วันที่เลือก');
    expect(current).not.toContain('กลับไปวันนี้');
    const historical=renderToStaticMarkup(createElement(FinanceCalendar,{
      month:'2020-01',selectedDate:'2020-01-15',transactions:[],
      onSelect:()=>{},onMonthChange:()=>{}
    }));
    expect(historical).toContain('กลับไปวันนี้');
    expect(historical).toContain('mt-calendar-today');
  });

  it('labels Calendar-first and selected-day states without inventing entries',()=>{
    const markup=renderToStaticMarkup(createElement(HomeScreen,{
      month:'2026-09',monthLabel:'กันยายน 2569',
      net:0,income:0,expense:0,recent:[],
      onMonthChange:()=>{},onUpload:()=>{},onTransactions:()=>{},onDayTransactions:()=>{},
      reportSlot:createElement('section',{'data-accounting':true})
    }));
    expect(markup).toContain('ปฏิทินรายรับ–รายจ่าย');
    expect(markup).toContain('ยังไม่มีรายการที่บันทึกในวันที่เลือก');
    expect(markup).toContain('ยังไม่มีรายการที่บันทึกในเดือนที่เลือก');
    expect(markup).not.toContain('ดูรายการเดือนที่เลือก');
    expect(markup).not.toContain('ดูรายการทั้งเดือน');
    expect(markup.indexOf('aria-label="ปฏิทินรายรับรายจ่าย"')).toBeLessThan(
      markup.indexOf('aria-label="ภาพรวมรายเดือน"')
    );
  });

  it('describes calendar empty days as no saved records, not zero real-world spending',()=>{
    const markup=renderToStaticMarkup(createElement(FinanceCalendar,{
      month:'2026-09',transactions:[],selectedDate:'2026-09-21',
      onSelect:()=>{},onMonthChange:()=>{}
    }));
    expect(markup).toContain('ยังไม่มีรายการที่บันทึก');
    expect(markup).toContain('แตะวันที่เพื่อดูยอดเต็มและรายการ');
  });

  it('keeps the accounting briefing transparent and correctly labels money out',()=>{
    const markup=renderToStaticMarkup(createElement(AccountingSecretary,{
      items:[item],month:'2026-09',localPending:1,iphonePending:null,
      onTransactions:()=>{},onReviewLocal:()=>{},onReviewIphone:()=>{}
    }));
    expect(markup).toContain('วันนี้มีเงินออกเท่าไร');
    expect(markup).toContain('สรุปจากข้อมูลที่บันทึกในเครื่อง');
    expect(markup).toContain('รายการรอตรวจ');
  });

  it('describes category totals in the selected month, even when browsing history',()=>{
    const expense:Transaction={...item,id:'outflow',type:'expense',amountSatang:5000,category:'อาหารและเครื่องดื่ม'};
    const result=secretaryAnswer('category',[expense],'2026-09','2026-10-29',0,0);
    expect(result.detail).toContain('เดือนที่เลือก');
    expect(result.detail).not.toContain('เดือนนี้');
  });

  it('uses period-correct labels in the accountant review and Transactions',()=>{
    const review=renderToStaticMarkup(createElement(AccountantReview,{
      items:[],localPending:0,iphonePending:0,onTransactions:()=>{},
      onBucket:()=>{},onLocalReview:()=>{},onIphoneReview:()=>{},onExport:()=>{}
    }));
    expect(review).toContain('รายการเดือนที่เลือก');
    expect(review).not.toContain('รายการเดือนนี้');
    const app=readFileSync(join(process.cwd(),'src/App.tsx'),'utf8');
    expect(app).toContain('สรุปรายรับ–รายจ่ายของเดือนที่เลือก');
    expect(app).toContain('ค้นหาชื่อผู้โอน ผู้รับ หรือหมวดหมู่');
    expect(app).not.toContain('สรุปยอดรายรับ–รายจ่ายเดือนนี้');
  });
});

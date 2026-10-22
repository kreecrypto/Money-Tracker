import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import HomeScreen, {HomeTopbar} from './HomeScreen';

const baseProps={
  month:'2026-10',monthLabel:'ตุลาคม 2569',
  net:0,income:0,expense:0,recent:[],
  onMonthChange:()=>{},onUpload:()=>{},onTransactions:()=>{},
  onPendingSlips:()=>{},onPendingIphone:()=>{},onSetupOwner:()=>{},
};
describe('Daily Home P0 queue visibility',()=>{
  it('announces combined pending items accurately, not just bank slips',()=>{
    const html=renderToStaticMarkup(<HomeTopbar pendingCount={3} onNotifications={()=>{}} onSettings={()=>{}}/>);
    expect(html).toContain('การแจ้งเตือน: มีรายการรอตรวจ 3 รายการ');
    expect(html).not.toContain('มีสลิปรอตรวจ');
  });
  it('shows upload first, then both pending sources before the recent ledger',()=>{
    const html=renderToStaticMarkup(<HomeScreen {...baseProps} pendingSlipCount={2} pendingIphoneCount={1} needsOwnerName={false}/>);
    expect(html.indexOf('อัปโหลดสลิป')).toBeLessThan(html.indexOf('รอตรวจจากสลิป 2 รายการ'));
    expect(html.indexOf('รอตรวจจากสลิป 2 รายการ')).toBeLessThan(html.indexOf('รอตรวจจาก iPhone 1 รายการ'));
    expect(html.indexOf('รอตรวจจาก iPhone 1 รายการ')).toBeLessThan(html.indexOf('รายการล่าสุด'));
    expect(html).toContain('ยังไม่รวมในยอดเงินรายเดือน');
    expect(html).toContain('aria-label="ตรวจสลิปที่รอตรวจ 2 รายการ"');
    expect(html).toContain('aria-label="ตรวจรายการจาก iPhone 1 รายการ"');
  });
  it('hides pending UI when the queue is empty but preserves setup guidance when needed',()=>{
    const html=renderToStaticMarkup(<HomeScreen {...baseProps} pendingSlipCount={0} pendingIphoneCount={0} needsOwnerName/>);
    expect(html).not.toContain('รายการที่ต้องตรวจ');
    expect(html).toContain('เพิ่มชื่อของฉัน');
    expect(html).toContain('เพิ่มชื่อที่ปรากฏบนสลิป');
  });
});

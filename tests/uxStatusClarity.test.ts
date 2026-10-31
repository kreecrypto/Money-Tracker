import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');

describe('Thai UX status and mobile accessibility regressions',()=>{
  it('describes the scanner close action accurately and does not require a static stepper',()=>{
    const app=read('src/App.tsx');
    const audit=read('scripts/ux-audit.mjs');
    expect(app).toContain('title="ปิด" aria-label="ปิด" disabled={pending||batchBusy} onClick={safeClose}');
    expect(audit).toContain("page.locator('.slip-panel .slip-hint')");
    expect(audit).not.toContain("page.getByText('2 อ่านข้อมูลจากสลิป')");
  });

  it('preserves selected-month context for past-month reports',()=>{
    const app=read('src/App.tsx');
    const review=read('src/AccountantReview.tsx');
    const home=read('src/HomeScreen.tsx');
    expect(app).toContain('ของงบเดือนที่เลือก');
    expect(review).toContain('รายการเดือนที่เลือก');
    expect(review).not.toContain('รายการเดือนนี้');
    expect(home).toContain('หน้ารายการของเดือนที่เลือก');
  });

  it('keeps pending totals clear and accessible calendar amounts on narrow phones',()=>{
    const scanner=read('src/SlipScanner.tsx');
    const css=read('src/finance-calendar.css');
    const calendar=read('src/FinanceCalendar.tsx');
    expect(scanner).toContain('รอตรวจ {summary.incomplete} รูป · ยังไม่รวมยอด');
    expect(scanner).toContain('อ่านหรือบันทึกไม่สำเร็จ {summary.errors} รูป');
    expect(css).toContain('font-size:11px');
    expect(css).not.toContain('.mt-calendar-day-amounts{font-size:9px}');
    expect(calendar).toContain('aria-label={description}');
  });
});

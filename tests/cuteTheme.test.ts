import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(join(process.cwd(),path),'utf8');
const theme=read('src/cute-kawaii-preview.css');
const entry=read('src/main.tsx');

describe('Cute visual theme release guards',()=>{
  it('loads theme after responsive grid so the visual override is not overwritten',()=>{
    expect(entry.indexOf("import './cute-kawaii-preview.css';")).toBeGreaterThan(
      entry.indexOf("import './responsive-grids.css';")
    );
  });
  it('overrides legacy forced white mobile canvas and dark balance card',()=>{
    expect(theme).toMatch(/body:has\(\.mt-home-screen\)/);
    expect(theme).toMatch(/\.main-content:has\(\.mt-home-screen\)[\s\S]*?background:var\(--cute-canvas\)!important/);
    expect(theme).toMatch(/\.mt-home-balance\.mt-home-calendar-summary[\s\S]*?background:[^;]+!important/);
    expect(theme).toMatch(/\.mt-home-balance\.mt-home-calendar-summary \.mt-home-total[\s\S]*?color:var\(--cute-ink\)!important/);
  });
  it('styles all key screens and active states without hiding data or changing grid',()=>{
    for (const selector of [
      '.mt-finance-calendar','.mt-calendar-day.is-selected','.mt-home-day-detail',
      '.mt-home-screen .mt-home-upload','.transaction-page .transaction-row',
      '.ref-report-tabs button.active','.ref-ocr-modal .slip-upload-box',
      '.mobile-bottom-nav button.active'
    ]) expect(theme).toContain(selector);
    expect(theme).not.toMatch(/display:\s*none\s*!important/);
    expect(theme).not.toMatch(/grid-template-columns\s*:/);
  });
  it('preserves visible focus and reduced-motion affordances',()=>{
    expect(theme).toContain(':focus-visible');
    expect(theme).toContain('prefers-reduced-motion:reduce');
  });
});

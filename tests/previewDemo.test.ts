import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';
import {isValidTransaction,monthly,summarize} from '../src/lib/finance';
import {previewTransactions} from '../src/lib/previewDemo';

describe('Preview-only mock transactions',()=>{
  it('keeps fictional satang data valid, searchable and spread over months',()=>{
    const date=new Date(2026,10,2,12);
    const items=previewTransactions(date);
    expect(items.length).toBeGreaterThanOrEqual(15);
    expect(new Set(items.map(item=>item.id)).size).toBe(items.length);
    expect(items.every(isValidTransaction)).toBe(true);
    expect(items.every(item=>item.id.startsWith('demo-'))).toBe(true);
    expect(items.some(item=>item.type==='income')).toBe(true);
    expect(items.some(item=>item.type==='expense')).toBe(true);
    expect(monthly(items,'2026-11').length).toBeGreaterThanOrEqual(5);
    expect(monthly(items,'2026-10').length).toBeGreaterThan(0);
    expect(summarize(monthly(items,'2026-11')).income).toBeGreaterThan(0);
  });
  it('gates the demo at build time and does not mount LiveApp in Preview',()=>{
    const vite=readFileSync(join(process.cwd(),'vite.config.ts'),'utf8');
    const app=readFileSync(join(process.cwd(),'src/App.tsx'),'utf8');
    expect(vite).toContain("process.env.VERCEL_ENV === 'preview'");
    expect(app).toContain('return __MONEY_PREVIEW_DEMO__?<PreviewDemo/>:<LiveApp/>');
    expect(app).toContain('readOnly/>');
    expect(app).toContain('DEMO · ข้อมูลตัวอย่างเท่านั้น');
    const demo=app.slice(app.indexOf('function PreviewDemo(){'));
    for(const forbidden of ['loadTransactions(', 'saveTransaction(', 'replaceAll(', 'iphoneSync(', 'syncLineInbox(', 'localStorage.setItem(']){
      expect(demo).not.toContain(forbidden);
    }
  });
});

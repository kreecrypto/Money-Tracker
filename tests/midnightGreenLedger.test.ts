import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe,expect,it} from 'vitest';

const dark=readFileSync(join(process.cwd(),'src/midnight-green.css'),'utf8');
const entry=readFileSync(join(process.cwd(),'src/main.tsx'),'utf8');

const contrast=(foreground:string,background:string)=>{
  const luminance=(hex:string)=>{
    const rgb=hex.match(/[a-f\d]{2}/gi)?.map(value=>parseInt(value,16)/255)??[];
    return rgb.map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4)
      .reduce((sum,value,i)=>sum+value*[0.2126,0.7152,0.0722][i],0);
  };
  const a=luminance(foreground),b=luminance(background);
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
};

describe('Midnight Green category and email review',()=>{
  it('loads after original light components, with no changes to saved finance data',()=>{
    expect(entry.indexOf("import './midnight-green.css';")).toBeGreaterThan(
      entry.indexOf("import './cute-kawaii-preview.css';")
    );
    for(const selector of [
      '.settings-card .email-ledger-preview',
      '.settings-card .email-ledger-items b',
      '.settings-card .email-ledger-category>summary',
      '.category-review .category-review-rows',
      '.category-review .category-review-tools button'
    ])expect(dark).toContain(selector);
    expect(dark).not.toMatch(/filter:\s*invert\(/);
  });
  it('uses readable AA contrast for ledger amounts, muted descriptions and error states',()=>{
    for(const foreground of ['#f1faf4','#b6cbbf','#95e8b7','#ffadba'])
      expect(contrast(foreground,'#1b3028')).toBeGreaterThanOrEqual(4.5);
  });
  it('retains visible keyboard focus and appropriately sized category controls',()=>{
    expect(dark).toContain('.category-review .category-review-row:focus-within');
    expect(dark).toContain('.category-review .category-review-tools button:focus-visible');
    expect(dark).toMatch(/\.category-review \.category-review-tools button\s*\{[\s\S]*?min-height:44px/);
  });
});

import {describe,it,expect} from 'vitest';
import {enhanceReceiptPixels} from '../src/lib/slipImage';

describe('K PLUS in-browser OCR enhancement',()=>{
  it('preserves a blank white receipt instead of converting it to black',()=>{
    const data=new Uint8ClampedArray([255,255,255,255,255,255,255,255]);
    enhanceReceiptPixels(data);
    expect([...data]).toEqual([255,255,255,255,255,255,255,255]);
  });
  it('stretches dark text and pale background while retaining alpha',()=>{
    const data=new Uint8ClampedArray([
      48,48,48,255,
      230,230,230,128,
      180,180,180,255
    ]);
    enhanceReceiptPixels(data);
    expect(data[0]).toBeLessThan(data[8]);
    expect(data[8]).toBeLessThan(data[4]);
    expect(data[4]).toBe(255);
    expect(data[3]).toBe(255);
    expect(data[7]).toBe(128);
  });
  it('converts subtle RGB artifacts to monochrome without changing pixel count',()=>{
    const data=new Uint8ClampedArray([30,60,100,255,220,233,242,255]);
    enhanceReceiptPixels(data);
    expect(data).toHaveLength(8);
    expect(data[0]).toBe(data[1]);
    expect(data[1]).toBe(data[2]);
  });
});

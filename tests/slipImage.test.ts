import {describe,it,expect} from 'vitest';
import {enhanceReceiptPixels,findKPlusAmountCrop} from '../src/lib/slipImage';

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


describe('K PLUS amount-only OCR crop geometry',()=>{
  const line=(words:{text:string;x:number;y?:number}[])=>
    ({words:words.map(w=>({text:w.text,bbox:{x0:w.x,y0:w.y??500,x1:w.x+80,y1:(w.y??500)+30}}))});
  const blocks=(...lines:ReturnType<typeof line>[])=>[{paragraphs:[{lines}]}];
  it('crops near the solitary amount heading while including the right-aligned payment',()=>{
    const crop=findKPlusAmountCrop(blocks(line([{text:'จำนวน',x:60}])),900,1300);
    expect(crop).not.toBeNull();
    expect(crop!.x).toBeLessThan(60);
    expect(crop!.y).toBeLessThan(500);
    expect(crop!.x+crop!.width).toBeGreaterThan(800);
    expect(crop!.y+crop!.height).toBeGreaterThan(560);
  });
  it('supports a separated amount label and colon in the same OCR row',()=>{
    expect(findKPlusAmountCrop(blocks(line([{text:'จำนวน',x:60},{text:':',x:160}])),900,1300)).not.toBeNull();
  });
  it('never crops fee/balance/product quantity or an ambiguous pair of headings',()=>{
    expect(findKPlusAmountCrop(blocks(line([{text:'ค่าธรรมเนียม',x:40},{text:'จำนวน',x:160}])),900,1300)).toBeNull();
    expect(findKPlusAmountCrop(blocks(line([{text:'จำนวน',x:60},{text:'สินค้า',x:160}])),900,1300)).toBeNull();
    expect(findKPlusAmountCrop(blocks(line([{text:'จำนวน',x:60}]),line([{text:'ยอดชำระ',x:60,y:720}])),900,1300)).toBeNull();
  });
  it('rejects missing, invalid, or off-image coordinates instead of guessing',()=>{
    expect(findKPlusAmountCrop([],900,1300)).toBeNull();
    expect(findKPlusAmountCrop(blocks(line([{text:'จำนวน',x:60}])),0,1300)).toBeNull();
    expect(findKPlusAmountCrop(blocks(line([{text:'จำนวน',x:960}])),900,1300)).toBeNull();
  });
});

import {describe,it,expect} from 'vitest';
import {MAX_SCAN_BYTES,isHeicSlip,validateSlipFile,scaledSlipSize} from '../src/lib/slipImage';
describe('local iOS Safari HEIC slip support',()=>{
  it('accepts iPhone HEIC or HEIF by MIME and file extension',()=>{
    expect(isHeicSlip({name:'IMG_001.HEIC',type:'application/octet-stream'})).toBe(true);
    expect(isHeicSlip({name:'bank.heif',type:'image/heif'})).toBe(true);
    expect(validateSlipFile({name:'IMG_001.heic',type:'image/heic',size:1048576})).toBe('ok');
  });
  it('keeps jpeg and webp working and rejects unsupported documents',()=>{
    expect(validateSlipFile({name:'receipt.jpg',type:'image/jpeg',size:42})).toBe('ok');
    expect(validateSlipFile({name:'receipt.webp',type:'image/webp',size:42})).toBe('ok');
    expect(validateSlipFile({name:'receipt.pdf',type:'application/pdf',size:42})).toBe('type');
  });
  it('enforces client size budget before HEIC is decoded',()=>{
    expect(validateSlipFile({name:'receipt.heic',type:'image/heic',size:MAX_SCAN_BYTES+1})).toBe('size');
    expect(validateSlipFile({name:'receipt.heic',type:'image/heic',size:0})).toBe('size');
  });
  it('scales safely without upscaling scanned slips',()=>{
    expect(scaledSlipSize(5200,3900)).toEqual({width:2600,height:1950});
    expect(scaledSlipSize(500,900)).toEqual({width:500,height:900});
    expect(()=>scaledSlipSize(0,200)).toThrow();
  });
});

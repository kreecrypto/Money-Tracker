import {describe,it,expect,vi,afterEach} from 'vitest';
import {MAX_SCAN_BYTES,isHeicSlip,validateSlipFile,scaledSlipSize,prepareSlipForOcr} from '../src/lib/slipImage';
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

afterEach(()=>vi.unstubAllGlobals());
describe('HEIC browser conversion adapter',()=>{
  it('does not process JPEG twice',async()=>{
    const file=new File(['test'],'receipt.jpg',{type:'image/jpeg'});
    await expect(prepareSlipForOcr(file)).resolves.toBe(file);
  });
  it('uses local image decode + canvas and revokes the object URL',async()=>{
    const revoke=vi.fn(),draw=vi.fn(),newUrl=vi.fn(()=> 'blob:synthetic-heic');
    vi.stubGlobal('URL',{createObjectURL:newUrl,revokeObjectURL:revoke});
    class SyntheticImage{
      onload:(()=>void)|null=null;
      onerror:(()=>void)|null=null;
      naturalWidth=5200;naturalHeight=3900;
      set src(value:string){if(value==='blob:synthetic-heic')queueMicrotask(()=>this.onload?.());}
    }
    vi.stubGlobal('Image',SyntheticImage);
    const ctx={drawImage:draw};
    const canvas={width:0,height:0,getContext:()=>ctx,toBlob:(done:(blob:Blob)=>void)=>done(new Blob(['jpg'],{type:'image/jpeg'}))};
    vi.stubGlobal('document',{createElement:(tag:string)=>{expect(tag).toBe('canvas');return canvas;}});
    const file=new File(['synthetic-heic'],'bank.HEIC',{type:'image/heic'});
    const converted=await prepareSlipForOcr(file);
    expect(converted.type).toBe('image/jpeg');
    expect(converted.name).toBe('bank.jpg');
    expect(draw).toHaveBeenCalledWith(expect.any(SyntheticImage),0,0,2600,1950);
    expect(revoke).toHaveBeenCalledWith('blob:synthetic-heic');
  });
  it('never uploads if browser cannot decode HEIC',async()=>{
    const revoked=vi.fn();
    vi.stubGlobal('URL',{createObjectURL:()=> 'blob:synthetic-failed',revokeObjectURL:revoked});
    class UnsupportedImage{
      onload:(()=>void)|null=null;
      onerror:(()=>void)|null=null;
      set src(_value:string){queueMicrotask(()=>this.onerror?.());}
    }
    vi.stubGlobal('Image',UnsupportedImage);
    vi.stubGlobal('document',{createElement:vi.fn()});
    await expect(prepareSlipForOcr(new File(['heic'],'receipt.heic',{type:'image/heic'}))).rejects.toThrow(/Safari/);
    expect(revoked).toHaveBeenCalledTimes(1);
  });
});

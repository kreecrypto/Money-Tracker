import {describe,expect,it} from 'vitest';
import {clipboardSlipFiles} from '../src/lib/shortcutClipboard';
import {MAX_SLIP_BATCH_FILES,validateSlipImage} from '../src/lib/slipBatch';

const imageItem=(mime:string,blob:Blob):ClipboardItem=>({
  types:[mime],
  getType:async(type:string)=>{
    if(type!==mime)throw new Error('unsupported type');
    return blob;
  },
  presentationStyle:'inline'
} as ClipboardItem);

describe('iPhone Shortcut clipboard image handoff',()=>{
  it('passes a copied PNG to the existing in-browser slip image validator',async()=>{
    const files=await clipboardSlipFiles(async()=>[
      imageItem('image/png',new Blob(['image-data'],{type:'image/png'})),
    ]);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('shortcut-slip-1.png');
    expect(validateSlipImage(files[0])).toBeNull();
  });
  it('does not parse text as image or invent receipt data',async()=>{
    await expect(clipboardSlipFiles(async()=>[
      {types:['text/plain'],getType:async()=>new Blob(['hello'])} as unknown as ClipboardItem,
    ])).rejects.toThrow('ไม่พบรูป');
  });
  it('keeps the original bytes and accepts multiple image formats',async()=>{
    const bytes=Uint8Array.of(137,80,78,71,3,2,1);
    const files=await clipboardSlipFiles(async()=>[
      imageItem('image/png',new Blob([bytes],{type:'image/png'})),
      imageItem('image/jpeg',new Blob([Uint8Array.of(255,216,255)],{type:'image/jpeg'})),
    ]);
    expect(new Uint8Array(await files[0].arrayBuffer())).toEqual(bytes);
    expect(files[1].name).toBe('shortcut-slip-2.jpg');
  });
  it('bounds clipboard multi-image imports to the same 20-file batch limit',async()=>{
    const file=new Blob(['a'],{type:'image/png'});
    const items=Array.from({length:MAX_SLIP_BATCH_FILES+4},()=>imageItem('image/png',file));
    const result=await clipboardSlipFiles(async()=>items);
    expect(result).toHaveLength(MAX_SLIP_BATCH_FILES);
  });
  it('propagates paste permission errors without falling back to a silent save',async()=>{
    await expect(clipboardSlipFiles(async()=>{throw new DOMException('denied','NotAllowedError');}))
      .rejects.toHaveProperty('name','NotAllowedError');
  });
});

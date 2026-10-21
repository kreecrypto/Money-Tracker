import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {describe,expect,it} from 'vitest';
import {parseSlipText} from '../src/lib/slip';
import {prepareAutoSlip} from '../src/lib/slipAutoSave';
import {receiptLayoutLines} from '../src/lib/receiptIntelligence';

type GoldenField='amountSatang'|'date'|'time'|'recipient'|'direction';
type Expected={status:'ready'|'incomplete'} & Partial<{
  amountSatang:number|null;
  date:string|null;
  time:string|null;
  recipient:string|null;
  direction:'income'|'expense'|null;
}>;
type GoldenCase={id:string;image:string;ownerNames?:string[];expected:Expected};
const fields:GoldenField[]=['amountSatang','date','time','recipient','direction'];
const privateDir=resolve(process.cwd(),'tests/private-ocr');

/** Reject untrusted fixture paths and incomplete "ready" baselines before opening images. */
function goldenCases(source:unknown):GoldenCase[]{
  const data=source as {cases?:unknown};
  if(!data||!Array.isArray(data.cases)||!data.cases.length)
    throw new Error('Golden manifest must contain at least one case');
  const ids=new Set<string>();
  return data.cases.map((raw:unknown)=>{
    const item=raw as Partial<GoldenCase>;
    if(!item||typeof item.id!=='string'||!/^[a-z0-9][a-z0-9_-]*$/iu.test(item.id)||ids.has(item.id))
      throw new Error('Golden case ID must be unique and anonymous');
    ids.add(item.id);
    if(typeof item.image!=='string'||!/^[a-z0-9][a-z0-9_-]*\.(?:png|jpe?g|webp)$/iu.test(item.image))
      throw new Error('Golden image must be a safe JPG, PNG or WebP basename');
    if(item.ownerNames!==undefined&&(!Array.isArray(item.ownerNames)||!item.ownerNames.every(n=>typeof n==='string')))
      throw new Error('ownerNames must be a local string array');
    const expected=item.expected;
    if(!expected||!['ready','incomplete'].includes(expected.status))
      throw new Error('Expected decision must be ready or incomplete');
    if(Object.keys(expected).some(key=>key!=='status'&&!fields.includes(key as GoldenField)))
      throw new Error('Unexpected expected-field key');
    for(const field of fields){
      const value=expected[field];
      if(expected.status==='ready'&&(value===undefined||value===null||value===''))
        throw new Error('Ready baseline requires all five extracted fields');
      if(value===undefined||value===null)continue;
      if(field==='amountSatang'&&(!Number.isSafeInteger(value)||Number(value)<=0))
        throw new Error('Amount must be positive integer satang');
      if(field==='date'&&(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(value)))
        throw new Error('Expected date must be YYYY-MM-DD');
      if(field==='time'&&(typeof value!=='string'||!/^\d{2}:\d{2}$/u.test(value)))
        throw new Error('Expected time must be HH:MM');
      if(field==='recipient'&&(typeof value!=='string'||!value.trim()))
        throw new Error('Expected recipient must be nonblank');
      if(field==='direction'&&value!=='income'&&value!=='expense')
        throw new Error('Direction must be income or expense');
    }
    return item as GoldenCase;
  });
}

describe('private OCR golden harness validation',()=>{
  it('blocks path traversal and accidental repeated IDs',()=>{
    expect(()=>goldenCases({cases:[{id:'safe',image:'../bank.png',expected:{status:'incomplete'}}]})).toThrow(/basename/u);
    expect(()=>goldenCases({cases:[
      {id:'same',image:'one.png',expected:{status:'incomplete'}},
      {id:'same',image:'two.png',expected:{status:'incomplete'}},
    ]})).toThrow(/unique/u);
  });
  it('requires a full financial baseline for an expected saved slip',()=>{
    expect(()=>goldenCases({cases:[{id:'bill',image:'bill.png',expected:{status:'ready',amountSatang:9000}}]}))
      .toThrow(/all five/u);
  });
});

/**
 * Opt-in only. Normal CI must not pass itself off as real-image OCR QA.
 * Run locally with RUN_PRIVATE_OCR=1; missing manifest or images then FAIL.
 * Never print OCR text, images, names, or amounts in test failure messages.
 */
describe.skipIf(process.env.RUN_PRIVATE_OCR!=='1')('private K PLUS image OCR golden cases',()=>{
  it('reads real image bytes through Tesseract and checks parsed auto-save decisions',async()=>{
    let cases:GoldenCase[];
    try{
      const manifest=JSON.parse(await readFile(join(privateDir,'manifest.json'),'utf8')) as unknown;
      cases=goldenCases(manifest);
    }catch{
      throw new Error('Private OCR manifest is missing or invalid; see docs/OCR_REAL_IMAGE_QA.md');
    }

    const {createWorker,PSM}=await import('tesseract.js');
    const worker=await createWorker(['tha','eng'],1);
    const failures:string[]=[];
    try{
      await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO});
      for(const sample of cases){
        let image:Buffer;
        try{image=await readFile(join(privateDir,sample.image));}
        catch{failures.push(sample.id+': unreadable image file');continue;}
        // This is the same initial OCR engine/PSM and parser as the browser.
        // Browser-only enhancement/cropped recovery and iPhone Photos QA remain separate gates.
        const ocr=await worker.recognize(image,{}, {text:true,blocks:true});
        const parsed=parseSlipText(ocr.data.text,receiptLayoutLines(ocr.data.blocks),sample.ownerNames??[]);
        const decision=prepareAutoSlip(parsed,[],sample.id,0);
        const actual={...parsed,status:decision.status};
        for(const field of ['status',...fields] as const){
          const wanted=sample.expected[field];
          if(wanted!==undefined&&actual[field]!==wanted)
            failures.push(sample.id+': '+field+' mismatch');
        }
      }
    }finally{
      await worker.terminate();
    }
    if(failures.length)throw new Error('OCR golden mismatches (values redacted):\n'+failures.join('\n'));
  },180_000);
});

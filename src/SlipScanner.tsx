import {useEffect,useRef,useState,type ChangeEvent} from 'react';
import {Camera,CheckCircle2,ScanLine,ShieldCheck,Upload,Square,Undo2,AlertTriangle,Check,LoaderCircle,ClipboardPaste,CalendarDays,Clock3,Wallet,UserRound,Tag} from 'lucide-react';
import slipArt from './assets/slip-ready.svg';
import {parseSlipText,mergeSlipOcrReadings,needsSlipOcrRecovery,describeMissingSlipAmount,type SlipFields} from './lib/slip';
import {isKPlusPaymentForOcrRecovery,parseKPlusRecipientRegion} from './lib/kplus';
import {prepareSlipRecoveryImage,prepareSlipOcrFile,findKPlusAmountCrop,prepareKPlusAmountCrop,findKPlusRecipientCrop,prepareKPlusRecipientCrop} from './lib/slipImage';
import {isLowOcrConfidence,requiresLowConfidenceReview} from './lib/ocrConfidence';
import {classifyByAccountNames} from './lib/slipIdentity';
import {withOcrDeadline,OCR_MODEL_TIMEOUT_MS,OCR_PASS_TIMEOUT_MS,OcrDeadlineError} from './lib/ocrDeadline';
import {clipboardSlipFiles} from './lib/shortcutClipboard';
import {receiptLayoutLines,receiptReconciliationError} from './lib/receiptIntelligence';
import {baht,toSatang,EXPENSE_CATEGORIES,INCOME_CATEGORIES,type EntryType,type Method} from './lib/finance';
import {correctionDirection,isWalletFundingSlip,isTrueMoneyBankTopUp,slipBatchHeading} from './lib/slipReview';
import {
  MAX_SLIP_BATCH_FILES,summarizeSlipBatch,savedSlipTotals,validateSlipImage,
  type SlipBatchOutcome,type SlipBatchRow,
} from './lib/slipBatch';

type BatchSummary=ReturnType<typeof summarizeSlipBatch>;
type Props={
  onApply:(data:SlipFields)=>Promise<SlipBatchOutcome>;
  onComplete:(summary:BatchSummary)=>void;
  onBusyChange:(busy:boolean)=>void;
  onUndoBatch:(ids:string[])=>Promise<void>;
  onQueuePending:(slip:SlipFields,name:string,reason:string)=>Promise<{id:string;duplicate:boolean}>;
  onResolvePending:(id:string)=>Promise<void>;
  onClose:()=>void;
  onViewSaved:(date:string)=>void;
  ownerNames?:readonly string[];
};
type ProcessingStage='download'|'recognize'|'retry'|'save';
type Correction={
  source:SlipFields;
  date:string;
  time:string;
  amount:string;
  recipient:string;
  direction:EntryType|'';
  method:Method;
  category:string;
};
const statusLabels:Record<SlipBatchRow['status'],string>={
  saved:'บันทึกแล้ว',duplicate:'รายการซ้ำ',incomplete:'รอตรวจข้อมูล',
  error:'อ่านหรือบันทึกไม่สำเร็จ',cancelled:'ยกเลิกแล้ว',undone:'ยกเลิกการบันทึกแล้ว',excluded:'ไม่นับรายการ',
};
const toCorrection=(source:SlipFields):Correction=>({
  source,date:source.date||'',time:source.time||'',
  amount:source.amountSatang===null?'':String(source.amountSatang/100),
  recipient:source.recipient||'',direction:correctionDirection(source),
  method:source.method||'bank',category:source.category||'อื่น ๆ',
});
async function originalImageHash(file:File):Promise<string|undefined>{
  if(typeof crypto==='undefined'||!crypto.subtle)return undefined;
  try{
    const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  }catch{return undefined;}
}

export default function SlipScanner({onApply,onComplete,onBusyChange,onUndoBatch,onQueuePending,onResolvePending,onClose,onViewSaved,ownerNames=[]}:Props){
  const galleryRef=useRef<HTMLInputElement>(null);
  const cameraRef=useRef<HTMLInputElement>(null);
  const attentionRef=useRef<HTMLDivElement>(null);
  const workerRef=useRef<{terminate:()=>Promise<unknown>}|null>(null);
  const previewUrlRef=useRef<string|null>(null);
  const reviewImageUrlsRef=useRef<Record<number,string>>({});
  const mountedRef=useRef(true);
  const runningRef=useRef(false);
  const stopRef=useRef(false);
  const [preview,setPreview]=useState<string|null>(null);
  const [filename,setFilename]=useState('');
  const [busy,setBusy]=useState(false);
  const [stopRequested,setStopRequested]=useState(false);
  const [progress,setProgress]=useState(0);
  const [stage,setStage]=useState<ProcessingStage>('download');
  const [activeIndex,setActiveIndex]=useState(0);
  const [totalFiles,setTotalFiles]=useState(0);
  const [rows,setRows]=useState<SlipBatchRow[]>([]);
  const [corrections,setCorrections]=useState<Record<number,Correction>>({});
  const [correctionErrors,setCorrectionErrors]=useState<Record<number,string>>({});
  const [fixingIndex,setFixingIndex]=useState<number|null>(null);
  const [undoing,setUndoing]=useState(false);
  const [complete,setComplete]=useState(false);
  const [clipboardError,setClipboardError]=useState('');

  useEffect(()=>{
    mountedRef.current=true;
    return ()=>{
      mountedRef.current=false;
      stopRef.current=true;
      if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);
      for(const url of Object.values(reviewImageUrlsRef.current))URL.revokeObjectURL(url);
      reviewImageUrlsRef.current={};
      if(workerRef.current)void workerRef.current.terminate().catch(()=>{});
    };
  },[]);

  const showPreview=(file:File)=>{
    const url=URL.createObjectURL(file);
    if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current=url;
    setPreview(url);setFilename(file.name);
  };
  const clearPreview=()=>{
    if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current=null;setPreview(null);
  };
  const changeCorrection=(index:number,patch:Partial<Correction>)=>{
    setCorrections(previous=>{
      const original=previous[index];
      return original?{...previous,[index]:{...original,...patch}}:previous;
    });
    setCorrectionErrors(previous=>({...previous,[index]:''}));
  };
  const focusReview=(index:number)=>{
    const card=document.getElementById('slip-review-'+index);
    if(!card)return;
    card.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    window.requestAnimationFrame(()=>card.querySelector<HTMLInputElement>('input[inputmode="decimal"]')?.focus({preventScroll:true}));
  };
  const scanFiles=async(files:File[])=>{
    if(!files.length||runningRef.current)return;
    if(Object.keys(corrections).some(key=>rows[Number(key)]?.status==='incomplete')){
      setClipboardError('ยังมีสลิปที่รอตรวจ กรุณาตรวจหรือปิดชุดนี้ก่อนเพิ่มชุดใหม่');
      return;
    }
    setClipboardError('');
    runningRef.current=true;stopRef.current=false;
    setBusy(true);setStopRequested(false);onBusyChange(true);
    for(const url of Object.values(reviewImageUrlsRef.current))URL.revokeObjectURL(url);
    reviewImageUrlsRef.current={};
    setRows([]);setCorrections({});setCorrectionErrors({});setComplete(false);
    setProgress(0);setStage('download');setActiveIndex(0);
    setTotalFiles(files.length);clearPreview();
    const processed:SlipBatchRow[]=[];
    const attention:Record<number,Correction>={};
    const publish=(row:SlipBatchRow)=>{
      processed.push(row);
      if(mountedRef.current)setRows([...processed]);
    };
    const selected=files.slice(0,MAX_SLIP_BATCH_FILES);
    const overflow=files.slice(MAX_SLIP_BATCH_FILES);
    const valid=selected.some(file=>validateSlipImage(file)===null);
    let worker:Awaited<ReturnType<typeof import('tesseract.js').createWorker>>|null=null;
    try{
      if(valid){
        const {createWorker,PSM}=await import('tesseract.js');
        if(stopRef.current)return;
        const starting=createWorker(['tha','eng'],1,{
          logger:message=>{
            if(mountedRef.current&&message.status==='recognizing text'){
              setStage(current=>current==='retry'?'retry':'recognize');
              setProgress(Math.round((message.progress||0)*100));
            }
          },
        });
        try{
          worker=await withOcrDeadline(starting,OCR_MODEL_TIMEOUT_MS,'โหลดระบบ OCR ');
        }catch(error){
          // The timed-out worker may complete its download later; terminate it
          // instead of leaving a WASM worker running in the background.
          void starting.then(lateWorker=>lateWorker.terminate()).catch(()=>{});
          throw error;
        }
        if(!mountedRef.current)return;
        workerRef.current=worker;
        for(let i=0;i<selected.length;i++){
          if(!mountedRef.current||stopRef.current)break;
          const file=selected[i];
          setActiveIndex(i+1);setStage('recognize');setProgress(0);
          const invalid=validateSlipImage(file);
          if(invalid){publish({name:file.name,status:'error',reason:invalid});continue;}
          try{
            setStage('download');
            const hash=await originalImageHash(file);
            const ocrFile=await prepareSlipOcrFile(file);
            if(stopRef.current)break;
            showPreview(ocrFile);
            await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO});
            setStage('recognize');
            const initial=await withOcrDeadline(worker.recognize(ocrFile,{}, {text:true,blocks:true}),OCR_PASS_TIMEOUT_MS,'อ่านสลิปรอบแรก ');
            const firstReading=parseSlipText(initial.data.text,receiptLayoutLines(initial.data.blocks),ownerNames);
            let reading=firstReading;
            let recoveredReading:SlipFields|null=null;
            let recoveredConfidence:number|null=null;
            const lowConfidence=isLowOcrConfidence(initial.data.confidence);
            // A failed OCR pass is not proof that the number is absent in the image.
            // Keep the enhanced image only long enough for a bounded amount crop retry.
            if((needsSlipOcrRecovery(reading)||lowConfidence)&&mountedRef.current&&!stopRef.current){
              setStage('retry');setProgress(0);
              try{
                const enhanced=await prepareSlipRecoveryImage(ocrFile);
                if(mountedRef.current&&!stopRef.current){
                  await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
                  const retry=await withOcrDeadline(worker.recognize(enhanced,{}, {text:true,blocks:true}),OCR_PASS_TIMEOUT_MS,'อ่านสลิปรอบสอง ');
                  recoveredReading=parseSlipText(retry.data.text,receiptLayoutLines(retry.data.blocks),ownerNames);
                  recoveredConfidence=retry.data.confidence;
                  reading=mergeSlipOcrReadings(reading,recoveredReading);
                  // Third recognition is strictly amount-only, and only when
                  // both full-page OCR passes missed a K PLUS payment value.
                  // Contradictory numbers are NEVER overridden by cropping.
                  const kplusText=firstReading.rawText+' '+recoveredReading.rawText;
                  const isKplus=isKPlusPaymentForOcrRecovery(kplusText);
                  if(isKplus&&firstReading.amountSatang===null&&recoveredReading.amountSatang===null&&
                    !reading.warnings.some(w=>w.includes('ขัดแย้ง')||w.includes('ต่างกัน'))){
                    const region=findKPlusAmountCrop(retry.data.blocks,enhanced.width,enhanced.height);
                    if(region){
                      const crop=prepareKPlusAmountCrop(enhanced,region);
                      await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK});
                      const focused=await withOcrDeadline(
                        worker.recognize(crop,{}, {text:true,blocks:true}),
                        OCR_PASS_TIMEOUT_MS,'อ่านจำนวนเงินเฉพาะจุด '
                      );
                      const parsed=parseSlipText(focused.data.text,receiptLayoutLines(focused.data.blocks));
                      // Require a confidently legible, explicitly labelled
                      // amount inside the bounded crop. No fee/reference guesses.
                      const hasPaidLabel=/(?:จำนวน(?:\s*เงิน)?|ยอด(?:เงิน|โอน|ชำระ|จ่าย))\s*[:：]?/iu.test(focused.data.text);
                      const hasConflict=parsed.warnings.some(w=>w.includes('ขัดแย้ง'));
                      if(parsed.amountSatang!==null&&hasPaidLabel&&!hasConflict&&
                        !isLowOcrConfidence(focused.data.confidence)){
                        reading={...reading,amountSatang:parsed.amountSatang,
                          warnings:reading.warnings.filter(w=>!w.includes('อ่านจำนวนเงินไม่ได้'))};
                      }
                    }
                  }
                  // Targeted Thai/English beneficiary OCR is needed only if both
                  // independent full-page passes failed to read the recipient.
                  // The sender account and payment label must bound the region.
                  // A conflicting name is never overwritten by focused OCR.
                  if(isKplus&&firstReading.recipient===null&&recoveredReading.recipient===null&&
                    reading.recipient===null&&!reading.warnings.some(w=>w.includes('ขัดแย้ง')||w.includes('ต่างกัน'))){
                    const recipientRegion=findKPlusRecipientCrop(retry.data.blocks,enhanced.width,enhanced.height);
                    if(recipientRegion){
                      const crop=prepareKPlusRecipientCrop(enhanced,recipientRegion);
                      await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK});
                      const focused=await withOcrDeadline(
                        worker.recognize(crop,{}, {text:true,blocks:true}),
                        OCR_PASS_TIMEOUT_MS,'อ่านชื่อผู้รับเฉพาะจุด '
                      );
                      const payee=parseKPlusRecipientRegion(focused.data.text);
                      if(payee&&!isLowOcrConfidence(focused.data.confidence)){
                        const identity=ownerNames.length
                          ?classifyByAccountNames({sender:reading.sender??null,recipient:payee},ownerNames)
                          :null;
                        const direction=identity?identity.direction:(reading.direction??'expense');
                        const reason=identity?identity.directionReason:
                          (reading.directionReason.includes('ทั้งเงินเข้าและเงินออก')
                            ?reading.directionReason:'สลิป K PLUS ระบุบัญชีผู้โอนและผู้รับชัดเจน (รายจ่ายของผู้โอน)');
                        const receipt=reading.amountSatang!==null?{
                          source:'kplus' as const,items:[],itemsComplete:true,
                          paidSatang:reading.amountSatang,
                          ...(reading.receipt?.receiptId?{receiptId:reading.receipt.receiptId}:{}),
                          storeName:payee,
                        }:reading.receipt;
                        reading={...reading,recipient:payee,direction,directionReason:reason,receipt,
                          warnings:reading.warnings.filter(w=>!w.includes('อ่านชื่อผู้รับไม่ได้'))};
                      }
                    }
                  }
                }
              }catch(error){
                // A decode/enhancement failure can keep the first reading, but a
                // stuck WASM recognition must stop the worker before next image.
                if(error instanceof OcrDeadlineError)throw error;
              }
            }
            if(!mountedRef.current||stopRef.current)break;
            if(requiresLowConfidenceReview(firstReading,recoveredReading,
              initial.data.confidence,recoveredConfidence)){
              reading.warnings.push('OCR ความมั่นใจต่ำและยังยืนยันข้อมูลได้ไม่ครบ กรุณาตรวจจากภาพก่อนบันทึก');
            }
            reading.imageHash=hash;
            setStage('save');
            const outcome=await onApply(reading);
            if(outcome.status==='incomplete'&&reading.amountSatang===null){
              const detail=describeMissingSlipAmount(firstReading,recoveredReading);
              outcome.reason=detail+(outcome.reason?' · '+outcome.reason:'');
            }
            // Persist unresolved OCR immediately, even if the user closes the scanner.
            // Store structured fields only: never the image or raw OCR text.
            if(outcome.status==='incomplete'){
              try{
                const queued=await onQueuePending(reading,file.name,outcome.reason||'อ่านข้อมูลไม่ครบ');
                outcome.pendingId=queued.id;
              }catch(error){
                outcome.reason=(outcome.reason||'ต้องตรวจข้อมูล')+' · เก็บรายการรอตรวจในเครื่องไม่สำเร็จ: '+
                  (error instanceof Error?error.message:'โปรดลองใหม่');
              }
            }
            publish({name:file.name,...outcome,recipient:outcome.recipient||reading.recipient||undefined,
              amountSatang:outcome.amountSatang||reading.amountSatang||undefined,
              date:outcome.date||reading.date||undefined,direction:outcome.direction||reading.direction||undefined,
              details:{
                sender:reading.sender||undefined,senderBank:reading.senderBank||undefined,
                recipientBank:reading.recipientBank||undefined,
                reference:reading.reference||reading.receipt?.receiptId||undefined,
                time:reading.timeWithSeconds||reading.time||undefined,
                reportedStatus:reading.reportedStatus||undefined,
              }});
            if(outcome.status==='incomplete'){
              // Keep the photo only in volatile browser memory for same-session
              // review. Do not persist or send it through the API.
              reviewImageUrlsRef.current[i]=URL.createObjectURL(ocrFile);
              attention[i]=toCorrection(reading);
              setCorrections({...attention});
            }
          }catch(err){
            if(stopRef.current)break;
            publish({name:file.name,status:'error',reason:err instanceof Error?err.message:'ประมวลผลภาพไม่สำเร็จ'});
            // Do not reuse an OCR worker whose recognition deadline expired.
            if(err instanceof OcrDeadlineError){stopRef.current=true;break;}
          }
        }
      }else{
        for(const file of selected)publish({name:file.name,status:'error',reason:validateSlipImage(file)||'ไม่สามารถอ่านไฟล์ได้'});
      }
    }catch(err){
      if(!stopRef.current){
        for(const file of selected.slice(processed.length))
          publish({name:file.name,status:'error',reason:err instanceof Error?err.message:'เริ่มต้น OCR ไม่สำเร็จ'});
      }
    }finally{
      if(stopRef.current){
        for(const file of selected.slice(processed.length))publish({name:file.name,status:'cancelled',reason:'ยังไม่ได้อ่านหรือบันทึก'});
      }
      for(const file of overflow)publish({name:file.name,status:'error',reason:'ครั้งละไม่เกิน 20 รูป กรุณาแบ่งเลือกเป็นชุด'});
      if(worker){
        try{await worker.terminate();}catch{/* The component may already have unmounted. */}
        workerRef.current=null;
      }
      // Retain the latest in-memory object URL for the result screen; revoke when
      // the next batch begins or the scanner unmounts. Never persist the image.
      runningRef.current=false;
      if(mountedRef.current){
        setBusy(false);onBusyChange(false);setComplete(true);
        onComplete(summarizeSlipBatch(processed));
      }
    }
  };
  const scan=async(e:ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(e.currentTarget.files||[]);
    e.currentTarget.value='';
    await scanFiles(files);
  };
  const pasteFromShortcuts=async()=>{
    if(runningRef.current)return;
    setClipboardError('');
    const clipboard=navigator.clipboard;
    if(!clipboard?.read){
      setClipboardError('เบราว์เซอร์นี้ไม่รองรับการวางรูป กรุณาใช้ปุ่มเลือกรูปจาก iPhone');
      return;
    }
    try{
      // Invoke read directly from the tap so iOS can grant paste permission.
      const files=await clipboardSlipFiles(()=>clipboard.read());
      await scanFiles(files);
    }catch(err){
      setClipboardError(err instanceof Error&&err.name==='NotAllowedError'
        ?'กรุณาอนุญาตให้ Money Tracker วางรูปจาก Clipboard แล้วกดอีกครั้ง'
        :err instanceof Error?err.message:'ไม่สามารถวางภาพได้ กรุณาเลือกรูปจาก iPhone');
    }
  };
  const saveCorrection=async(index:number)=>{
    const draft=corrections[index];
    if(!draft||fixingIndex!==null||undoing)return;
    if(!draft.direction){
      setCorrectionErrors(previous=>({...previous,[index]:'กรุณาเลือกว่าเป็นรายรับหรือรายจ่ายก่อนบันทึก'}));
      return;
    }
    const amountSatang=toSatang(draft.amount);
    if(!amountSatang||!draft.recipient.trim()||!draft.date||!draft.time){
      setCorrectionErrors(previous=>({...previous,[index]:'กรุณาระบุวันที่ เวลา จำนวนเงิน และชื่อผู้รับให้ครบ'}));
      return;
    }
    setFixingIndex(index);
    try{
      // A person explicitly confirms these fields. Unreconciled line items
      // must be omitted rather than saved as verified receipt details.
      const receipt=draft.source.receipt;
      const keepReceipt=!!receipt&&receipt.itemsComplete&&receipt.paidSatang===amountSatang&&!receiptReconciliationError(receipt);
      const corrected:SlipFields={
        ...draft.source,amountSatang,date:draft.date,time:draft.time,recipient:draft.recipient.trim(),
        direction:draft.direction,directionReason:'ผู้ใช้ตรวจและยืนยันข้อมูลจากสลิป',
        method:draft.method,category:draft.category,
        source:keepReceipt?draft.source.source:undefined,
        receipt:keepReceipt?receipt:undefined,
        warnings:[],
      };
      const outcome=await onApply(corrected);
      if(outcome.status==='incomplete'||outcome.status==='error'){
        setCorrectionErrors(previous=>({...previous,[index]:outcome.reason||'ยังไม่สามารถบันทึกได้'}));
        return;
      }
      const next=rows.map((row,i)=>i===index?{
        ...row,...outcome,pendingId:undefined,recipient:corrected.recipient||undefined,
        amountSatang:corrected.amountSatang||undefined,date:corrected.date||undefined,direction:corrected.direction||undefined,
      }:row);
      if(rows[index]?.pendingId){
        try{await onResolvePending(rows[index].pendingId!);}
        catch(error){setCorrectionErrors(previous=>({...previous,[-1]:
          'บันทึกรายการสำเร็จแล้ว แต่ลบออกจากคิวรอตรวจไม่สำเร็จ: '+
          (error instanceof Error?error.message:'โปรดลองใหม่')}));}
      }
      setRows(next);
      setCorrections(previous=>{const updated={...previous};delete updated[index];return updated;});
      onComplete(summarizeSlipBatch(next));
    }catch(err){
      setCorrectionErrors(previous=>({...previous,[index]:err instanceof Error?err.message:'บันทึกไม่สำเร็จ'}));
    }finally{setFixingIndex(null);}
  };
  const excludeWallet=async(index:number)=>{
    const draft=corrections[index];
    if(!draft||!isWalletFundingSlip(draft.source)||busy||undoing)return;
    if(rows[index]?.pendingId){
      try{await onResolvePending(rows[index].pendingId!);}
      catch(error){setCorrectionErrors(previous=>({...previous,[index]:
        error instanceof Error?error.message:'ไม่สามารถลบรายการจากคิวรอตรวจ'}));return;}
    }
    const next=rows.map((row,i)=>i===index?{
      ...row,status:'excluded' as const,
      reason:'โอนเงินระหว่างบัญชีของตัวเอง — ไม่นับเป็นรายรับหรือรายจ่าย',
    }:row);
    setRows(next);
    setCorrections(previous=>{const updated={...previous};delete updated[index];return updated;});
    onComplete(summarizeSlipBatch(next));
  };
  const undoSaved=async()=>{
    const ids=rows.filter(row=>row.status==='saved'&&row.transactionId).map(row=>row.transactionId!);
    if(!ids.length||undoing)return;
    if(!window.confirm(`ลบรายการที่เพิ่งบันทึก ${ids.length} รายการออกจากสมุดบัญชีหรือไม่?`))return;
    setUndoing(true);onBusyChange(true);
    try{
      await onUndoBatch(ids);
      const next=rows.map(row=>row.status==='saved'?{...row,status:'undone' as const,transactionId:undefined}:row);
      setRows(next);onComplete(summarizeSlipBatch(next));
    }catch(err){
      setCorrectionErrors(previous=>({...previous,[-1]:err instanceof Error?err.message:'ยกเลิกรายการไม่สำเร็จ'}));
    }finally{setUndoing(false);onBusyChange(false);}
  };
  const summary=summarizeSlipBatch(rows);
  const savedTotals=savedSlipTotals(rows);
  const needsAttention=Object.entries(corrections).filter(([index])=>rows[Number(index)]?.status==='incomplete');
  return <section className="slip-panel slip-panel-primary slip-workspace" aria-label="อัปโหลดสลิปหรือใบเสร็จหลายรูป">
    <div className="slip-head"><div><ScanLine size={18}/><strong>เพิ่มสลิปหรือใบเสร็จ</strong></div></div>
    {!busy&&!complete&&<p className="slip-hint">อ่านข้อมูลและบันทึกอัตโนมัติ หากอ่านไม่ครบจะแจ้งให้ตรวจ</p>}
    {!busy&&(!complete||needsAttention.length===0)&&<div className="slip-upload-box">
      <div className="slip-upload-icon" aria-hidden="true"><img className="reference-slip-art" src={slipArt} alt=""/></div>
      <strong>{complete?'เพิ่มรูปอีกชุด':'เลือกรูปสลิป'}</strong>
      <span>เลือกรูปได้สูงสุด 20 รูป</span>
      <div className="slip-actions"><button type="button" className="btn btn-primary" disabled={undoing||needsAttention.length>0} onClick={()=>cameraRef.current?.click()}><Camera size={18}/> ถ่ายรูป</button><button type="button" className="btn btn-secondary slip-pick" disabled={undoing||needsAttention.length>0} onClick={()=>galleryRef.current?.click()}><Upload size={18}/> เลือกรูป</button></div><details className="slip-more-options"><summary>นำเข้ารูปด้วยวิธีอื่น</summary><button type="button" className="btn btn-secondary" disabled={undoing||needsAttention.length>0} onClick={()=>void pasteFromShortcuts()}><ClipboardPaste size={18}/> วางรูปที่คัดลอก</button><small>รองรับ JPG, PNG, WebP, HEIC ขนาดไม่เกิน 10 MB ต่อรูป</small></details>
      {needsAttention.length>0&&<p className="slip-awaiting-review" role="status">รอตรวจ {needsAttention.length} รายการ · ยังไม่รวมในยอดเงิน</p>}
      {clipboardError&&<p className="slip-warning" role="alert">{clipboardError}</p>}
    </div>}
    <input ref={galleryRef} aria-label="เลือกรูปสลิปหลายรูป" multiple type="file" className="visually-hidden" accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif" onChange={e=>void scan(e)}/>
    <input ref={cameraRef} aria-label="ถ่ายรูปสลิป" type="file" className="visually-hidden" accept="image/*" capture="environment" onChange={e=>void scan(e)}/>
    {busy&&<div className="slip-batch-progress slip-processing-focus" role="status" aria-live="polite">
      <div className="slip-processing-icon"><LoaderCircle size={30}/></div>
      <strong>กำลังอ่านสลิป {activeIndex||1} / {totalFiles}</strong>
      <p>{stopRequested?'กำลังหยุดหลังขั้นตอนปัจจุบัน…':stage==='save'?'กำลังตรวจรายการซ้ำและบันทึก…':stage==='retry'?'กำลังปรับภาพและอ่านซ้ำ…':stage==='recognize'?'กำลังอ่านข้อมูลจากสลิป '+progress+'%':'กำลังเตรียมภาพและระบบ OCR…'}</p>
      <div className="slip-progress-track" role="progressbar" aria-label="ความคืบหน้า OCR" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((Math.max(0,activeIndex-1)+progress/100)/Math.max(1,totalFiles)*100)}><div style={{width:String(Math.round((Math.max(0,activeIndex-1)+(progress/100))/Math.max(1,totalFiles)*100))+'%'}}/></div>
      <span>{summary.saved} บันทึกแล้ว · {summary.duplicate} ซ้ำ · {summary.incomplete} รอตรวจ · {summary.errors} อ่านไม่สำเร็จ</span>
      <button type="button" className="btn btn-secondary slip-stop" disabled={stopRequested} onClick={()=>{stopRef.current=true;setStopRequested(true);
        // Tesseract calls may be CPU-bound; terminating the worker interrupts
        // an in-flight recognition rather than waiting for the next image.
        if(workerRef.current)void workerRef.current.terminate().catch(()=>{});
      }}><Square size={16}/> {stopRequested?'กำลังหยุด…':'หยุดรูปที่เหลือ'}</button>
    </div>}
    {preview&&(busy||complete)&&<figure className="slip-preview ref-ocr-evidence"><img src={preview} alt={busy?'รูปสลิปที่กำลังประมวลผล':'รูปสลิปใบล่าสุดของชุดที่เลือก'}/><figcaption>{filename} · แสดงเฉพาะระหว่างเปิดหน้านี้ ไม่เก็บรูปถาวร</figcaption></figure>}
    {complete&&<div className={'slip-batch-summary ref-ocr-results'+(summary.incomplete+summary.errors>0?' requires-review':'')} role="status" aria-live="polite">
      <div className="slip-batch-summary-title">{summary.incomplete+summary.errors>0?<AlertTriangle size={18}/>:<CheckCircle2 size={18}/>}<strong>{slipBatchHeading(summary)}</strong></div>
      <div className="slip-batch-counts"><span>บันทึกแล้ว<b>{summary.saved}</b></span><span>ซ้ำ<b>{summary.duplicate}</b></span><span>รอตรวจ<b>{summary.incomplete}</b></span><span>อ่านไม่สำเร็จ<b>{summary.errors}</b></span>{(summary.excluded||0)>0&&<span>ไม่นับรายการ<b>{summary.excluded}</b></span>}</div>
       <p className="slip-batch-note">บันทึกแล้ว: อยู่ในรายการ · ซ้ำ: ไม่เพิ่มรายการใหม่ · รอตรวจ: ยังไม่รวมยอดเงิน</p>
      {summary.saved>0&&<div className="slip-batch-totals" aria-label="ยอดที่บันทึกแยกประเภทรายการ">
        <div className="slip-batch-total"><span>รายรับที่บันทึก</span><strong>฿{baht(savedTotals.incomeSatang)}</strong></div>
        <div className="slip-batch-total"><span>รายจ่ายที่บันทึก</span><strong>฿{baht(savedTotals.expenseSatang)}</strong></div>
        {savedTotals.unknownSatang>0&&<div className="slip-batch-total"><span>ยอดที่ยังไม่แยกประเภท</span><strong>฿{baht(savedTotals.unknownSatang)}</strong></div>}
      </div>}
      {summary.errors>0&&<p className="slip-batch-note" role="note">มี {summary.errors} รูปที่ยังอ่านหรือบันทึกไม่สำเร็จ กรุณาลองเพิ่มรูปนั้นอีกครั้ง โดยเริ่มครั้งละ 1 รูป</p>}
      {(summary.cancelled||0)>0&&<p className="slip-batch-note">ยกเลิกไป {summary.cancelled} รูป รายการที่บันทึกสำเร็จก่อนหยุดยังอยู่ในแอป</p>}
      {(summary.undone||0)>0&&<p className="slip-batch-note">ยกเลิกการบันทึกแล้ว {summary.undone} รายการ</p>}
      {summary.saved>0&&<button type="button" className="btn btn-secondary slip-undo" disabled={undoing} onClick={()=>void undoSaved()}><Undo2 size={16}/>{undoing?'กำลังยกเลิกรายการ…':'ลบรายการที่เพิ่งบันทึก ('+summary.saved+')'}</button>}
      {correctionErrors[-1]&&<p role="alert" className="error-message">{correctionErrors[-1]}</p>}
      {summary.queued>0&&<p className="slip-queued-note" role="status">เก็บรอตรวจ {summary.queued} รูป · กลับมาตรวจได้จากหน้ารายการ โปรดเก็บรูปต้นฉบับไว้ใน Photos</p>}
      {summary.saved>0&&summary.incomplete===summary.queued&&<button type="button" className={'btn '+(needsAttention.length>0?'btn-secondary':'btn-primary')+' slip-batch-finish'} onClick={()=>onViewSaved(rows.find(row=>row.status==='saved')?.date||'')}>ดูรายการที่บันทึก</button>}
      {needsAttention.length>0&&<button type="button" className="btn btn-primary slip-batch-finish" onClick={()=>attentionRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}>ตรวจ {needsAttention.length} รายการที่ยังไม่บันทึก</button>}
      <button type="button" className={'btn '+(needsAttention.length>0?'btn-secondary':'btn-primary')+' slip-batch-finish'} disabled={undoing} onClick={onClose}>{needsAttention.length>0?'ปิดและตรวจภายหลัง':'เสร็จสิ้น'}</button>
    </div>}
    {rows.length>0&&<div className="slip-batch-results" aria-label="ผลการประมวลผลแต่ละรูป">
      <strong>ผลของแต่ละสลิป</strong>
      <ul>{rows.map((row,i)=><li key={i+'-'+row.name} className="slip-result-row">
        <span className="slip-result-main"><span className="slip-batch-file">{row.recipient||row.name}</span>{row.date&&<small>{row.date}</small>}</span>
        {row.amountSatang!==undefined&&<b className={'slip-result-amount '+(row.direction==='expense'?'negative':row.direction==='income'?'positive':'')}>{row.direction==='expense'?'−':row.direction==='income'?'+':''}฿{baht(row.amountSatang)}</b>}
        <span className={'slip-batch-status '+row.status}>{statusLabels[row.status]}</span>
        {row.reason&&row.status!=='saved'&&<small className="slip-result-reason">{row.reason}</small>}
        {row.details&&<details className="slip-check-details"><summary>ดูข้อมูลที่อ่านได้จากสลิป</summary>
          <dl>
            {row.details.reportedStatus&&<div><dt>สถานะที่พิมพ์ในสลิป</dt><dd>{row.details.reportedStatus}<small>เป็นข้อความจากภาพ ไม่ใช่ผลยืนยันกับธนาคาร</small></dd></div>}
            {row.details.sender&&<div><dt>ชื่อผู้โอน</dt><dd>{row.details.sender}</dd></div>}
            {row.details.senderBank&&<div><dt>โอนจาก</dt><dd>{row.details.senderBank}</dd></div>}
            {row.recipient&&<div><dt>ชื่อผู้รับ</dt><dd>{row.recipient}</dd></div>}
            {row.details.recipientBank&&<div><dt>โอนถึง</dt><dd>{row.details.recipientBank}</dd></div>}
            {row.details.reference&&<div><dt>เลขอ้างอิง</dt><dd>{row.details.reference}</dd></div>}
            {row.date&&<div><dt>วันที่</dt><dd>{row.date}</dd></div>}
            {row.details.time&&<div><dt>เวลา</dt><dd>{row.details.time}{row.details.time.length===8&&<small>ในสมุดบัญชีบันทึกเวลาถึงระดับนาที</small>}</dd></div>}
            <div><dt>ผลของ Money Tracker</dt><dd>{statusLabels[row.status]}{row.direction?' · '+(row.direction==='expense'?'รายจ่าย':'รายรับ'):' · ยังไม่สรุปรายรับรายจ่าย'}</dd></div>
          </dl>
        </details>}
        {row.status==='incomplete'&&corrections[i]&&<button type="button" className="slip-result-fix" onClick={()=>focusReview(i)}>ตรวจยอดเงินจากสลิป <Check size={16}/></button>}
      </li>)}</ul>
    </div>}
    {needsAttention.length>0&&<div ref={attentionRef} className="slip-attention" aria-label="แก้ไขสลิปที่อ่านไม่ครบ">
      <div className="slip-attention-title"><ScanLine size={19}/><strong>ข้อมูลที่อ่านได้จากสลิป · โปรดตรวจสอบ</strong></div>
      <p>ตรวจวันที่ ยอดเงิน และประเภทรายการก่อนบันทึก หรือกลับมาที่ “รายการ → รอตรวจจากสลิป” (กรุณาเก็บรูปต้นฉบับไว้ เพราะระบบไม่เก็บรูปสำหรับดูภายหลัง)</p>
      {needsAttention.map(([rawIndex,draft])=>{
        const index=Number(rawIndex);
        return <div id={'slip-review-'+index} key={rawIndex} className="slip-attention-card">
          <strong>{rows[index]?.name||'ใบเสร็จ'}</strong>
          {rows[index]?.pendingId&&<p className="slip-queued-inline">เก็บเฉพาะข้อมูลรายการไว้ในเครื่องแล้ว · กลับมาตรวจภายหลังได้</p>}
          {reviewImageUrlsRef.current[index]&&<details className="slip-evidence" open><summary>ภาพสลิปต้นฉบับ · แตะเพื่อย่อ/ขยาย</summary><img src={reviewImageUrlsRef.current[index]} alt={'ภาพสลิป '+(rows[index]?.name||'ที่รอตรวจ')+' สำหรับตรวจยอดจากต้นฉบับ'} loading="lazy"/><small>แสดงเฉพาะระหว่างเปิดหน้านี้ · ไม่เก็บภาพถาวร</small></details>}
          {isTrueMoneyBankTopUp(draft.source)&&<div className="slip-wallet-guidance" role="note"><AlertTriangle size={17}/><span>ระบบจัดการเติมเงิน TrueMoney เป็นรายจ่ายจาก K PLUS ให้อัตโนมัติแล้ว รายการนี้ยังรอตรวจเพราะข้อมูล OCR บางส่วนขาดหรือขัดแย้งกัน โปรดตรวจข้อมูลให้ครบก่อนบันทึกและอย่านับการใช้เงินจาก Wallet ซ้ำ</span></div>}
          {isWalletFundingSlip(draft.source)&&<div className="slip-wallet-guidance" role="note"><AlertTriangle size={17}/><span>สลิปนี้อาจเป็นการย้ายเงินระหว่างกระเป๋าของตัวเอง หากไม่ต้องการนับเป็นรายจ่าย ให้เลือก “ไม่นับรายการนี้”</span></div>}
          <div className="slip-attention-fields">
            <label><span className="slip-field-title"><Wallet size={16}/> จำนวนเงิน (บาท)</span><input inputMode="decimal" value={draft.amount} onChange={e=>changeCorrection(index,{amount:e.target.value})} placeholder="0.00"/></label>
            <label><span className="slip-field-title"><Tag size={16}/> ประเภท (ต้องเลือก)</span><select required value={draft.direction} onChange={e=>changeCorrection(index,{direction:e.target.value as EntryType,category:'อื่น ๆ'})}><option value="" disabled>เลือกประเภทรายการ</option><option value="expense">เงินออก / รายจ่าย</option><option value="income">เงินเข้า / รายรับ</option></select></label>
            <label><span className="slip-field-title"><CalendarDays size={16}/> วันที่</span><input type="date" value={draft.date} onChange={e=>changeCorrection(index,{date:e.target.value})}/></label>
            <label><span className="slip-field-title"><Clock3 size={16}/> เวลา</span><input type="time" value={draft.time} onChange={e=>changeCorrection(index,{time:e.target.value})}/></label>
            <label className="slip-attention-wide"><span className="slip-field-title"><UserRound size={16}/> ชื่อผู้รับตามสลิป / ร้านค้า</span><input value={draft.recipient} maxLength={160} onChange={e=>changeCorrection(index,{recipient:e.target.value})}/></label>
            {draft.source.sender&&<p className="slip-ocr-party-hint slip-attention-wide">ชื่อผู้โอนที่ OCR อ่านได้: {draft.source.sender}</p>}
            {draft.direction&&<label className="slip-attention-wide"><span className="slip-field-title"><Tag size={16}/> หมวดหมู่</span><select value={draft.category} onChange={e=>changeCorrection(index,{category:e.target.value})}>{(draft.direction==='income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES).map(category=><option key={category} value={category}>{category}</option>)}</select></label>}
          </div>
          {correctionErrors[index]&&<p className="error-message" role="alert">{correctionErrors[index]}</p>}
          <button type="button" className="btn btn-primary slip-correct-save" disabled={fixingIndex!==null||busy} onClick={()=>void saveCorrection(index)}><Check size={16}/>{fixingIndex===index?'กำลังบันทึก…':'บันทึกข้อมูลที่ตรวจแล้ว'}</button>
          {isWalletFundingSlip(draft.source)&&<button type="button" className="btn btn-ghost slip-wallet-exclude" disabled={fixingIndex!==null||busy} onClick={()=>void excludeWallet(index)}>ไม่นับรายการนี้ (โอนเงินระหว่างบัญชีตัวเอง)</button>}
        </div>;
      })}
    </div>}
    <p className="slip-privacy"><ShieldCheck size={14}/> อ่านรูปบนเครื่องและไม่เก็บภาพสลิป</p>
  </section>;
}

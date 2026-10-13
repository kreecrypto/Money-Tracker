import {useEffect,useRef,useState,type ChangeEvent} from 'react';
import {Camera,CheckCircle2,FileImage,ScanLine,ShieldCheck,Upload,X} from 'lucide-react';
import {parseSlipText,mergeSlipOcrReadings,needsSlipOcrRecovery,type SlipFields} from './lib/slip';
import {prepareSlipRecoveryImage} from './lib/slipImage';
import {receiptLayoutLines} from './lib/receiptIntelligence';
import {
  MAX_SLIP_BATCH_FILES,summarizeSlipBatch,validateSlipImage,
  type SlipBatchOutcome,type SlipBatchRow,
} from './lib/slipBatch';

type BatchSummary=ReturnType<typeof summarizeSlipBatch>;
type Props={
  onApply:(data:SlipFields)=>Promise<SlipBatchOutcome>;
  onComplete:(summary:BatchSummary)=>void;
  onBusyChange:(busy:boolean)=>void;
  onClose:()=>void;
};
type ProcessingStage='download'|'recognize'|'retry'|'save';
const statusLabels:Record<SlipBatchRow['status'],string>={
  saved:'บันทึกแล้ว',duplicate:'ข้าม (รายการซ้ำ)',incomplete:'อ่านไม่ครบ',error:'ไม่สำเร็จ',
};

export default function SlipScanner({onApply,onComplete,onBusyChange,onClose}:Props){
  const galleryRef=useRef<HTMLInputElement>(null);
  const cameraRef=useRef<HTMLInputElement>(null);
  const workerRef=useRef<{terminate:()=>Promise<unknown>}|null>(null);
  const previewUrlRef=useRef<string|null>(null);
  const mountedRef=useRef(true);
  const runningRef=useRef(false);
  const [preview,setPreview]=useState<string|null>(null);
  const [filename,setFilename]=useState('');
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(0);
  const [stage,setStage]=useState<ProcessingStage>('download');
  const [activeIndex,setActiveIndex]=useState(0);
  const [totalFiles,setTotalFiles]=useState(0);
  const [rows,setRows]=useState<SlipBatchRow[]>([]);
  const [complete,setComplete]=useState(false);
  useEffect(()=>{
    mountedRef.current=true;
    return ()=>{
      mountedRef.current=false;
      if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);
      if(workerRef.current)void workerRef.current.terminate().catch(()=>{});
    };
  },[]);

  const showPreview=(file:File)=>{
    const url=URL.createObjectURL(file);
    if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current=url;
    setPreview(url);
    setFilename(file.name);
  };
  const clearPreview=()=>{
    if(previewUrlRef.current)URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current=null;
    setPreview(null);
  };

  const scan=async(e:ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(e.currentTarget.files||[]);
    e.currentTarget.value=''; // Allows selecting the same photos again after a failed batch.
    if(!files.length||runningRef.current)return;
    runningRef.current=true;
    setBusy(true);onBusyChange(true);
    setRows([]);setComplete(false);setProgress(0);setStage('download');
    setActiveIndex(0);setTotalFiles(files.length);clearPreview();

    const processed:SlipBatchRow[]=[];
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
        worker=await createWorker(['tha','eng'],1,{
          logger:message=>{
            if(mountedRef.current&&message.status==='recognizing text'){
              setStage(current=>current==='retry'?'retry':'recognize');
              setProgress(Math.round((message.progress||0)*100));
            }
          },
        });
        if(!mountedRef.current)return;
        workerRef.current=worker;
        for(let i=0;i<selected.length;i++){
          if(!mountedRef.current)break;
          const file=selected[i];
          setActiveIndex(i+1);setStage('recognize');setProgress(0);
          const invalid=validateSlipImage(file);
          if(invalid){publish({name:file.name,status:'error',reason:invalid});continue;}
          try{
            showPreview(file);
            await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO});
            const initial=await worker.recognize(file,{}, {text:true,blocks:true});
            let reading=parseSlipText(initial.data.text,receiptLayoutLines(initial.data.blocks));
            if(needsSlipOcrRecovery(reading)&&mountedRef.current){
              setStage('retry');setProgress(0);
              try{
                const enhanced=await prepareSlipRecoveryImage(file);
                if(mountedRef.current){
                  await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
                  const retry=await worker.recognize(enhanced,{}, {text:true,blocks:true});
                  reading=mergeSlipOcrReadings(reading,parseSlipText(retry.data.text,receiptLayoutLines(retry.data.blocks)));
                }
              }catch{
                // Recovery failure must not prevent the next image from being processed.
              }
            }
            if(!mountedRef.current)break;
            setStage('save');
            const outcome=await onApply(reading);
            publish({name:file.name,...outcome});
          }catch(err){
            publish({name:file.name,status:'error',reason:err instanceof Error?err.message:'ประมวลผลภาพไม่สำเร็จ'});
          }
        }
      }else{
        for(const file of selected)
          publish({name:file.name,status:'error',reason:validateSlipImage(file)||'ไม่สามารถอ่านไฟล์ได้'});
      }
    }catch(err){
      // A worker init error affects all remaining files, not prior saved records.
      for(const file of selected.slice(processed.length))
        publish({name:file.name,status:'error',reason:err instanceof Error?err.message:'เริ่มต้น OCR ไม่สำเร็จ'});
    }finally{
      for(const file of overflow)
        publish({name:file.name,status:'error',reason:'ครั้งละไม่เกิน 20 รูป กรุณาแบ่งเลือกเป็นชุด'});
      if(worker){
        try{await worker.terminate();}catch{/* unmounted worker may already be terminated */}
        workerRef.current=null;
      }
      clearPreview();
      runningRef.current=false;
      if(mountedRef.current){
        setBusy(false);onBusyChange(false);setComplete(true);
        const summary=summarizeSlipBatch(processed);
        onComplete(summary);
      }
    }
  };

  const summary=summarizeSlipBatch(rows);
  return <section className="slip-panel slip-panel-primary" aria-label="อัปโหลดสลิปหรือใบเสร็จหลายรูป">
    <div className="slip-head"><div><ScanLine size={18}/><strong>อัปโหลดสลิป / ใบเสร็จ</strong></div><button type="button" className="slip-close" disabled={busy} onClick={onClose} aria-label="กลับไปกรอกข้อมูลเอง"><X size={18}/></button></div>
    <p className="slip-hint">เลือกได้หลายรูปในครั้งเดียว รองรับ K PLUS, 7-Eleven/7Delivery และเป๋าตัง ระบบจะอ่านและบันทึกแต่ละรูปให้อัตโนมัติ โดยข้ามรายการซ้ำหรือภาพที่อ่านไม่ครบ</p>
    <div className="slip-upload-box">
      <div className="slip-upload-icon" aria-hidden="true"><FileImage size={28}/></div>
      <strong>เลือกหลายรูปเพื่อบันทึกทีเดียว</strong>
      <span>สูงสุด 20 รูป/ครั้ง · JPG, PNG, WebP · ไม่เกิน 10 MB/รูป</span>
      <div className="slip-actions"><button type="button" className="btn btn-primary slip-pick" disabled={busy} onClick={()=>galleryRef.current?.click()}><Upload size={18}/> เลือกภาพสลิป</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>cameraRef.current?.click()}><Camera size={18}/> ถ่ายรูป</button></div>
    </div>
    <input ref={galleryRef} aria-label="เลือกรูปสลิปหลายรูป" multiple type="file" className="visually-hidden" accept="image/png,image/jpeg,image/webp" onChange={e=>void scan(e)}/>
    <input ref={cameraRef} aria-label="ถ่ายรูปสลิป" type="file" className="visually-hidden" accept="image/*" capture="environment" onChange={e=>void scan(e)}/>
    {busy&&<div className="slip-batch-progress" role="status" aria-live="polite">
      <div className="slip-batch-counter"><strong>กำลังประมวลผลรูปที่ {activeIndex||1}/{totalFiles}</strong><span>{summary.saved} บันทึก · {summary.duplicate} ซ้ำ · {summary.incomplete+summary.errors} ไม่สำเร็จ</span></div>
      <div className="slip-progress-track"><div style={{width:String(Math.round((Math.max(0,activeIndex-1)+(progress/100))/Math.max(1,totalFiles)*100))+'%'}}/></div>
      <span className="slip-batch-stage">{stage==='save'?'กำลังบันทึกธุรกรรม…':stage==='retry'?'กำลังปรับภาพและอ่านซ้ำ…':stage==='recognize'?'อ่าน OCR '+progress+'%':'กำลังโหลดชุด OCR ภาษาไทย/อังกฤษ…'}</span>
    </div>}
    {busy&&preview&&<figure className="slip-preview"><img src={preview} alt="รูปสลิปที่กำลังประมวลผล"/><figcaption>{filename}</figcaption></figure>}
    {complete&&<div className="slip-batch-summary" role="status" aria-live="polite">
      <div className="slip-batch-summary-title"><CheckCircle2 size={18}/><strong>ประมวลผลครบ {summary.total} รูป</strong></div>
      <div className="slip-batch-counts"><span>บันทึกสำเร็จ <b>{summary.saved}</b></span><span>รายการซ้ำ <b>{summary.duplicate}</b></span><span>อ่านไม่ครบ/ผิดพลาด <b>{summary.incomplete+summary.errors}</b></span></div>
      {summary.incomplete+summary.errors+summary.duplicate>0&&<p className="slip-batch-note">รายการที่ไม่ผ่านยังไม่ถูกบันทึก เลือกรูปใหม่หรือลองกรอกเองได้</p>}
      <button type="button" className="btn btn-secondary slip-batch-finish" onClick={onClose}>เสร็จแล้ว</button>
    </div>}
    {rows.length>0&&<div className="slip-batch-results" aria-label="ผลการประมวลผลแต่ละรูป">
      <strong>รายการแต่ละรูป</strong>
      <ul>{rows.map((row,i)=><li key={i+'-'+row.name}><span className="slip-batch-file">{row.name}</span><span className={'slip-batch-status '+row.status}>{statusLabels[row.status]}</span>{row.reason&&<small>{row.reason}</small>}</li>)}</ul>
    </div>}
    <p className="slip-privacy"><ShieldCheck size={14}/> รูปถูกอ่านในเครื่องทีละรูป ไม่อัปโหลดหรือเก็บภาพถาวร ภาพที่อ่านไม่ชัดและรายการซ้ำจะไม่ถูกบันทึก</p>
  </section>;
}

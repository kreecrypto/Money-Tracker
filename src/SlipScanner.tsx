import {useEffect,useRef,useState,type ChangeEvent} from 'react';
import {Camera,Check,FileImage,ScanLine,ShieldCheck,X} from 'lucide-react';
import {baht} from './lib/finance';
import {parseSlipText,type SlipFields} from './lib/slip';

type Props={onApply:(data:SlipFields)=>void;onClose:()=>void};
const MAX_FILE_BYTES=10*1024*1024;
const SUPPORTED_TYPES=new Set(['image/jpeg','image/png','image/webp']);

export default function SlipScanner({onApply,onClose}:Props){
  const galleryRef=useRef<HTMLInputElement>(null);
  const cameraRef=useRef<HTMLInputElement>(null);
  const workerRef=useRef<{terminate:()=>Promise<unknown>}|null>(null);
  const mountedRef=useRef(true);
  const [preview,setPreview]=useState<string|null>(null);
  const [filename,setFilename]=useState('');
  const [result,setResult]=useState<SlipFields|null>(null);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState('');
  useEffect(()=>()=>{
    mountedRef.current=false;
    if(workerRef.current)void workerRef.current.terminate().catch(()=>{});
  },[]);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);

  const scan=async(e:ChangeEvent<HTMLInputElement>)=>{
    const file=e.target.files?.[0];
    e.target.value='';
    if(!file||busy)return;
    setResult(null);setError('');setProgress(0);
    if(!SUPPORTED_TYPES.has(file.type)){setError('รองรับภาพ JPG, PNG หรือ WebP เท่านั้น หากเป็น HEIC กรุณาแปลงเป็น JPG ก่อน');return;}
    if(file.size===0||file.size>MAX_FILE_BYTES){setError('เลือกรูปขนาดไม่เกิน 10 MB');return;}
    setFilename(file.name);
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try{
      // Lazily load OCR so the initial app bundle stays small. Recognition runs locally.
      const {createWorker}=await import('tesseract.js');
      if(!mountedRef.current)return;
      const worker=await createWorker(['tha','eng'],1,{
        logger:message=>{
          if(mountedRef.current&&message.status==='recognizing text')setProgress(Math.round((message.progress||0)*100));
        },
      });
      if(!mountedRef.current){await worker.terminate();return;}
      workerRef.current=worker;
      try{
        const {data}=await worker.recognize(file);
        if(mountedRef.current)setResult(parseSlipText(data.text));
      }finally{
        workerRef.current=null;
        await worker.terminate();
      }
    }catch(err){
      if(mountedRef.current)setError(err instanceof Error?`อ่านสลิปไม่สำเร็จ: ${err.message}`:'อ่านสลิปไม่สำเร็จ กรุณาลองอีกครั้ง');
    }finally{if(mountedRef.current)setBusy(false);}
  };

  return <section className="slip-panel" aria-label="สแกนสลิปโอนเงิน">
    <div className="slip-head"><div><ScanLine size={18}/><strong>อ่านสลิปอัตโนมัติ</strong></div><button type="button" className="slip-close" onClick={onClose} aria-label="ปิดการสแกน"><X size={18}/></button></div>
    <p className="slip-hint">รองรับสลิปโอนเงินภาษาไทย/อังกฤษ ระบบจะช่วยกรอกยอดเงิน วันที่ และผู้รับ แต่ต้องตรวจความถูกต้องก่อนบันทึก</p>
    <div className="slip-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>galleryRef.current?.click()}><FileImage size={17}/> เลือกรูปสลิป</button><button type="button" className="btn btn-ghost bordered" disabled={busy} onClick={()=>cameraRef.current?.click()}><Camera size={17}/> ถ่ายรูป</button></div>
    <input ref={galleryRef} aria-label="เลือกรูปสลิป" type="file" className="visually-hidden" accept="image/png,image/jpeg,image/webp" onChange={e=>void scan(e)}/>
    <input ref={cameraRef} aria-label="ถ่ายรูปสลิป" type="file" className="visually-hidden" accept="image/*" capture="environment" onChange={e=>void scan(e)}/>
    {preview&&<figure className="slip-preview"><img src={preview} alt="ภาพสลิปที่เลือก"/><figcaption>{filename}</figcaption></figure>}
    {busy&&<div className="slip-progress" role="status" aria-live="polite"><div className="slip-progress-track"><div style={{width:`${progress}%`}}/></div><span>กำลังอ่านข้อความในรูป… {progress?`${progress}%`:'เตรียม OCR ภาษาไทย/อังกฤษ'}</span></div>}
    {error&&<p className="error-message" role="alert">{error}</p>}
    {result&&<div className="slip-result" aria-live="polite"><strong>ข้อมูลที่อ่านได้ (กรุณาตรวจทาน)</strong><dl><div><dt>จำนวนเงิน</dt><dd>{result.amountSatang!==null?`฿${baht(result.amountSatang)}`:'อ่านไม่สำเร็จ'}</dd></div><div><dt>วันที่</dt><dd>{result.date||'อ่านไม่สำเร็จ'}</dd></div><div><dt>ผู้รับ</dt><dd>{result.recipient||'ไม่พบข้อมูล'}</dd></div></dl>
      {result.warnings.map((warning,i)=><p key={i} className="slip-warning">⚠ {warning}</p>)}
      <details className="slip-raw"><summary>ดูข้อความ OCR เพื่อเทียบกับสลิป</summary><pre>{result.rawText||'ไม่มีข้อความ'}</pre></details>
      <button type="button" className="btn btn-primary slip-apply" disabled={result.amountSatang===null&&result.date===null&&result.recipient===null} onClick={()=>onApply(result)}><Check size={17}/> ใช้ข้อมูลนี้ในฟอร์ม</button>
    </div>}
    <p className="slip-privacy"><ShieldCheck size={14}/> ประมวลผลภาพในเครื่อง ไม่อัปโหลดสลิป (ครั้งแรกต้องใช้อินเทอร์เน็ตเพื่อโหลด OCR)</p>
  </section>;
}

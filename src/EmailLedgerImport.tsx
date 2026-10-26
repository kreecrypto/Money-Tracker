import {useMemo,useRef,useState} from 'react';
import {FileSpreadsheet,Upload} from 'lucide-react';
import {baht,type Transaction} from './lib/finance';
import {parseEmailLedgerCsv,partitionEmailLedger,emailLedgerCategory,type EmailLedgerParsed} from './lib/emailLedger';
import {appendEmailTransactions,loadTransactions} from './lib/storage';
import './email-ledger.css';

type Props={existing:Transaction[];onImported:()=>Promise<void>};
export default function EmailLedgerImport({existing,onImported}:Props){
  const [parsed,setParsed]=useState<EmailLedgerParsed|null>(null);
  const [filename,setFilename]=useState('');
  const [error,setError]=useState('');
  const [outcome,setOutcome]=useState('');
  const [busy,setBusy]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const partition=useMemo(()=>partitionEmailLedger(parsed?.confirmed||[],existing),[parsed,existing]);
  const total=partition.ready.reduce((sum,t)=>sum+t.amountSatang,0);
  const pick=async(file?:File)=>{
    setParsed(null);setError('');setOutcome('');setFilename('');
    if(!file)return;
    try{
      if(file.size>1_000_000||!file.name.toLowerCase().endsWith('.csv'))throw new Error('เลือกไฟล์ CSV ขนาดไม่เกิน 1 MB');
      const data=parseEmailLedgerCsv(await file.text());
      setParsed(data);setFilename(file.name);
    }catch(e){setError(e instanceof Error?e.message:'อ่านไฟล์ไม่ได้');}
    finally{if(fileRef.current)fileRef.current.value='';}
  };
  const confirm=async()=>{
    if(!parsed||busy)return;
    setBusy(true);setError('');
    try{
      const fresh=await loadTransactions();
      const eligible=partitionEmailLedger(parsed.confirmed,fresh);
      const saved=await appendEmailTransactions(eligible.ready);
      await onImported();
      setOutcome('เพิ่มรายการใหม่ '+saved.imported+' รายการ · ข้ามรายการซ้ำ/อาจซ้ำ '+(eligible.duplicates.length+saved.duplicates)+' รายการ');
      setParsed(null);
    }catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ กรุณาลองนำเข้าอีกครั้ง');}
    finally{setBusy(false);}
  };
  return <div className="email-ledger-import">
    <p>นำเข้าคำชี้แจงรายจ่ายจากไฟล์ CSV ที่แปลงจากสมุดบัญชีอีเมล ข้อมูลจะอ่านและบันทึกในอุปกรณ์นี้เท่านั้น ไม่ส่งไฟล์ไปยังเซิร์ฟเวอร์ และไม่แทนที่รายการเดิม</p>
    <label className="btn btn-secondary email-ledger-file-button" htmlFor="email-ledger-file"><Upload size={17}/> เลือกไฟล์บัญชีอีเมล (CSV)</label>
    <input ref={fileRef} id="email-ledger-file" className="visually-hidden" type="file" accept=".csv,text/csv" onChange={e=>{void pick(e.target.files?.[0]);}}/>
    {error&&<p role="alert" className="email-ledger-error">{error}</p>}
    {outcome&&<p role="status" className="email-ledger-result">{outcome}</p>}
    {parsed&&<div className="email-ledger-preview" aria-live="polite">
      <div className="email-ledger-preview-title"><FileSpreadsheet size={19}/><strong>ตรวจสอบก่อนบันทึก</strong></div>
      <small className="email-ledger-filename">{filename}</small>
      <dl className="email-ledger-summary">
        <div><dt>รายการใหม่พร้อมบันทึก</dt><dd>{partition.ready.length} รายการ</dd></div>
        <div><dt>ยอดรวมรายการใหม่</dt><dd>฿{baht(total)}</dd></div>
        <div><dt>ข้ามรายการซ้ำ/อาจซ้ำ</dt><dd>{partition.duplicates.length} รายการ</dd></div>
        <div><dt>ยังไม่ยืนยันหรือเป็นหลักฐานประกอบ</dt><dd>{parsed.excluded.length} รายการ</dd></div>
      </dl>
      <p className="email-ledger-warning">รายการไม่ยืนยันและเอกสารประกอบจะไม่ถูกรวมเป็นรายจ่าย หากพบยอด/เวลาอาจซ้ำกับรายการเดิม ระบบจะข้ามเพื่อป้องกันการนับเงินออกสองครั้ง</p>
      {partition.ready.length>0&&<div className="email-ledger-scroll">
        <ul className="email-ledger-items">{partition.ready.map(t=><li key={t.id}><div><strong>{t.recipient}</strong><span>{t.date} · {t.time} · {emailLedgerCategory(t)}</span></div><b>฿{baht(t.amountSatang)}</b></li>)}</ul>
      </div>}
      {parsed.excluded.length>0&&<details className="email-ledger-excluded"><summary>ดูรายการที่ไม่รวมยอด ({parsed.excluded.length})</summary>
        <ul>{parsed.excluded.map((x,i)=><li key={i}><strong>{x.name||x.date}</strong> · {x.status} <span>{x.reason}</span></li>)}</ul>
      </details>}
      <div className="email-ledger-actions">
        <button type="button" className="btn btn-ghost bordered" disabled={busy} onClick={()=>setParsed(null)}>ยกเลิก</button>
        <button type="button" className="btn btn-primary" disabled={busy||!partition.ready.length} onClick={()=>{void confirm();}}>
          {busy?'กำลังบันทึก...':'ยืนยันเพิ่ม '+partition.ready.length+' รายการ'}
        </button>
      </div>
    </div>}
  </div>;
}

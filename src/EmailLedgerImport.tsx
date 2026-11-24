import {useEffect,useMemo,useRef,useState} from 'react';
import {FileSpreadsheet,Upload,Mail,RefreshCw} from 'lucide-react';
import {baht,type Transaction} from './lib/finance';
import {accountantAudit} from './lib/accountantAudit';
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
  const [gmail,setGmail]=useState<{available:boolean;connected:boolean;email?:string}|null>(null);
  const [gmailBusy,setGmailBusy]=useState(false);
  const [gmailMessage,setGmailMessage]=useState('');
  useEffect(()=>{
    let active=true;
    void fetch('/api/gmail/connection',{cache:'no-store',credentials:'same-origin'})
      .then(async r=>{if(!r.ok)throw Error();return await r.json();})
      .then(data=>{if(active&&typeof data.available==='boolean'&&typeof data.connected==='boolean')setGmail(data);})
      .catch(()=>{if(active)setGmailMessage('ตรวจสถานะ Gmail ไม่สำเร็จ');});
    return()=>{active=false;};
  },[]);
  const syncGmail=async()=>{
    if(gmailBusy||busy||!gmail?.connected)return;
    setGmailBusy(true);setGmailMessage('');setParsed(null);setOutcome('');setError('');
    try{
      const r=await fetch('/api/gmail/import-preview',{method:'POST',headers:{'content-type':'application/json'},body:'{}',credentials:'same-origin',cache:'no-store'});
      if(!r.ok)throw Error(r.status===401||r.status===403?'กรุณาเชื่อม Gmail ใหม่':'อ่าน Gmail ไม่สำเร็จ');
      const data=await r.json();
      if(data.mode!=='preview'||data.saved!==0||!Number.isSafeInteger(data.scanned)||data.scanned<0||data.scanned>100||typeof data.csv!=='string')throw Error('ผลอ่าน Gmail ไม่ถูกต้อง');
      if(data.scanned===0){setGmailMessage('ไม่พบอีเมล K PLUS ใน 7 วันที่ผ่านมา');return;}
      setParsed(parseEmailLedgerCsv(data.csv));setFilename('Gmail · K PLUS · 7 วันล่าสุด');
      setGmailMessage('ตรวจ '+data.scanned+' ฉบับ'+(data.moreAvailable?' · ยังมีอีเมลเกินขอบเขต 100 ฉบับ':'')+' · ยังไม่บันทึก');
    }catch(e){setGmailMessage(e instanceof Error?e.message:'อ่าน Gmail ไม่สำเร็จ');}
    finally{setGmailBusy(false);}
  };
  const disconnectGmail=async()=>{
    if(gmailBusy||busy||!window.confirm('ยกเลิกเชื่อม Gmail? รายการที่บันทึกในเครื่องจะยังอยู่'))return;
    setGmailBusy(true);setParsed(null);setGmailMessage('');
    try{
      const r=await fetch('/api/gmail/connection',{method:'POST',headers:{'content-type':'application/json'},body:'{"action":"disconnect"}',cache:'no-store',credentials:'same-origin'});
      if(!r.ok)throw Error('ยกเลิกการเชื่อมต่อไม่สำเร็จ');
      const data=await r.json();setGmail({available:true,connected:false});
      if(!data.googleRevoked)setGmailMessage('ยกเลิกในแอปแล้ว กรุณาตรวจสิทธิ์ในบัญชี Google ด้วย');
    }catch(e){setGmailMessage(e instanceof Error?e.message:'ยกเลิกการเชื่อมต่อไม่สำเร็จ');}
    finally{setGmailBusy(false);}
  };

  const partition=useMemo(()=>partitionEmailLedger(parsed?.confirmed||[],existing),[parsed,existing]);
  const total=partition.ready.reduce((sum,t)=>sum+t.amountSatang,0);
  const breakdown=accountantAudit(partition.ready);
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
    if(!parsed||busy||gmailBusy)return;
    setBusy(true);setError('');
    try{
      const fresh=await loadTransactions();
      const eligible=partitionEmailLedger(parsed.confirmed,fresh);
      const saved=await appendEmailTransactions(eligible.ready);
      await onImported();
      setOutcome('เพิ่มรายการใหม่ '+saved.imported+' รายการ · ข้ามรายการซ้ำ/อาจซ้ำ '+(eligible.duplicates.length+saved.duplicates)+' รายการ · ต้องตรวจเอง '+parsed.excluded.length+' รายการ (ยังไม่บันทึก)');
      setParsed(null);
    }catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ กรุณาลองนำเข้าอีกครั้ง');}
    finally{setBusy(false);}
  };
  return <div className="email-ledger-import">
    <p>นำเข้าคำชี้แจงรายจ่ายจากไฟล์ CSV ที่แปลงจากสมุดบัญชีอีเมล ข้อมูลจะอ่านและบันทึกในอุปกรณ์นี้เท่านั้น ไม่ส่งไฟล์ไปยังเซิร์ฟเวอร์ และไม่แทนที่รายการเดิม</p>
    <div className="email-ledger-preview" aria-label="Gmail Sync">
      <div className="email-ledger-preview-title"><Mail size={19}/><strong>Gmail Sync</strong></div>
      <p>อ่านอีเมล K PLUS 7 วันล่าสุด (สูงสุด 100 ฉบับ) ผ่านสิทธิ์อ่านเท่านั้น ตรวจรายการก่อนเพิ่มลงเครื่อง ไม่ส่งหรือลบอีเมล</p>
      {gmail?.connected?<><p role="status">เชื่อมแล้ว · {gmail.email||'Gmail'}</p>
        <button type="button" className="btn btn-primary" disabled={gmailBusy||busy} onClick={()=>void syncGmail()}><RefreshCw size={17}/> {gmailBusy?'กำลังดำเนินการ…':'Sync Gmail'}</button>
        <button type="button" className="btn btn-secondary" disabled={gmailBusy||busy} onClick={()=>void disconnectGmail()}>ยกเลิกการเชื่อมต่อ Gmail</button></>:
        gmail?.available?<a className="btn btn-secondary" href="/api/gmail/oauth/start">เชื่อม Gmail ผ่าน Google</a>:<p role="status">{gmail===null&&!gmailMessage?'กำลังตรวจสถานะ Gmail':'Gmail Sync ยังไม่พร้อมใช้งาน'}</p>}
      {gmailMessage&&<p role="status">{gmailMessage}</p>}
    </div>
    <label className="btn btn-secondary email-ledger-file-button" htmlFor="email-ledger-file"><Upload size={17}/> เลือกไฟล์บัญชีอีเมล (CSV)</label>
    <input ref={fileRef} id="email-ledger-file" className="visually-hidden" type="file" accept=".csv,text/csv" disabled={busy||gmailBusy} onChange={e=>{void pick(e.target.files?.[0]);}}/>
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
        <div><dt>เติมเงินล่วงหน้า (Wallet / Easy Pass)</dt><dd>฿{baht(breakdown.walletTopups.amountSatang)}</dd></div>
        <div><dt>ชำระหนี้ / บัตรเครดิต</dt><dd>฿{baht(breakdown.debtPayments.amountSatang)}</dd></div>
        <div><dt>เงินออกยังไม่ทราบวัตถุประสงค์</dt><dd>฿{baht(breakdown.needsClassification.amountSatang)}</dd></div>
      </dl>
      <p className="email-ledger-warning">ยอดรวมคือเงินออกจากบัญชีตามหลักฐาน ไม่ใช่ค่าใช้จ่ายสุทธิทั้งหมด: เงินเติมล่วงหน้าและชำระหนี้แสดงแยกเพื่อป้องกันการตีความผิด รายการไม่ยืนยันหรือหลักฐานประกอบยังไม่บันทึก หากพบยอด/เวลาอาจซ้ำกับรายการเดิม ระบบจะข้ามเพื่อป้องกันการนับซ้ำ</p>
      {partition.ready.length>0&&<div className="email-ledger-scroll">
        <ul className="email-ledger-items">{partition.ready.map(t=><li key={t.id}><div><strong>{t.recipient}</strong><span>{t.date} · {t.time} · {emailLedgerCategory(t)}</span></div><b>฿{baht(t.amountSatang)}</b></li>)}</ul>
      </div>}
      {parsed.excluded.length>0&&<details className="email-ledger-excluded"><summary>ดูรายการที่ไม่รวมยอด ({parsed.excluded.length})</summary>
        <ul>{parsed.excluded.map((x,i)=><li key={i}><strong>{x.name||x.date}</strong> · {x.status} <span>{x.reason}</span></li>)}</ul>
      </details>}
      <div className="email-ledger-actions">
        <button type="button" className="btn btn-ghost bordered" disabled={busy} onClick={()=>setParsed(null)}>ยกเลิก</button>
        <button type="button" className="btn btn-primary" disabled={busy||gmailBusy||!partition.ready.length} onClick={()=>{void confirm();}}>
          {busy?'กำลังบันทึก...':'ยืนยันเพิ่ม '+partition.ready.length+' รายการ'}
        </button>
      </div>
    </div>}
  </div>;
}

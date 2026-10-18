import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,Download,Trash2,X} from 'lucide-react';

type Props={
  transactionCount:number;
  pendingCount:number;
  busy:boolean;
  error:string;
  onBackup:()=>void;
  onConfirm:()=>void;
  onClose:()=>void;
};

export default function ResetDataDialog({transactionCount,pendingCount,busy,error,onBackup,onConfirm,onClose}:Props){
  const [confirmation,setConfirmation]=useState('');
  const dialogRef=useRef<HTMLElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const busyRef=useRef(busy);busyRef.current=busy;
  const closeRef=useRef(onClose);closeRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    inputRef.current?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busyRef.current){event.preventDefault();closeRef.current();}
      if(event.key!=='Tab')return;
      const controls=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])')||[]);
      if(!controls.length)return;
      const index=controls.indexOf(document.activeElement as HTMLElement);
      if(event.shiftKey&&index<=0){event.preventDefault();controls[controls.length-1].focus();}
      else if(!event.shiftKey&&(index<0||index===controls.length-1)){event.preventDefault();controls[0].focus();}
    };
    window.addEventListener('keydown',key);
    return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  return <div className="modal-backdrop"><section className="modal restore-modal local-reset-modal"
    role="alertdialog" aria-modal="true" aria-labelledby="local-reset-title" aria-describedby="local-reset-description" tabIndex={-1} ref={dialogRef}>
    <div className="modal-heading"><div><span className="eyebrow">ข้อมูลในอุปกรณ์</span><h2 id="local-reset-title">ลบข้อมูลในเครื่อง</h2></div>
      <button type="button" className="icon-btn" aria-label="ปิด" disabled={busy} onClick={onClose}><X size={20}/></button></div>
    <div className="restore-notice"><AlertTriangle size={22}/><div id="local-reset-description">
      <strong>ข้อมูลบนอุปกรณ์นี้จะถูกลบถาวร</strong>
      <p>ลบรายการที่บันทึกไว้ รายการรอตรวจ งบประมาณ ชื่อบัญชี และการเชื่อมต่อบนอุปกรณ์นี้เท่านั้น ข้อมูลในระบบซิงก์ยังอยู่ และ Shortcut ที่ตั้งไว้จะยังทำงานต่อ</p>
    </div></div>
    <dl className="restore-counts">
      <div><dt>รายการบันทึกในเครื่อง</dt><dd>{transactionCount.toLocaleString('th-TH')} รายการ</dd></div>
      <div><dt>สลิปรอตรวจในเครื่อง</dt><dd>{pendingCount.toLocaleString('th-TH')} รายการ</dd></div>
    </dl>
    <button className="btn btn-secondary restore-backup" disabled={busy} type="button" onClick={onBackup}><Download size={17}/> ดาวน์โหลดไฟล์สำรองก่อนลบ</button>
    <p className="local-reset-help">หลังลบ หากต้องการนำเข้ารายการจาก iPhone อีกครั้ง ต้องเชื่อมต่อด้วยรหัสเปิดรายการใหม่ ข้อมูลที่เก็บเฉพาะบนเครื่องและไม่ได้สำรองไว้จะกู้คืนไม่ได้</p>
    <label className="field-label" htmlFor="local-reset-confirm">พิมพ์ <strong>ลบข้อมูล</strong> เพื่อยืนยัน</label>
    <input ref={inputRef} id="local-reset-confirm" className="local-reset-input" type="text" autoComplete="off"
      spellCheck={false} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} placeholder="ลบข้อมูล"/>
    {error&&<p className="error-message" role="alert">{error}</p>}
    <div className="modal-footer"><button className="btn btn-ghost" disabled={busy} type="button" onClick={onClose}>ยกเลิก</button>
      <button className="btn btn-danger" disabled={busy||confirmation.trim()!=='ลบข้อมูล'} type="button" onClick={onConfirm}>
        <Trash2 size={17}/>{busy?'กำลังลบข้อมูล...':'ลบข้อมูลในเครื่อง'}</button></div>
  </section></div>;
}

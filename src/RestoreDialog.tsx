import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,Download,ShieldCheck,X} from 'lucide-react';

type Props={
  existingCount:number;
  importedCount:number;
  busy:boolean;
  onBackup:()=>void;
  onConfirm:()=>void;
  onClose:()=>void;
};

export default function RestoreDialog({existingCount,importedCount,busy,onBackup,onConfirm,onClose}:Props){
  const [acknowledged,setAcknowledged]=useState(false);
  const closeRef=useRef(onClose);closeRef.current=onClose;
  const busyRef=useRef(busy);busyRef.current=busy;
  const dialogRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialogRef.current?.focus();
    const handleKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busyRef.current){event.preventDefault();closeRef.current();}
      if(event.key!=='Tab')return;
      const controls=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])')||[]);
      if(!controls.length)return;
      const index=controls.indexOf(document.activeElement as HTMLElement);
      if(event.shiftKey&&index<=0){event.preventDefault();controls[controls.length-1].focus();}
      else if(!event.shiftKey&&(index<0||index===controls.length-1)){event.preventDefault();controls[0].focus();}
    };
    window.addEventListener('keydown',handleKey);
    return()=>{window.removeEventListener('keydown',handleKey);document.body.style.overflow=previousOverflow;previous?.focus();};
  },[]);
  return <div className="modal-backdrop"><section className="modal restore-modal" ref={dialogRef} tabIndex={-1} role="alertdialog" aria-modal="true" aria-labelledby="restore-title" aria-describedby="restore-description">
    <div className="modal-heading"><div><span className="eyebrow">DATA RESTORE</span><h2 id="restore-title">นำเข้าข้อมูลสำรอง</h2></div><button type="button" className="icon-btn" aria-label="ปิด" disabled={busy} onClick={onClose}><X size={20}/></button></div>
    <div className="restore-notice"><AlertTriangle size={22}/><div id="restore-description"><strong>ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด</strong><p>นี่ไม่ใช่การรวมข้อมูล รายการเดิมจะถูกลบหลังจากคุณยืนยัน</p></div></div>
    <dl className="restore-counts"><div><dt>รายการในเครื่องตอนนี้</dt><dd>{existingCount.toLocaleString('th-TH')} รายการ</dd></div><div><dt>รายการในไฟล์สำรอง</dt><dd>{importedCount.toLocaleString('th-TH')} รายการ</dd></div></dl>
    <button className="btn btn-secondary restore-backup" type="button" disabled={busy} onClick={onBackup}><Download size={17}/> ดาวน์โหลดข้อมูลปัจจุบันก่อน</button>
    <label className="restore-confirm"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} disabled={busy}/><span>ฉันเข้าใจว่าข้อมูลเดิมทั้งหมดจะถูกแทนที่ด้วยข้อมูลจากไฟล์นี้</span></label>
    <div className="modal-footer"><button className="btn btn-ghost" type="button" disabled={busy} onClick={onClose}>ยกเลิก</button><button className="btn btn-danger" type="button" disabled={busy||!acknowledged} onClick={onConfirm}><ShieldCheck size={17}/>{busy?'กำลังนำเข้า...':'ยืนยันแทนที่ข้อมูล'}</button></div>
  </section></div>;
}

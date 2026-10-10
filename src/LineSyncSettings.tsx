import {useState} from 'react';
import {CheckCircle2,Link2,RefreshCcw,Unlink,MessageCircle} from 'lucide-react';
import {lineBridgeConfigured,lineLinked,pairLine,syncLineInbox,unlinkLine} from './lib/lineSync';

export default function LineSyncSettings({onImported}:{onImported:()=>Promise<void>}){
  const [linked,setLinked]=useState(lineLinked);
  const [code,setCode]=useState('');
  const [pending,setPending]=useState(false);
  const [notice,setNotice]=useState('');
  const configured=lineBridgeConfigured();
  const connect=async()=>{
    setPending(true);setNotice('');
    try{
      await pairLine(code);
      setLinked(true);setCode('');
      const result=await syncLineInbox();
      await onImported();
      setNotice('เชื่อม LINE สำเร็จ นำเข้า '+result.imported+' รายการ'+(result.possibleDuplicates?` · พบ ${result.possibleDuplicates} รายการที่อาจซ้ำกับ iPhone โปรดตรวจรายการทั้งหมด` :''));
    }catch(e){setNotice(e instanceof Error?e.message:'เชื่อม LINE ไม่สำเร็จ');}
    finally{setPending(false);}
  };
  const sync=async()=>{
    setPending(true);setNotice('');
    try{
      const result=await syncLineInbox();
      await onImported();
      setNotice('ซิงก์แล้ว: เพิ่ม '+result.imported+' จาก '+result.received+' รายการบน LINE'+(result.possibleDuplicates?` · พบ ${result.possibleDuplicates} รายการที่อาจซ้ำกับ iPhone โปรดตรวจรายการทั้งหมด` :''));
    }catch(e){setLinked(lineLinked());setNotice(e instanceof Error?e.message:'ซิงก์ไม่สำเร็จ');}
    finally{setPending(false);}
  };
  return <section className="surface settings-card line-sync-card">
    <div className="settings-icon green"><MessageCircle size={23}/></div>
    <h3>LINE → เงินวันนี้</h3>
    <p>ส่งต่อข้อความหรือรูปแจ้งเตือนธุรกรรมจาก LINE OA ธนาคารไปยัง Money Tracker OA จากนั้นตรวจยอดเงินและยืนยันก่อนบันทึก ข้อมูลที่ยืนยันแล้วจะซิงก์เข้ารายการในเครื่องนี้</p>
    {!configured?<p className="line-status" role="status">ระบบ LINE ยังไม่ได้เปิดใช้งาน กรุณาตั้งค่าการเชื่อมต่อ LINE ก่อน</p>:linked?
    <>
      <p className="line-status" role="status"><CheckCircle2 size={16}/> เชื่อม LINE สำหรับอุปกรณ์นี้แล้ว</p>
      <div className="line-sync-actions">
        <button className="btn btn-primary" type="button" disabled={pending} onClick={()=>{void sync();}}><RefreshCcw size={17}/> {pending?'กำลังซิงก์...':'ซิงก์รายการจาก LINE'}</button>
        <button className="btn btn-ghost bordered" type="button" disabled={pending} onClick={()=>{unlinkLine();setLinked(false);setNotice('ยกเลิกการเชื่อมบนเครื่องนี้แล้ว');}}><Unlink size={17}/> เลิกเชื่อมเครื่องนี้</button>
      </div>
    </>:<>
      <p className="line-instructions">1. เพิ่มเพื่อน Money Tracker OA ใน LINE แล้วพิมพ์ <strong>/เชื่อม</strong></p>
      <p className="line-instructions">2. คัดลอกรหัส 20 ตัวอักษรที่ Bot ส่งกลับมา (ใช้ได้ 5 นาที)</p>
      <label className="field-label" htmlFor="line-pair-code">รหัสเชื่อมจาก LINE</label>
      <input id="line-pair-code" className="line-code-input" value={code} maxLength={20}
        autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="รหัสจาก LINE"
        onChange={e=>setCode(e.target.value.toUpperCase())}/>
      <button className="btn btn-primary" disabled={pending||!/^[0-9A-F]{20}$/.test(code)} onClick={()=>{void connect();}}><Link2 size={17}/> {pending?'กำลังเชื่อม...':'เชื่อมบัญชี LINE'}</button>
    </>}
    {notice&&<p className="line-status" role="status">{notice}</p>}
    <small className="hint">ข้อมูลที่ซิงก์มาจะเก็บไว้ในเบราว์เซอร์นี้ การแก้ไขรายการในเครื่องยังไม่ซิงก์กลับ LINE และหากใช้หลายเครื่อง รายการที่เพิ่มด้วยมือจะไม่ซิงก์ข้ามเครื่อง</small>
  </section>;
}

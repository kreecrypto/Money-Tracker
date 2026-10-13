import {useCallback,useState} from 'react';
import {Camera,CheckCircle2,RefreshCcw,ShieldCheck,Smartphone,Unlink} from 'lucide-react';
import {baht,EXPENSE_CATEGORIES,INCOME_CATEGORIES,METHODS,toSatang,todayLocal} from './lib/finance';
import {
  iphoneConfigured,iphoneConnected,iphoneConnect,iphoneDisconnect,iphoneDrafts,iphoneReview,
  iphoneSync,type IPhoneDraft
} from './lib/iphoneSync';

function Draft({draft,onReviewed}:{draft:IPhoneDraft;onReviewed:()=>Promise<void>}){
  const [type,setType]=useState<'income'|'expense'>(draft.type||'expense');
  const [amount,setAmount]=useState(draft.amountSatang?String(draft.amountSatang/100):'');
  const [date,setDate]=useState(draft.date||todayLocal());
  const [category,setCategory]=useState(draft.category||'อื่น ๆ');
  const [note,setNote]=useState(draft.note);
  const [method,setMethod]=useState<'cash'|'bank'|'card'|'wallet'>(draft.method||'bank');
  const [waiting,setWaiting]=useState(false);
  const [error,setError]=useState('');
  const categories=type==='income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES;
  const switchType=(value:'income'|'expense')=>{
    setType(value);setCategory(value==='income'?'อื่น ๆ':'อื่น ๆ');
  };
  const send=async(decision:'confirm'|'discard')=>{
    const cents=toSatang(amount);
    if(decision==='confirm'&&!cents){setError('กรุณาระบุจำนวนเงินให้ถูกต้องก่อนบันทึก');return;}
    setWaiting(true);setError('');
    try{
      await iphoneReview(draft.id,decision,decision==='confirm'?{
        type,amountSatang:cents!,date,category,note:note.slice(0,500),method
      }:undefined);
      await onReviewed();
    }catch(e){setError(e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ');}
    finally{setWaiting(false);}
  };
  return <article className="iphone-draft" aria-label="รายการรอตรวจสอบจาก iPhone">
    <p className="iphone-draft-source"><Camera size={14}/> {draft.source} <span>· กรุณาตรวจสอบก่อนบันทึก</span></p>
    <div className="iphone-draft-grid">
      <div><label className="field-label" htmlFor={'iphone-type-'+draft.id}>ประเภทรายการ</label>
        <select id={'iphone-type-'+draft.id} value={type} onChange={e=>switchType(e.target.value as 'income'|'expense')}>
          <option value="expense">รายจ่าย</option><option value="income">รายรับ</option>
        </select></div>
      <div><label className="field-label" htmlFor={'iphone-amount-'+draft.id}>ยอดเงิน (บาท)</label>
        <input id={'iphone-amount-'+draft.id} inputMode="decimal" value={amount}
          onChange={e=>setAmount(e.target.value)} placeholder="เช่น 119.00" required/></div>
      <div><label className="field-label" htmlFor={'iphone-date-'+draft.id}>วันที่ทำรายการ</label>
        <input id={'iphone-date-'+draft.id} type="date" value={date} onChange={e=>setDate(e.target.value)} required/></div>
      <div><label className="field-label" htmlFor={'iphone-cat-'+draft.id}>หมวดหมู่</label>
        <select id={'iphone-cat-'+draft.id} value={category} onChange={e=>setCategory(e.target.value)}>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
        </select></div>
    </div>
    <label className="field-label" htmlFor={'iphone-note-'+draft.id}>รายละเอียด (ไม่บังคับ)</label>
    <input id={'iphone-note-'+draft.id} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/>
    <label className="field-label" htmlFor={'iphone-method-'+draft.id}>ช่องทาง</label>
    <select id={'iphone-method-'+draft.id} value={method} onChange={e=>setMethod(e.target.value as 'cash'|'bank'|'card'|'wallet')}>
      {Object.entries(METHODS).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
    {error&&<p className="error-message" role="alert">{error}</p>}
    <p className="iphone-draft-help">OCR แนะนำยอด {draft.amountSatang!==null?'฿'+baht(draft.amountSatang):'ไม่สำเร็จ'} · ระบบยังไม่บันทึกจนกว่าจะกดยืนยัน</p>
    <div className="iphone-draft-actions">
      <button className="btn btn-primary" disabled={waiting} onClick={()=>{void send('confirm');}}><CheckCircle2 size={17}/> ยืนยันบันทึก</button>
      <button className="btn btn-ghost bordered" disabled={waiting} onClick={()=>{void send('discard');}}>ไม่บันทึกรายการนี้</button>
    </div>
  </article>;
}

export default function IPhoneShortcutSettings({onImported}:{onImported:()=>Promise<void>}){
  const [linked,setLinked]=useState(iphoneConnected);
  const [token,setToken]=useState('');
  const [rows,setRows]=useState<IPhoneDraft[]>([]);
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState('');
  const refresh=useCallback(async()=>{
    const drafts=await iphoneDrafts();
    setRows(drafts);
    const result=await iphoneSync();
    await onImported();
    return {...result,pending:drafts.length};
  },[onImported]);
  const connect=async()=>{
    setBusy(true);setNote('');
    try{
      iphoneConnect(token.trim());setLinked(true);setToken('');
      const result=await refresh();
      setNote('เชื่อมสำเร็จ · ซิงก์รายการที่ยืนยันแล้ว '+result.imported+' รายการ');
    }catch(e){setLinked(iphoneConnected());setNote(e instanceof Error?e.message:'เชื่อมไม่สำเร็จ');}
    finally{setBusy(false);}
  };
  const sync=async()=>{
    setBusy(true);setNote('');
    try{const result=await refresh();setNote('รายการใหม่ '+result.imported+' · รอตรวจสอบ '+result.pending+' รายการ');}
    catch(e){setLinked(iphoneConnected());setNote(e instanceof Error?e.message:'ซิงก์ไม่สำเร็จ');}
    finally{setBusy(false);}
  };
  const afterReview=async()=>{
    const result=await refresh();
    setNote('จัดการรายการเรียบร้อย นำเข้า '+result.imported+' รายการ');
  };
  return <section className="surface settings-card iphone-card" aria-label="iPhone Shortcut">
    <div className="settings-icon green"><Smartphone size={23}/></div>
    <h3>iPhone Shortcut → บันทึกอัตโนมัติ</h3>
    <p>Shortcut อ่านข้อความจากรูปสลิป K PLUS บน iPhone แล้วส่ง Text ผ่าน API เพื่อบันทึกรายรับ–รายจ่ายทันทีเมื่อยอดเงิน วันที่ และทิศทางการเงินชัดเจน ไม่ต้องเปิดแอปหรือกดยืนยัน รูปภาพไม่ถูกส่งขึ้น Server</p>
    <details className="iphone-photos-setup">
      <summary>วิธีเปิด Auto Save ผ่าน iPhone Shortcuts</summary>
      <ol>
        <li>สร้าง Shortcut: Find Photos (รูปล่าสุด) → Repeat with Each → Extract Text from Image</li>
        <li>กรองข้อความบน iPhone ให้พบ K PLUS/กสิกร <strong>และ</strong> คำว่าทำรายการสำเร็จ <strong>และ</strong> ป้ายยอดเงิน (รวมถึง จำนวน:) ก่อนส่ง</li>
        <li>ใช้ Get Contents of URL → POST → JSON ส่งฟิลด์ text ไปยัง /api/iphone/photos และ Header Authorization: Bearer + Upload Token</li>
        <li>ถ้ารูปเป็นสลิปโอนออกจากบัญชีของคุณ ให้กำหนด direction เป็น expense ใน JSON; หากเป็นข้อความแจ้งเตือนเงินเข้า/ออกที่ระบุชัด ไม่ต้องส่ง direction</li>
        <li>Shortcuts → Automation → App → เลือก K PLUS → Is Closed → Run Immediately → เลือก Shortcut นี้</li>
        <li>เชื่อม iPhone Inbox ด้วย Review Token เพียงครั้งเดียว แอปจะซิงก์รายการที่ API บันทึกไว้ทันทีเมื่อเปิดหรือกลับเข้าแอป</li>
      </ol>
      <p className="iphone-photos-caution">การบันทึกอัตโนมัติจะข้ามรายการซ้ำ และไม่เดายอดเงินหรือประเภทที่อ่านไม่ได้ รายการที่ไม่ครบจะอยู่ในคิวรอตรวจสอบ ไม่ถูกบันทึกเป็นรายรับรายจ่ายผิด ๆ</p>
      <a href="https://github.com/kreecrypto/Money-Tracker/blob/main/docs/IOS_SHORTCUT_TEXT_AUTOSAVE.md" target="_blank" rel="noopener noreferrer">อ่านคู่มือ Shortcuts แบบละเอียด</a>
    </details>
    {!iphoneConfigured()?
      <p className="line-status" role="status"><ShieldCheck size={17}/> ยังไม่ได้เปิดใช้ iPhone API — ต้องตั้งค่า Bridge และฐานข้อมูลก่อน</p>:
      !linked?<>
        <label className="field-label" htmlFor="iphone-review-secret">รหัสเปิดรายการ (Review Token)</label>
        <input id="iphone-review-secret" className="iphone-token-input" type="password" autoComplete="off"
          value={token} onChange={e=>setToken(e.target.value)} placeholder="ใส่รหัส 64 ตัวอักษร" maxLength={64}/>
        <button type="button" className="btn btn-primary" disabled={busy||!/^[0-9a-fA-F]{64}$/.test(token)}
          onClick={()=>{void connect();}}>เชื่อม iPhone Inbox</button>
        <small className="hint">ใช้ Review Token จากการตั้งค่า Vercel ของคุณเท่านั้น ไม่ใช่ LINE Token และไม่ต้องส่งรหัสลงในแชต</small>
      </>:<>
        <p className="line-status" role="status"><CheckCircle2 size={16}/> เชื่อม iPhone Inbox บนอุปกรณ์นี้แล้ว</p>
        <div className="iphone-draft-actions">
          <button className="btn btn-primary" type="button" disabled={busy} onClick={()=>{void sync();}}>
            <RefreshCcw size={16}/> {busy?'กำลังซิงก์...':'ตรวจรายการใหม่จาก iPhone'}</button>
          <button className="btn btn-ghost bordered" type="button" disabled={busy}
            onClick={()=>{iphoneDisconnect();setLinked(false);setRows([]);setNote('ตัดการเชื่อมในเบราว์เซอร์นี้แล้ว');}}>
            <Unlink size={16}/> เลิกเชื่อมเครื่องนี้</button>
        </div>
        <h4 className="iphone-pending-heading">รายการที่ข้อมูลไม่ครบ {rows.length} รายการ</h4>
        {rows.length?rows.map(row=><Draft key={row.id} draft={row} onReviewed={afterReview}/>):
          <p className="iphone-empty">ไม่มีรายการที่ต้องตรวจ · รายการที่ครบจะบันทึกอัตโนมัติและปรากฏในหน้ารายการ</p>}
      </>}
    {note&&<p className="line-status" role="status">{note}</p>}
    <small className="hint">API เก็บเฉพาะข้อมูลธุรกรรมที่อ่านได้ใน Supabase และแอปซิงก์เข้า IndexedDB เมื่อเปิด/กลับเข้าแอป ไม่มีการเก็บภาพสลิปบน Server และยังไม่ใช่ Cloud Sync สองทาง</small>
  </section>;
}

import {useCallback,useEffect,useState} from 'react';
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
  const [time,setTime]=useState(draft.time||'');
  const [recipient,setRecipient]=useState(draft.recipient||'');
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
        type,amountSatang:cents!,date,time:time||null,recipient:recipient.trim()||null,category,note:note.slice(0,500),method
      }:undefined);
      await onReviewed();
    }catch(e){setError(e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ');}
    finally{setWaiting(false);}
  };
  return <article className="iphone-draft" aria-label="รายการรอตรวจสอบจาก iPhone">
    <p className="iphone-draft-source"><Camera size={14}/> {draft.source} <span>· ข้อมูลยังไม่ครบ กรุณาตรวจสอบ</span></p>
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
    <div className="iphone-draft-grid">
      <div><label className="field-label" htmlFor={'iphone-time-'+draft.id}>เวลาทำรายการ</label><input id={'iphone-time-'+draft.id} type="time" value={time} onChange={e=>setTime(e.target.value)}/></div>
      <div><label className="field-label" htmlFor={'iphone-recipient-'+draft.id}>ชื่อผู้รับ</label><input id={'iphone-recipient-'+draft.id} maxLength={160} value={recipient} onChange={e=>setRecipient(e.target.value)}/></div>
    </div>
    <label className="field-label" htmlFor={'iphone-note-'+draft.id}>รายละเอียด (ไม่บังคับ)</label>
    <input id={'iphone-note-'+draft.id} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/>
    <label className="field-label" htmlFor={'iphone-method-'+draft.id}>ช่องทาง</label>
    <select id={'iphone-method-'+draft.id} value={method} onChange={e=>setMethod(e.target.value as 'cash'|'bank'|'card'|'wallet')}>
      {Object.entries(METHODS).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
    {error&&<p className="error-message" role="alert">{error}</p>}
    <p className="iphone-draft-help">ระบบอ่านยอดได้ {draft.amountSatang!==null?'฿'+baht(draft.amountSatang):'ไม่ชัดเจน'} · รายการนี้ยังไม่รวมในยอดรายรับ–รายจ่าย</p>
    <div className="iphone-draft-actions">
      <button className="btn btn-primary" disabled={waiting} onClick={()=>{void send('confirm');}}><CheckCircle2 size={17}/> ยืนยันบันทึก</button>
      <button className="btn btn-ghost bordered" disabled={waiting} onClick={()=>{void send('discard');}}>ไม่บันทึกรายการนี้</button>
    </div>
  </article>;
}

export default function IPhoneShortcutSettings({onImported,variant='settings',onPendingChanged}:{onImported:()=>Promise<void>;variant?:'settings'|'review';onPendingChanged?:(count:number)=>void}){
  const [linked,setLinked]=useState(iphoneConnected);
  const [token,setToken]=useState('');
  const [rows,setRows]=useState<IPhoneDraft[]>([]);
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState('');
  const refresh=useCallback(async()=>{
    const drafts=await iphoneDrafts();
    setRows(drafts);
    onPendingChanged?.(drafts.length);
    const result=await iphoneSync();
    await onImported();
    return {...result,pending:drafts.length};
  },[onImported,onPendingChanged]);
  const connect=async()=>{
    setBusy(true);setNote('');
    try{
      iphoneConnect(token.trim());setLinked(true);setToken('');
      const result=await refresh();
      setNote('เชื่อมสำเร็จ · ซิงก์รายการใหม่ '+result.imported+' รายการ'+(result.invalid?' · มี '+result.invalid+' รายการข้อมูลไม่ถูกต้อง ยังไม่ได้นำเข้า':''));
    }catch(e){setLinked(iphoneConnected());setNote(e instanceof Error?e.message:'เชื่อมไม่สำเร็จ');}
    finally{setBusy(false);}
  };
  const sync=async()=>{
    setBusy(true);setNote('');
    try{const result=await refresh();setNote('นำเข้าใหม่ '+result.imported+' จาก Cloud '+result.received+' รายการ · รอตรวจ '+result.pending+' รายการ'+(result.invalid?' · ข้อมูลไม่ถูกต้อง '+result.invalid+' รายการ':'')+(result.imported===0&&result.received>0?' · หากไม่พบในหน้า “รายการ” ให้เลือกเดือนตามวันที่สลิป':''));}
    catch(e){setLinked(iphoneConnected());setNote(e instanceof Error?e.message:'ซิงก์ไม่สำเร็จ');}
    finally{setBusy(false);}
  };
  const afterReview=async()=>{
    const result=await refresh();
    setNote('จัดการรายการเรียบร้อย นำเข้า '+result.imported+' รายการ'+(result.invalid?' · ตรวจข้อมูลผิดรูปแบบ '+result.invalid+' รายการ':''));
  };
  useEffect(()=>{
    if(variant!=='review'||!linked||!iphoneConfigured())return;
    let cancelled=false;
    iphoneDrafts().then(drafts=>{
      if(cancelled)return;
      setRows(drafts);
      onPendingChanged?.(drafts.length);
    }).catch(e=>{
      if(!cancelled)setNote(e instanceof Error?e.message:'โหลดรายการที่ต้องตรวจไม่สำเร็จ');
    });
    return()=>{cancelled=true;};
  },[variant,linked,onPendingChanged]);

  if(variant==='review')return <section className="surface settings-card iphone-card" aria-label="รายการจาก iPhone ที่รอตรวจ">
    <div className="settings-icon green"><Smartphone size={23}/></div>
    <h3>รายการจาก iPhone ที่รอตรวจ</h3>
    <p>รายการเหล่านี้ยังไม่รวมในยอดรายรับ–รายจ่าย ตรวจข้อมูลจากสลิปก่อนบันทึก</p>
    {!iphoneConfigured()||!linked?
      <p className="line-status" role="status">ยังไม่ได้เชื่อมต่อ iPhone ไปที่ตั้งค่าเพื่อเชื่อมต่อก่อนตรวจรายการ</p>:
      <>
        <div className="iphone-draft-actions"><button className="btn btn-secondary" type="button" disabled={busy} onClick={()=>{void sync();}}>
          <RefreshCcw size={16}/> {busy?'กำลังตรวจรายการ…':'ตรวจรายการล่าสุด'}
        </button></div>
        <h4 className="iphone-pending-heading">รอตรวจข้อมูล {rows.length} รายการ</h4>
        {rows.length?rows.map(row=><Draft key={row.id} draft={row} onReviewed={afterReview}/>):
          <p className="iphone-empty">ไม่มีรายการที่ต้องตรวจตอนนี้</p>}
      </>}
    {note&&<p className="line-status" role="status">{note}</p>}
  </section>;

  return <section className="surface settings-card iphone-card" aria-label="iPhone Shortcut">
    <div className="settings-icon green"><Smartphone size={23}/></div>
    <h3>นำเข้ารายการจาก iPhone</h3>
    <p>ตั้งค่าครั้งเดียวเพื่อให้ iPhone Shortcuts ส่งข้อความจากสลิป K PLUS มาบันทึกอัตโนมัติเมื่อข้อมูลครบ หากข้อมูลไม่ครบจะอยู่ในหน้า รายการ → รอตรวจจาก iPhone โดยไม่ต้องอัปโหลดรูปซ้ำ</p>
    <details className="iphone-photos-setup">
      <summary>วิธีตั้งค่าการนำเข้าจาก iPhone</summary>
      <ol>
        <li>สร้าง Shortcut: Find Photos (รูปล่าสุด) → Repeat with Each → Extract Text from Image</li>
        <li>กรองข้อความบน iPhone ให้พบ K PLUS/กสิกร <strong>และ</strong> คำว่าทำรายการสำเร็จ <strong>และ</strong> ป้ายยอดเงิน (รวมถึง จำนวน:) ก่อนส่ง</li>
        <li>ส่งเฉพาะข้อความ OCR ไปยัง API ผ่าน POST JSON โดยใช้ Upload Token เฉพาะเครื่อง</li>
        <li>Shortcuts → Automation → App → เลือก K PLUS → Is Closed → Run Immediately → เลือก Shortcut นี้</li>
        <li>กลับมาหน้านี้เพื่อดูรายการที่อ่านไม่ครบเท่านั้น; รายการที่สมบูรณ์จะซิงก์เข้า Dashboard โดยไม่ต้องยืนยัน</li>
      </ol>
      <p className="iphone-photos-caution">ไม่ใช่การเฝ้าดู Photos ตลอดเวลา หากสลิปยังไม่ถูกบันทึกตอนปิดแอป อาจต้องใช้ Automation ตามเวลาช่วยตรวจอีกครั้ง</p>
      <a href="https://github.com/kreecrypto/Money-Tracker/blob/main/docs/IOS26_PHOTOS_AUTO_SLIP.md" target="_blank" rel="noopener noreferrer">อ่านคู่มือ Shortcuts แบบละเอียด</a>
    </details>
    {!iphoneConfigured()?
      <p className="line-status" role="status"><ShieldCheck size={17}/> ยังไม่ได้เปิดใช้ iPhone API — ต้องตั้งค่า Bridge และฐานข้อมูลก่อน</p>:
      !linked?<>
        <label className="field-label" htmlFor="iphone-review-secret">รหัสเปิดรายการ (Review Token)</label>
        <input id="iphone-review-secret" className="iphone-token-input" type="password" autoComplete="off"
          value={token} onChange={e=>setToken(e.target.value)} placeholder="ใส่รหัส 64 ตัวอักษร" maxLength={64}/>
        <button type="button" className="btn btn-primary" disabled={busy||!/^[0-9a-fA-F]{64}$/.test(token)}
          onClick={()=>{void connect();}}>เชื่อมต่อ iPhone</button>
        <small className="hint">ใช้ Review Token จากการตั้งค่า Vercel ของคุณเท่านั้น ไม่ใช่ LINE Token และไม่ต้องส่งรหัสลงในแชต</small>
      </>:<>
        <p className="line-status" role="status"><CheckCircle2 size={16}/> ตั้งค่าเชื่อมต่อ iPhone บนเครื่องนี้แล้ว</p>
        <div className="iphone-draft-actions">
          <button className="btn btn-primary" type="button" disabled={busy} onClick={()=>{void sync();}}>
            <RefreshCcw size={16}/> {busy?'กำลังซิงก์...':'ซิงก์รายการล่าสุด'}</button>
          <button className="btn btn-ghost bordered" type="button" disabled={busy}
            onClick={()=>{iphoneDisconnect();setLinked(false);setRows([]);setNote('ตัดการเชื่อมในเบราว์เซอร์นี้แล้ว');}}>
            <Unlink size={16}/> เลิกเชื่อมเครื่องนี้</button>
        </div>
        <h4 className="iphone-pending-heading">รอตรวจสอบ {rows.length} รายการ</h4>
        {rows.length?rows.map(row=><Draft key={row.id} draft={row} onReviewed={afterReview}/>):
          <p className="iphone-empty">ไม่มีรายการที่ต้องตรวจตอนนี้</p>}
      </>}
    {note&&<p className="line-status" role="status">{note}</p>}
    <small className="hint">ใช้ได้เมื่อ API พร้อมและตั้งค่ารหัสใน Vercel แล้ว รายการจาก Shortcut บันทึกใน Supabase และนำเข้ามาใน IndexedDB แบบทางเดียวเมื่อเปิด App; การลบ/แก้ไขใน App ยังไม่ซิงก์กลับ Cloud</small>
  </section>;
}

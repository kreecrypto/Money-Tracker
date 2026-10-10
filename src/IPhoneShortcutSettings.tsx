import IPhoneSlipPreview from './IPhoneSlipPreview';
import {potentialCrossChannelDuplicates} from './lib/duplicateReview';
import type {Transaction} from './lib/finance';
import {useCallback,useEffect,useState} from 'react';
import {Camera,CheckCircle2,RefreshCcw,ShieldCheck,Smartphone,Unlink} from 'lucide-react';
import {baht,EXPENSE_CATEGORIES,INCOME_CATEGORIES,METHODS,toSatang} from './lib/finance';
import {
  iphoneConfigured,iphoneConnected,iphoneConnect,iphoneDisconnect,iphoneDrafts,iphoneReview,
  iphoneSync,type IPhoneDraft
} from './lib/iphoneSync';

export function Draft({draft,onReviewed,existing=[]}:{draft:IPhoneDraft;onReviewed:()=>Promise<void>;existing?:readonly Transaction[]}){
  const [type,setType]=useState<'income'|'expense'|''>('');
  const [amount,setAmount]=useState(draft.amountSatang?String(draft.amountSatang/100):'');
  const [date,setDate]=useState(draft.date||'');
  const [category,setCategory]=useState(draft.category||'อื่น ๆ');
  const [note,setNote]=useState(draft.note);
  const [method,setMethod]=useState<'cash'|'bank'|'card'|'wallet'>(draft.method||'bank');
  const [waiting,setWaiting]=useState(false);
  const [error,setError]=useState('');
  const [duplicateAcknowledged,setDuplicateAcknowledged]=useState(false);
  const cents=toSatang(amount);
  const possibleDuplicates=potentialCrossChannelDuplicates({type:type||null,amountSatang:cents,date:date||null,method},existing,'iphone');
  const categories=type==='income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES;
  const switchType=(value:'income'|'expense')=>{setType(value);setCategory('อื่น ๆ');setDuplicateAcknowledged(false);setError('');};
  const send=async(decision:'confirm'|'discard')=>{
    if(decision==='confirm'&&possibleDuplicates.length>0&&!duplicateAcknowledged){setError('พบรายการยอดเดียวกันจาก LINE กรุณาตรวจสอบและยืนยันก่อนบันทึก');return;}
    if(decision==='confirm'&&!type){setError('กรุณายืนยันว่าเป็นเงินเข้า หรือเงินออก');return;}
    if(decision==='confirm'&&!cents){setError('กรุณาระบุจำนวนเงินให้ถูกต้องก่อนบันทึก');return;}
    if(decision==='confirm'&&!/^\d{4}-\d{2}-\d{2}$/.test(date)){setError('กรุณาระบุวันที่จากสลิป');return;}
    setWaiting(true);setError('');
    try{
      await iphoneReview(draft.id,decision,decision==='confirm'?{
        type:type as 'income'|'expense',amountSatang:cents!,date,category,note:note.slice(0,500),method
      }:undefined);
      await onReviewed();
    }catch(e){setError(e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ');}
    finally{setWaiting(false);}
  };
  return <article className="iphone-draft" aria-label="รายการรอตรวจสอบจาก iPhone">
    <p className="iphone-draft-source"><Camera size={14}/> {draft.source} <span>· กรุณาตรวจสอบก่อนบันทึก</span></p>
    <IPhoneSlipPreview draft={draft}/>
    <p className="iphone-direction-label">ยืนยันประเภทเงิน <strong>(จำเป็น)</strong>{draft.type&&<small> · ระบบอ่านว่า {draft.type==='income'?'เงินเข้า':'เงินออก'} โปรดตรวจจากสลิปอีกครั้ง</small>}</p>
    <div className="iphone-direction" role="group" aria-label="ยืนยันประเภทเงิน">
      <button type="button" aria-pressed={type==='expense'} className={type==='expense'?'selected expense':''} onClick={()=>switchType('expense')}>เงินออก / รายจ่าย</button>
      <button type="button" aria-pressed={type==='income'} className={type==='income'?'selected income':''} onClick={()=>switchType('income')}>เงินเข้า / รายรับ</button>
    </div>
    <div className="iphone-draft-grid">
      <div><label className="field-label" htmlFor={'iphone-amount-'+draft.id}>ยอดเงิน (บาท)</label>
        <input id={'iphone-amount-'+draft.id} inputMode="decimal" value={amount}
          onChange={e=>{setAmount(e.target.value);setDuplicateAcknowledged(false);}} placeholder="เช่น 119.00" required/></div>
      <div><label className="field-label" htmlFor={'iphone-date-'+draft.id}>วันที่ทำรายการ</label>
        <input id={'iphone-date-'+draft.id} type="date" value={date} onChange={e=>{setDate(e.target.value);setDuplicateAcknowledged(false);}} required/></div>
      <div><label className="field-label" htmlFor={'iphone-cat-'+draft.id}>หมวดหมู่</label>
        <select id={'iphone-cat-'+draft.id} value={category} onChange={e=>setCategory(e.target.value)}>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
        </select></div>
    </div>
    <label className="field-label" htmlFor={'iphone-note-'+draft.id}>รายละเอียด (ไม่บังคับ)</label>
    <input id={'iphone-note-'+draft.id} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/>
    <label className="field-label" htmlFor={'iphone-method-'+draft.id}>ช่องทาง</label>
    <select id={'iphone-method-'+draft.id} value={method} onChange={e=>{setMethod(e.target.value as 'cash'|'bank'|'card'|'wallet');setDuplicateAcknowledged(false);}}>
      {Object.entries(METHODS).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select>
    {possibleDuplicates.length>0&&<div className="iphone-duplicate-warning" role="group" aria-label="ตรวจสอบรายการที่อาจซ้ำ"><strong>อาจซ้ำกับรายการจาก LINE {possibleDuplicates.length} รายการ</strong><p>พบเงินประเภทเดียวกัน ยอดเท่ากัน และวันที่ตรงกัน แต่เป็นคนละช่องทางนำเข้า กรุณาตรวจสลิปก่อนยืนยัน (อาจเป็นรายการคนละธุรกรรมได้)</p><label><input type="checkbox" checked={duplicateAcknowledged} onChange={e=>setDuplicateAcknowledged(e.target.checked)}/> ฉันตรวจสอบแล้ว ต้องการบันทึกเป็นอีกรายการ</label></div>}
    {error&&<p className="error-message" role="alert">{error}</p>}
    <p className="iphone-draft-help">OCR แนะนำยอด {draft.amountSatang!==null?'฿'+baht(draft.amountSatang):'ไม่สำเร็จ'} · ระบบยังไม่บันทึกจนกว่าจะกดยืนยัน</p>
    <div className="iphone-draft-actions">
      <button className="btn btn-primary" disabled={waiting} onClick={()=>{void send('confirm');}}><CheckCircle2 size={17}/> ยืนยันบันทึก</button>
      <button className="btn btn-ghost bordered" disabled={waiting} onClick={()=>{void send('discard');}}>ไม่บันทึกรายการนี้</button>
    </div>
  </article>;
}

type Props={onImported:()=>Promise<void>;existing?:readonly Transaction[];mode?:'inbox'|'settings';onPendingChanged?:(count:number)=>void;onGoInbox?:()=>void;onGoSettings?:()=>void};
export default function IPhoneShortcutSettings({onImported,existing=[],mode='settings',onPendingChanged,onGoInbox,onGoSettings}:Props){
  const [linked,setLinked]=useState(iphoneConnected);
  const [token,setToken]=useState('');
  const [rows,setRows]=useState<IPhoneDraft[]>([]);
  const [busy,setBusy]=useState(false);
  const [note,setNote]=useState('');
  const [loadState,setLoadState]=useState<'idle'|'loading'|'ready'|'error'>('idle');
  const refresh=useCallback(async()=>{
    setLoadState('loading');
    const drafts=await iphoneDrafts();
    setRows(drafts);
    onPendingChanged?.(drafts.length);
    const result=await iphoneSync();
    await onImported();
    setLoadState('ready');
    return {...result,pending:drafts.length};
  },[onImported,onPendingChanged]);
  useEffect(()=>{if(mode!=='inbox'||!linked)return;void refresh().catch(e=>{setLoadState('error');setLinked(iphoneConnected());setNote(e instanceof Error?e.message:'โหลดรายการไม่ได้');});},[mode,linked,refresh]);
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
    try{const result=await refresh();setNote('นำเข้า '+result.imported+' · รอตรวจสอบ '+result.pending+' รายการ');}
    catch(e){setLoadState('error');setLinked(iphoneConnected());setNote(e instanceof Error?e.message:'ซิงก์ไม่สำเร็จ');}
    finally{setBusy(false);}
  };
  const afterReview=async()=>{
    const result=await refresh();
    setNote('จัดการรายการเรียบร้อย นำเข้า '+result.imported+' รายการ');
  };
  return mode==='inbox'?<section className="surface iphone-card iphone-inbox" aria-label="รายการรอตรวจสอบจาก iPhone">
    {!iphoneConfigured()?<div className="iphone-empty" role="status">ยังไม่ได้ตั้งค่า iPhone API กรุณาตั้งค่าก่อนใช้งาน</div>:
      !linked?<div className="iphone-empty"><p>ยังไม่ได้เชื่อม iPhone Inbox บนอุปกรณ์นี้</p><button type="button" className="btn btn-primary" onClick={onGoSettings}>ไปตั้งค่าการเชื่อมต่อ</button></div>:
      <>
        <div className="iphone-inbox-header"><div><h3>รายการรอตรวจสอบ</h3><p>ต้องตรวจสอบทุกครั้งก่อนบันทึก ระบบไม่บันทึกสลิปอัตโนมัติ</p></div><span className="iphone-inbox-count" aria-label={`${rows.length} รายการรอตรวจ`}>{rows.length}</span></div>
        <button type="button" className="btn btn-secondary iphone-inbox-refresh" disabled={busy} onClick={()=>{void sync();}}><RefreshCcw size={17}/> {busy?'กำลังตรวจ...':'ตรวจรายการใหม่'}</button>
        {loadState==='loading'&&rows.length===0?<p className="iphone-empty" role="status">กำลังโหลดรายการรอตรวจสอบ…</p>:loadState==='error'?<p className="error-message" role="alert">โหลดรายการไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วกดตรวจรายการใหม่</p>:rows.length?rows.map(row=><Draft key={row.id} draft={row} existing={existing} onReviewed={afterReview}/>):<p className="iphone-empty">ยังไม่มีรายการรอตรวจสอบ · ส่งสลิปจาก iPhone Shortcut แล้วกดตรวจรายการใหม่</p>}
      </>}
    {note&&<p className="line-status" role="status">{note}</p>}
    <p className="iphone-draft-help">ข้อมูลที่ยืนยันเก็บในเครื่องนี้ ส่วนภาพสลิปถูกจำกัดสิทธิ์เปิดดูหลัง 7 วัน และไฟล์จริงจะถูกลบเมื่อระบบ Cleanup ทำงานสำเร็จ</p>
  </section>:<section className="surface settings-card iphone-card" aria-label="ตั้งค่า iPhone Shortcut">
    <div className="settings-icon green"><Smartphone size={23}/></div>
    <h3>Review Inbox · iPhone Photos → เงินวันนี้</h3>
    <p>เชื่อม iPhone Shortcuts เพื่อส่งสลิปเข้าระบบรอตรวจสอบโดยไม่ต้องเชื่อม LINE OA ของธนาคาร ข้อมูลจะบันทึกหลังจากคุณกดยืนยันเท่านั้น</p>
    <details className="iphone-photos-setup">
      <summary>วิธีเปิด Auto Slip Sync บน iPhone (iOS 26)</summary>
      <ol>
        <li>สร้าง Shortcut: Find Photos (รูปล่าสุด) → Repeat with Each → Extract Text from Image</li>
        <li>กรองข้อความบน iPhone ให้พบคำเกี่ยวกับการโอน <strong>และ</strong> ป้ายยอดเงินธุรกรรมก่อนส่ง</li>
        <li>ส่งเฉพาะข้อความ OCR ไปยัง API ผ่าน POST JSON โดยใช้ Upload Token เฉพาะเครื่อง</li>
        <li>Shortcuts → Automation → App → เลือก K PLUS → Is Closed → Run Immediately → เลือก Shortcut นี้</li>
        <li>กลับมาหน้านี้เพื่อตรวจภาพสลิปเทียบกับยอด เลือกเงินเข้า/ออกและยืนยัน</li>
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
          onClick={()=>{void connect();}}>เชื่อม iPhone Inbox</button>
        <small className="hint">ใช้ Review Token จากการตั้งค่า Vercel ของคุณเท่านั้น ไม่ใช่ LINE Token และไม่ต้องส่งรหัสลงในแชต</small>
      </>:<>
        <p className="line-status" role="status"><CheckCircle2 size={16}/> เชื่อม iPhone Inbox บนอุปกรณ์นี้แล้ว</p>
        <div className="iphone-draft-actions">
          <button className="btn btn-primary" type="button" disabled={busy} onClick={()=>{void sync();}}>
            <RefreshCcw size={16}/> {busy?'กำลังซิงก์...':'ตรวจรายการใหม่จาก iPhone'}</button>
          <button className="btn btn-ghost bordered" type="button" disabled={busy}
            onClick={()=>{iphoneDisconnect();setLinked(false);setRows([]);onPendingChanged?.(0);setNote('ตัดการเชื่อมในเบราว์เซอร์นี้แล้ว');}}>
            <Unlink size={16}/> เลิกเชื่อมเครื่องนี้</button>
        </div>
        <button type="button" className="btn btn-secondary iphone-open-inbox" onClick={onGoInbox}>เปิดหน้ารอตรวจสอบ ({rows.length})</button>
      </>}
    {note&&<p className="line-status" role="status">{note}</p>}
    <small className="hint">ข้อมูลที่ยืนยันอยู่ใน IndexedDB ของเครื่องนี้ (ไม่ใช่ Cloud Sync สองทาง) ภาพที่อัปโหลดอยู่ใน Private Storage และหมดสิทธิ์เปิดดูหลัง 7 วัน การลบไฟล์จริงขึ้นกับ Cleanup ที่ทำงานสำเร็จ</small>
  </section>;
}

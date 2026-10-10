import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {ArrowDownLeft,ArrowLeft,ArrowRight,ArrowUpRight,BarChart3,CalendarDays,Check,ScanLine,ChevronLeft,ChevronRight,CloudOff,Download,FileSpreadsheet,Inbox,LayoutDashboard,Menu,MoreHorizontal,Pencil,Plus,Search,Settings as SettingsIcon,ShieldCheck,SlidersHorizontal,Trash2,TrendingDown,Upload,Wallet,WalletCards,X} from 'lucide-react';
import {baht,DEFAULT_SETTINGS,EXPENSE_CATEGORIES,expenseByCategory,INCOME_CATEGORIES,lastMonths,METHODS,monthLocal,monthly,summarize,todayLocal,toSatang,type EntryType,type Method,type Settings,type Transaction} from './lib/finance';
import {deleteTransaction,loadSettings,loadTransactions,replaceAll,saveSettings,saveTransaction} from './lib/storage';
import {createBackup,downloadText,parseBackup,toCsv} from './lib/backup';
import SlipScanner from './SlipScanner';
import RestoreDialog from './RestoreDialog';
import LineSyncSettings from './LineSyncSettings';
import IPhoneShortcutSettings from './IPhoneShortcutSettings';
import {iphoneConnected,iphoneDrafts,iphoneSync} from './lib/iphoneSync';
import {lineLinked,syncLineInbox} from './lib/lineSync';
import type {SlipFields} from './lib/slip';

type Page='home'|'transactions'|'inbox'|'reports'|'settings';
type Filter='all'|'income'|'expense';
const pageLabels:Record<Page,string>={home:'ภาพรวม',transactions:'รายการทั้งหมด',inbox:'รอตรวจสอบ',reports:'รายงาน',settings:'ตั้งค่า'};
const navItems=[{key:'home' as const,icon:LayoutDashboard,label:'ภาพรวม'},{key:'transactions' as const,icon:WalletCards,label:'รายการทั้งหมด'},{key:'inbox' as const,icon:Inbox,label:'รอตรวจสอบ'},{key:'reports' as const,icon:BarChart3,label:'รายงาน'}];
const monthText=(value:string)=>{const [year,m]=value.split('-').map(Number);return new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(year,m-1,1));};
const dateText=(date:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${date}T12:00:00`));
const percent=(n:number,d:number)=>d<=0?0:Math.round(n/d*100);
const uuid=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;

function Logo(){return <div className="brand"><div className="brand-logo">฿<span className="brand-dot"/></div><span className="brand-text">เงินวันนี้<small>DAILY MONEY</small></span></div>}
function Empty({title,description,add}:{title:string;description:string;add?:()=>void;icon?:string}){return <div className="empty"><div className="empty-symbol" aria-hidden="true"><WalletCards size={30} strokeWidth={1.5}/></div><b>{title}</b><p>{description}</p>{add&&<button className="btn btn-primary" onClick={add}><Plus size={16}/> บันทึกรายการแรก</button>}</div>}
function MoneyCard({title,value,icon,variation}:{title:string;value:number;icon:'income'|'expense'|'net';variation?:string}){
  const Icon=icon==='income'?ArrowDownLeft:icon==='expense'?ArrowUpRight:Wallet;
  return <div className={`metric ${icon}`}><div className="metric-top"><span>{title}</span><span className="metric-icon"><Icon size={18}/></span></div><div className="metric-number">฿{baht(value)}</div><span className="metric-foot">{variation||'ยอดรวมในเดือนที่เลือก'}</span></div>;
}
function TransactionRow({entry,onEdit,onDelete}:{entry:Transaction;onEdit:(t:Transaction)=>void;onDelete:(t:Transaction)=>void}){
  const [actionsOpen,setActionsOpen]=useState(false);
  return <div className="transaction-row">
    <div className={`transaction-emoji ${entry.type}`} aria-hidden="true">{entry.category.slice(0,1)}</div>
    <div className="transaction-copy"><strong>{entry.note||entry.category}</strong><span>{entry.category} <i>·</i> {METHODS[entry.method]}</span></div>
    <div className="transaction-end"><b className={entry.type==='income'?'positive':'negative'}>{entry.type==='income'?'+':'−'}฿{baht(entry.amountSatang)}</b><span>{dateText(entry.date)}</span></div>
    <div className="transaction-actions"><button aria-label={`แก้ไข ${entry.note||entry.category}`} title="แก้ไข" className="icon-btn" onClick={()=>onEdit(entry)}><Pencil size={17}/></button><button aria-label={`ลบ ${entry.note||entry.category}`} title="ลบ" className="icon-btn danger" onClick={()=>onDelete(entry)}><Trash2 size={17}/></button></div>
    <div className="mobile-row-actions"><button className="icon-btn mobile-row-more" title="จัดการรายการ" aria-label={`จัดการ ${entry.note||entry.category}`} aria-expanded={actionsOpen} onClick={()=>setActionsOpen(!actionsOpen)}><MoreHorizontal size={21}/></button>
      {actionsOpen&&<div className="mobile-row-menu" role="group" aria-label="ตัวเลือกรายการ">
        <button onClick={()=>{setActionsOpen(false);onEdit(entry);}}><Pencil size={17}/> แก้ไข</button>
        <button className="danger" onClick={()=>{setActionsOpen(false);onDelete(entry);}}><Trash2 size={17}/> ลบรายการ</button>
      </div>}
    </div>
  </div>;
}
function TxList({items,onEdit,onDelete,limit}:{items:Transaction[];onEdit:(t:Transaction)=>void;onDelete:(t:Transaction)=>void;limit?:number}){
  const visible=limit?items.slice(0,limit):items;
  return <div className="tx-list">{visible.map(x=><TransactionRow key={x.id} entry={x} onEdit={onEdit} onDelete={onDelete}/>)}</div>;
}
function EntryModal({initial,existing,startWithScanner,close,submit}:{initial:Transaction|null;existing:Transaction[];startWithScanner:boolean;close:()=>void;submit:(t:Transaction)=>Promise<void>}){
  const [type,setType]=useState<EntryType>(initial?.type||'expense');
  const [amount,setAmount]=useState(initial?String(initial.amountSatang/100):'');
  const [date,setDate]=useState(initial?.date||todayLocal());
  const [category,setCategory]=useState(initial?.category||EXPENSE_CATEGORIES[0]);
  const [method,setMethod]=useState<Method>(initial?.method||'cash');
  const [note,setNote]=useState(initial?.note||'');
  const [pending,setPending]=useState(false);
  const [scannerOpen,setScannerOpen]=useState(startWithScanner);
  const [slipApplied,setSlipApplied]=useState(false);
  const [directionVerified,setDirectionVerified]=useState(false);
  const [duplicateAcknowledged,setDuplicateAcknowledged]=useState(false);
  const [error,setError]=useState('');
  const first=useRef<HTMLInputElement>(null);
  const dialogRef=useRef<HTMLElement>(null);
  const closeRef=useRef(close);closeRef.current=close;
  const pendingRef=useRef(pending);pendingRef.current=pending;
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    if(window.innerWidth>660)first.current?.focus();else dialogRef.current?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'&&!pendingRef.current){e.preventDefault();closeRef.current();}
      if(e.key!=='Tab')return;
      const controls=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')||[])
      .filter(el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden');
      if(!controls.length){e.preventDefault();return;}
      const idx=controls.indexOf(document.activeElement as HTMLElement);
      if(e.shiftKey&&idx<=0){e.preventDefault();controls[controls.length-1].focus();}
      else if(!e.shiftKey&&(idx<0||idx===controls.length-1)){e.preventDefault();controls[0].focus();}
    };
    window.addEventListener('keydown',key);
    return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  const categories=type==='expense'?EXPENSE_CATEGORIES:INCOME_CATEGORIES;
  const parsedAmount=toSatang(amount);
  const similar=existing.filter(x=>x.id!==initial?.id&&x.date===date&&x.type===type&&x.method===method&&parsedAmount!==null&&x.amountSatang===parsedAmount);
  useEffect(()=>setDuplicateAcknowledged(false),[type,amount,date,method]);
  const save=async(e:FormEvent)=>{e.preventDefault();
    if(slipApplied&&!directionVerified){setError('กรุณาเลือก เงินเข้า หรือ เงินออก ก่อนบันทึก');return;}
    if(similar.length&&!duplicateAcknowledged){setError('พบรายการคล้ายกัน กรุณายืนยันก่อนบันทึกซ้ำ');return;}
    const sats=toSatang(amount);if(!sats){setError('กรุณากรอกจำนวนเงินมากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง');return;}
    if(!/^\d{4}-\d\d-\d\d$/.test(date)){setError('กรุณาเลือกวันที่');return;}
    setPending(true);setError('');try{await submit({id:initial?.id||uuid(),type,amountSatang:sats,date,category,note:note.trim().slice(0,500),method,createdAt:initial?.createdAt||Date.now()});close();}catch(err){setError(err instanceof Error?err.message:'บันทึกไม่สำเร็จ');setPending(false);}
  };
  const switchType=(newType:EntryType)=>{setType(newType);setCategory(newType==='expense'?EXPENSE_CATEGORIES[0]:INCOME_CATEGORIES[0]);if(slipApplied){setDirectionVerified(true);setError('');}};
  const applySlip=(data:SlipFields)=>{setSlipApplied(true);setDirectionVerified(false);setDuplicateAcknowledged(false);
    setAmount(data.amountSatang!==null?(data.amountSatang/100).toFixed(2):'');
    if(data.date)setDate(data.date);
    if(data.recipient)setNote(`โอนเงิน: ${data.recipient}`.slice(0,500));
    setMethod('bank');
    setError('');
    setScannerOpen(false);
  };
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!pending)close();}}><section ref={dialogRef} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow">DAILY RECORD</span><h2 id="modal-title">{initial?'แก้ไขรายการ':'บันทึกรายการใหม่'}</h2></div><button className="icon-btn" title="ปิด" aria-label="ปิด" disabled={pending} onClick={close}><X size={21}/></button></div>
  <form onSubmit={save}>
  {!initial&&<div className="slip-entry"><button type="button" className="btn btn-secondary slip-open" onClick={()=>setScannerOpen(!scannerOpen)}><ScanLine size={17}/> {scannerOpen?'กลับไปกรอกเอง':'สแกนสลิปโอนเงิน'}</button><span>{scannerOpen?'อ่านข้อมูลสลิป แล้วกลับมาตรวจทาน':'หรือกรอกข้อมูลด้านล่าง'}</span></div>}
  {scannerOpen?<SlipScanner onApply={applySlip} onClose={()=>setScannerOpen(false)}/>:<>
  {slipApplied&&!directionVerified&&<p className="direction-warning" role="alert">กรุณาเลือกให้ชัดเจนว่าเป็น <strong>เงินเข้า</strong> หรือ <strong>เงินออก</strong> ก่อนบันทึก</p>}
  <div className="type-switch" role="group" aria-label="ประเภทรายการ"><button type="button" aria-pressed={type==='expense'&&(!slipApplied||directionVerified)} className={type==='expense'&&(!slipApplied||directionVerified)?'selected expense':''} onClick={()=>switchType('expense')}><ArrowUpRight size={16}/> เงินออก / รายจ่าย</button><button type="button" aria-pressed={type==='income'&&(!slipApplied||directionVerified)} className={type==='income'&&(!slipApplied||directionVerified)?'selected income':''} onClick={()=>switchType('income')}><ArrowDownLeft size={16}/> เงินเข้า / รายรับ</button></div>
  <label className="field-label" htmlFor="amount">จำนวนเงิน (บาท)</label><div className="amount-input"><span>฿</span><input id="amount" ref={first} inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} required /></div>
  {similar.length>0&&<div className="duplicate-warning" role="status"><strong>พบ {similar.length} รายการที่อาจซ้ำ</strong><p>มียอด {amount} บาท วันที่ {date} และช่องทางเดียวกัน</p><label><input type="checkbox" checked={duplicateAcknowledged} onChange={e=>setDuplicateAcknowledged(e.target.checked)}/> ยืนยันว่าต้องการบันทึกรายการนี้ซ้ำ</label></div>}
  <div className="field-grid"><div><label className="field-label" htmlFor="entry-date">วันที่</label><input id="entry-date" type="date" value={date} onChange={e=>setDate(e.target.value)} required/></div><div><label className="field-label" htmlFor="category">หมวดหมู่</label><select id="category" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div></div>
  <label className="field-label" htmlFor="note">รายละเอียด <span className="subtle">(ไม่บังคับ)</span></label><input id="note" maxLength={500} placeholder="เช่น กาแฟตอนเช้า" value={note} onChange={e=>setNote(e.target.value)}/>
  <label className="field-label" htmlFor="method">ช่องทางชำระเงิน / รับเงิน</label><select id="method" value={method} onChange={e=>setMethod(e.target.value as Method)}>{Object.entries(METHODS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
  {error&&<p className="error-message" role="alert">{error}</p>}
  <div className="modal-footer"><button type="button" className="btn btn-ghost" disabled={pending} onClick={close}>ยกเลิก</button><button type="submit" className="btn btn-primary" disabled={pending}><Check size={17}/>{pending?'กำลังบันทึก...':'บันทึกรายการ'}</button></div></>}</form></section></div>;
}
export default function App(){
  const [items,setItems]=useState<Transaction[]>([]);const [settings,setSettings]=useState<Settings>(DEFAULT_SETTINGS);
  const [view,setView]=useState<Page>('home');const [month,setMonth]=useState(monthLocal());const [modalOpen,setModalOpen]=useState(false);const [scanOnOpen,setScanOnOpen]=useState(false);const [editing,setEditing]=useState<Transaction|null>(null);
  const [ready,setReady]=useState(false);const [loadingError,setLoadingError]=useState('');const [toast,setToast]=useState('');const [search,setSearch]=useState('');const [filter,setFilter]=useState<Filter>('all');
  const [budgetEdit,setBudgetEdit]=useState('');const [budgetSaving,setBudgetSaving]=useState(false);
  const [pendingDraftCount,setPendingDraftCount]=useState(0);
  const [lastBackupAt,setLastBackupAt]=useState(()=>{try{return Number(localStorage.getItem('ngoentoday-last-backup')||0);}catch{return 0;}});
  const [pendingRestore,setPendingRestore]=useState<ReturnType<typeof parseBackup>|null>(null);
  const [restoreBusy,setRestoreBusy]=useState(false);
  const importRef=useRef<HTMLInputElement>(null);
  const reload=useCallback(async()=>{const [rows,s]=await Promise.all([loadTransactions(),loadSettings()]);setItems(rows);setSettings(s);setBudgetEdit(s.monthlyBudgetSatang?String(s.monthlyBudgetSatang/100):'');},[]);
  useEffect(()=>{reload().catch(e=>setLoadingError(e instanceof Error?e.message:'เปิดฐานข้อมูลไม่สำเร็จ')).finally(()=>setReady(true));},[reload]);
  useEffect(()=>{const onVisible=()=>{if(document.visibilityState==='visible')reload().catch(console.error);};document.addEventListener('visibilitychange',onVisible);return()=>document.removeEventListener('visibilitychange',onVisible);},[reload]);
  useEffect(()=>{const sync=()=>{if(!iphoneConnected()){setPendingDraftCount(0);return;}iphoneSync().then(r=>{if(r.imported)void reload();}).catch(()=>{});iphoneDrafts().then(rows=>setPendingDraftCount(rows.length)).catch(()=>{});};sync();const visible=()=>{if(document.visibilityState==='visible')sync();};document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible);},[reload]);
  useEffect(()=>{const sync=()=>{if(!lineLinked())return;syncLineInbox().then(x=>{if(x.imported>0)void reload();}).catch(()=>{});};sync();const onVisible=()=>{if(document.visibilityState==='visible')sync();};document.addEventListener('visibilitychange',onVisible);return()=>document.removeEventListener('visibilitychange',onVisible);},[reload]);
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(''),3500);return()=>window.clearTimeout(id);},[toast]);
  const selected=useMemo(()=>monthly(items,month),[items,month]);
  const sums=useMemo(()=>summarize(selected),[selected]);
  const allSums=useMemo(()=>summarize(items),[items]);
  const byCategory=useMemo(()=>expenseByCategory(selected),[selected]);
  const usedBudget=percent(sums.expense,settings.monthlyBudgetSatang);
  const filtered=useMemo(()=>selected.filter(x=>(filter==='all'||x.type===filter) && (!search.trim()||`${x.category} ${x.note} ${METHODS[x.method]}`.toLocaleLowerCase('th-TH').includes(search.trim().toLocaleLowerCase('th-TH')))),[selected,filter,search]);
  const history=useMemo(()=>{const [y,m]=month.split('-').map(Number);return lastMonths(6,new Date(y,m-1,1)).map(period=>({...period,...summarize(monthly(items,period.key))}));},[items,month]);
  const maxBar=Math.max(1,...history.map(x=>Math.max(x.income,x.expense)));
  const openAdd=()=>{setScanOnOpen(false);setEditing(null);setModalOpen(true)};
  const openScan=()=>{setScanOnOpen(true);setEditing(null);setModalOpen(true)};
  const onSave=async(t:Transaction)=>{await saveTransaction(t);await reload();setToast(editing?'แก้ไขรายการเรียบร้อย':'เพิ่มรายการเรียบร้อย');};
  const onDelete=async(t:Transaction)=>{if(!window.confirm(`ต้องการลบรายการ “${t.note||t.category}” ฿${baht(t.amountSatang)} ใช่หรือไม่?`))return;try{await deleteTransaction(t.id);await reload();setToast('ลบรายการแล้ว');}catch(e){setToast(e instanceof Error?e.message:'ลบรายการไม่สำเร็จ');}};
  const onEdit=(t:Transaction)=>{setScanOnOpen(false);setEditing(t);setModalOpen(true);};
  const changeMonth=(n:number)=>{const [y,m]=month.split('-').map(Number);setMonth(monthLocal(new Date(y,m-1+n,1)));};
  const saveBudget=async(e:FormEvent)=>{e.preventDefault();const n=budgetEdit.trim()===''?0:toSatang(budgetEdit);if(n===null){setToast('ระบุงบประมาณเป็นจำนวนเงินที่ถูกต้อง');return;}try{setBudgetSaving(true);const next={monthlyBudgetSatang:n};await saveSettings(next);setSettings(next);setToast('บันทึกงบประมาณแล้ว');}catch(err){setToast(err instanceof Error?err.message:'บันทึกไม่สำเร็จ');}finally{setBudgetSaving(false);}};
  const exportJson=()=>{downloadText(`ngoentoday-backup-${todayLocal()}.json`,createBackup(items,settings),'application/json;charset=utf-8');const timestamp=Date.now();try{localStorage.setItem('ngoentoday-last-backup',String(timestamp));}catch{}setLastBackupAt(timestamp);setToast('ดาวน์โหลดข้อมูลสำรองแล้ว โปรดเก็บไฟล์อย่างปลอดภัย');};
  const exportCsv=()=>downloadText(`ngoentoday-${todayLocal()}.csv`,toCsv(items),'text/csv;charset=utf-8');
  const importBackup=async(file:File)=>{try{
    if(file.size>25*1024*1024)throw new Error('ไฟล์ใหญ่เกิน 25 MB');
    const parsed=parseBackup(await file.text());
    setPendingRestore(parsed);
  }catch(e){setToast(e instanceof Error?e.message:'นำเข้าไม่สำเร็จ');}finally{if(importRef.current)importRef.current.value='';}};
  const confirmRestore=async()=>{
    if(!pendingRestore)return;
    try{
      setRestoreBusy(true);
      await replaceAll(pendingRestore.transactions,pendingRestore.settings);
      await reload();
      setToast(`นำเข้าสำเร็จ ${pendingRestore.transactions.length} รายการ`);
      setPendingRestore(null);
    }catch(e){setToast(e instanceof Error?e.message:'นำเข้าไม่สำเร็จ');}
    finally{setRestoreBusy(false);}
  };
  if(!ready) return <div className="loading-screen"><div className="loading-icon">฿</div>กำลังเปิดสมุดบันทึกของคุณ...</div>;
  if(loadingError) return <div className="loading-screen"><span>⚠️</span><h2>ไม่สามารถเปิดข้อมูลได้</h2><p>{loadingError}</p><button className="btn btn-primary" onClick={()=>window.location.reload()}>ลองอีกครั้ง</button></div>;
  return <div className="app-shell"><aside className="sidebar"><Logo/><div className="workspace-label">WORKSPACE</div><nav aria-label="เมนูหลัก">{navItems.map(({key,label,icon:Icon})=><button key={key} className={`nav-item ${view===key?'active':''}`} aria-label={label} aria-current={view===key?'page':undefined} onClick={()=>setView(key)}><Icon size={19} strokeWidth={1.9}/><span>{label}</span>{key==='inbox'&&pendingDraftCount>0&&<span className="inbox-badge" aria-label={`${pendingDraftCount} รายการรอตรวจ`}>{pendingDraftCount>99?'99+':pendingDraftCount}</span>}{view===key&&<span className="nav-active-indicator"/>}</button>)}</nav><button type="button" className={`nav-item sidebar-settings ${view==='settings'?'active':''}`} aria-label="ตั้งค่า" aria-current={view==='settings'?'page':undefined} onClick={()=>setView('settings')}><SettingsIcon size={19}/><span>ตั้งค่า</span></button><div className="sidebar-spacer"/><div className="privacy-card"><div className="privacy-graphic"><ShieldCheck size={24}/></div><strong>ข้อมูลเป็นของคุณ</strong><p>รายการที่ยืนยันอยู่ในเครื่องนี้ หากเปิดใช้ iPhone/LINE ข้อมูลสลิปจะส่งผ่าน API ส่วนภาพใน Private Storage หมดสิทธิ์เปิดดูหลัง 7 วัน และลบไฟล์จริงผ่านงาน Cleanup</p><span><CloudOff size={13}/> ข้อมูลรายรับรายจ่ายในเครื่อง</span></div><p className="sidebar-version">เงินวันนี้ · เวอร์ชัน 0.5.0</p></aside>
    <div className="app-body"><header className="topbar"><div className="topbar-left"><span className="greeting">เงินวันนี้ <span className="mobile-today">· {dateText(todayLocal())}</span></span><h1>{pageLabels[view]}</h1></div><div className="topbar-actions"><button type="button" className="header-settings" aria-label={view==='settings'?'กลับหน้าภาพรวม':'ตั้งค่า'} title={view==='settings'?'กลับหน้าภาพรวม':'ตั้งค่า'} onClick={()=>setView(view==='settings'?'home':'settings')}>{view==='settings'?<ArrowLeft size={20}/>:<SettingsIcon size={20}/>}</button><div className="today-chip"><CalendarDays size={16}/><span>{dateText(todayLocal())}</span></div><button className="btn btn-primary top-add" onClick={openAdd}><Plus size={18}/> <span>เพิ่มรายการ</span></button></div></header>
    <main className="main-content">
      {view!=='settings' && view!=='inbox' && <div className={`view-topline ${view==='home'?'home-topline':''}`}><div><span className="eyebrow">FINANCIAL OVERVIEW</span><h2>{view==='home'?'บันทึกทุกวัน ดูง่ายในหน้าเดียว':view==='reports'?'มองเห็นภาพรวมการใช้เงิน':'ประวัติการเงินของคุณ'}</h2><p>{view==='home'?'เพิ่มรายการง่าย ๆ แล้วดูยอดรวมได้ทันที':view==='reports'?'รู้ว่าเงินของคุณไปอยู่ที่ไหนบ้าง':'ค้นหาและจัดการรายการที่บันทึกไว้ได้ง่าย ๆ'}</p></div><div className="month-picker"><button aria-label="เดือนก่อนหน้า" title="เดือนก่อนหน้า" onClick={()=>changeMonth(-1)}><ChevronLeft size={18}/></button><span>{monthText(month)}</span><button aria-label="เดือนถัดไป" title="เดือนถัดไป" onClick={()=>changeMonth(1)}><ChevronRight size={18}/></button></div></div>}
      {view==='home'&&<div className="home-dashboard">
        {items.length>=5&&Date.now()-lastBackupAt>30*24*60*60*1000&&<div className="backup-alert" role="status"><div><strong>อย่าลืมสำรองข้อมูลการเงิน</strong><span>ข้อมูลเก็บไว้ในเครื่องนี้เท่านั้น หากล้างข้อมูลเบราว์เซอร์อาจสูญหาย</span></div><button type="button" className="btn btn-secondary" onClick={exportJson}>สำรองข้อมูล JSON</button></div>}
        <section className="summary-grid" aria-label="ยอดรวมรายเดือน"><div className="hero-card"><div className="hero-pattern"/><div className="hero-kicker"><span className="hero-dot"/> เงินสุทธิจากรายการที่บันทึก</div><div className="hero-value"><span>฿</span>{baht(sums.net)}</div><p>รายรับ − รายจ่าย · ไม่ใช่ยอดบัญชีธนาคาร</p><div className="hero-line"/><div className="hero-bottom"><div><span><ArrowDownLeft size={17}/> รายรับ</span><strong>฿{baht(sums.income)}</strong></div><div><span><ArrowUpRight size={17}/> รายจ่าย</span><strong>฿{baht(sums.expense)}</strong></div></div></div>
          <div className="budget-card">
            <div className="budget-summary-head">
              <div><h3>งบประมาณเดือนนี้</h3><p>{settings.monthlyBudgetSatang>0?`ใช้ไป ${usedBudget}% ของงบที่ตั้งไว้`:'ยังไม่ได้ตั้งงบประมาณ'}</p></div>
              <button className="text-action" onClick={()=>setView('settings')}>{settings.monthlyBudgetSatang?'แก้ไขงบ':'ตั้งงบ'} <ArrowRight size={16}/></button>
            </div>
            {settings.monthlyBudgetSatang>0&&<><div className="budget-linear-track" role="progressbar" aria-label="การใช้งบประมาณเดือนนี้" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(usedBudget,100)}><span className={usedBudget>100?'over-budget':''} style={{width:`${Math.min(usedBudget,100)}%`}} /></div>
              <div className="budget-linear-meta"><span>ใช้ไป ฿{baht(sums.expense)}</span><span>จาก ฿{baht(settings.monthlyBudgetSatang)}</span></div></>}
          </div></section>
        <section className="mobile-quick-actions" aria-label="บันทึกเงินอย่างรวดเร็ว">
          <button type="button" className="mobile-action-add" onClick={openAdd}><span className="quick-action-symbol"><Plus size={22}/></span><span><strong>เพิ่มรายการ</strong><small>บันทึกเงินเข้า–ออก</small></span><ArrowRight size={17}/></button>
          <button type="button" className="mobile-action-scan" onClick={openScan}><span className="quick-action-symbol"><ScanLine size={22}/></span><span><strong>สแกนสลิป</strong><small>ดึงยอดเงินจากรูป</small></span><ArrowRight size={17}/></button>
        </section>
        {pendingDraftCount>0&&<button type="button" className="pending-inbox-cta" onClick={()=>setView('inbox')}><Inbox size={20}/><span><strong>รายการรอตรวจสอบ {pendingDraftCount} รายการ</strong><small>ตรวจเงินเข้า–ออกก่อนบันทึก</small></span><ArrowRight size={17}/></button>}
        {settings.monthlyBudgetSatang>0&&sums.expense>settings.monthlyBudgetSatang&&<div className="budget-alert" role="status">⚠️ รายจ่ายเดือนนี้เกินงบที่ตั้งไว้ ฿{baht(sums.expense-settings.monthlyBudgetSatang)}</div>}
        <section className="surface transactions-surface"><div className="section-header"><div><span className="card-overline">RECENT ACTIVITY</span><h3>รายการล่าสุด</h3></div><button className="text-action" onClick={()=>setView('transactions')}>ดูทั้งหมด <ArrowRight size={16}/></button></div>{selected.length?<TxList items={selected} onEdit={onEdit} onDelete={onDelete} limit={6}/>:<Empty title="เริ่มต้นบันทึกเงินวันนี้" description="เพิ่มรายรับหรือรายจ่ายรายการแรก แล้วดูภาพรวมการเงินของคุณได้ทันที" add={openAdd}/>}</section>
        <div className="home-report-link"><button type="button" className="btn btn-ghost bordered" onClick={()=>setView('reports')}><BarChart3 size={17}/> ดูรายงานและกราฟทั้งหมด <ArrowRight size={16}/></button></div>
      </div>}
      {view==='transactions'&&<section className="surface transaction-page"><div className="list-tools"><div className="search-box"><Search size={19}/><input aria-label="ค้นหารายการ" placeholder="ค้นหาจากรายละเอียด หมวดหมู่ หรือช่องทาง..." value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="filter-tabs" aria-label="กรองประเภทรายการ">{([['all','ทั้งหมด'],['income','รายรับ'],['expense','รายจ่าย']] as const).map(([key,label])=><button key={key} className={filter===key?'selected':''} onClick={()=>setFilter(key)}>{label}</button>)}</div></div><div className="list-count"><SlidersHorizontal size={16}/> {filtered.length} รายการ <span>· {monthText(month)}</span></div>{filtered.length?<TxList items={filtered} onEdit={onEdit} onDelete={onDelete}/>:<Empty icon="🔎" title="ไม่พบรายการ" description="ลองเปลี่ยนเดือน คำค้นหา หรือตัวกรองอีกครั้ง" add={selected.length===0?openAdd:undefined}/>}</section>}
      {view==='inbox'&&<div className="inbox-page"><div className="inbox-page-title"><h2>ตรวจสอบสลิป</h2><p>ตรวจยอดและยืนยันประเภทเงินก่อนเพิ่มเข้ารายการที่บันทึก</p></div><IPhoneShortcutSettings mode="inbox" existing={items} onImported={reload} onPendingChanged={setPendingDraftCount} onGoSettings={()=>setView('settings')}/></div>}
      {view==='reports'&&<><div className="stat-triplet"><MoneyCard title="รายรับรวม" value={sums.income} icon="income"/><MoneyCard title="รายจ่ายรวม" value={sums.expense} icon="expense"/><MoneyCard title="เงินสุทธิ" value={sums.net} icon="net"/></div><section className="two-column"><div className="surface chart-surface"><div className="section-header"><div><span className="card-overline">CASH FLOW</span><h3>แนวโน้ม 6 เดือนถึงเดือนที่เลือก</h3></div><div className="chart-legend"><span><i className="legend-income"/>รายรับ</span><span><i className="legend-expense"/>รายจ่าย</span></div></div><div className="bars-chart" role="img" aria-label="แผนภูมิแท่งรายรับและรายจ่ายย้อนหลัง 6 เดือน"><div className="bars-grid"><div/><div/><div/><div/></div>{history.map(h=><div className="bar-slot" key={h.key}><div className="bar-pair"><div className="bar income-bar" title={`รายรับ ${h.label}: ฿${baht(h.income)}`} style={{height:`${h.income?Math.max(3,(h.income/maxBar)*100):0}%`}}/><div className="bar expense-bar" title={`รายจ่าย ${h.label}: ฿${baht(h.expense)}`} style={{height:`${h.expense?Math.max(3,(h.expense/maxBar)*100):0}%`}}/></div><span>{h.label}</span></div>)}</div></div>
          <div className="surface category-surface"><div className="section-header"><div><span className="card-overline">SPENDING ANALYSIS</span><h3>ใช้จ่ายไปกับอะไรบ้าง</h3></div><button className="plain-icon" onClick={()=>setView('reports')} title="ดูรายงานเพิ่มเติม" aria-label="ดูรายงานเพิ่มเติม"><ArrowRight size={19}/></button></div>{byCategory.length? <div className="category-list">{byCategory.slice(0,5).map((c,i)=><div className="category-item" key={c.name}><div className="category-icon" aria-hidden="true">{c.name.slice(0,1)}</div><div className="category-line"><div><strong>{c.name}</strong><span>฿{baht(c.total)}</span></div><div className="track"><div style={{width:`${percent(c.total,sums.expense)}%`,background:['#2e8a78','#e7a969','#8a9bdd','#c39ac9','#93bfa0'][i%5]}}/></div></div></div>)}</div>:<Empty icon="🧾" title="ยังไม่มีข้อมูลรายจ่าย" description="เพิ่มรายการรายจ่ายเพื่อดูสัดส่วนการใช้เงิน"/>}</div></section>
        <section className="two-column report-panels"><div className="surface report-table"><div className="section-header"><div><span className="card-overline">CATEGORY REPORT</span><h3>รายจ่ายตามหมวดหมู่</h3></div><TrendingDown size={20} color="#9aa5a9"/></div>{byCategory.length?byCategory.map((x,i)=><div className="report-category" key={x.name}><span className="category-index">{String(i+1).padStart(2,'0')}</span><span className="report-cat-emoji" aria-hidden="true">{x.name.slice(0,1)}</span><div><strong>{x.name}</strong><span>{percent(x.total,sums.expense)}% ของรายจ่าย</span></div><b>฿{baht(x.total)}</b></div>):<Empty icon="📊" title="รอข้อมูลเพื่อสร้างรายงาน" description="รายงานจะแสดงเมื่อคุณบันทึกรายจ่าย"/>}</div><div className="surface report-summary"><div className="section-header"><div><span className="card-overline">MONTHLY INSIGHTS</span><h3>สรุปการเงิน</h3></div><MoreHorizontal color="#96a2a8" size={22}/></div><div className="report-stat"><span>{sums.net<0?'รายจ่ายมากกว่ารายรับ':'อัตราเก็บเงินจากรายรับ'}</span><strong>{sums.income?`${Math.round(sums.net/sums.income*100)}%`:'—'}</strong></div><div className="report-stat"><span>จำนวนรายการ</span><strong>{selected.length.toLocaleString('th-TH')} รายการ</strong></div><div className="report-stat"><span>ค่าใช้จ่ายเฉลี่ยต่อวันที่ผ่านมา</span><strong>฿{baht(sums.expense/(month===monthLocal()?Number(todayLocal().slice(8)):new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate()))}</strong></div><div className="report-stat"><span>รายรับ-รายจ่ายสุทธิทั้งหมด</span><strong className={allSums.net>=0?'positive':'negative'}>฿{baht(allSums.net)}</strong></div><button className="btn btn-secondary full" onClick={exportCsv}><FileSpreadsheet size={17}/> ดาวน์โหลดรายการทั้งหมด (CSV)</button></div></section></>}
      {view==='settings'&&<><div className="settings-intro"><span className="eyebrow">PREFERENCES & DATA</span><h2>ปรับแต่งให้เข้ากับการใช้เงินของคุณ</h2><p>จัดการงบประมาณและดูแลข้อมูลส่วนตัวของคุณได้ที่นี่</p></div><div className="settings-grid"><IPhoneShortcutSettings mode="settings" existing={items} onImported={reload} onPendingChanged={setPendingDraftCount} onGoInbox={()=>setView('inbox')}/><LineSyncSettings onImported={reload}/><section className="surface settings-card"><div className="settings-icon green"><Wallet size={23}/></div><h3>งบประมาณรายเดือน</h3><p>ตั้งวงเงินรายจ่ายที่ต้องการใช้ในแต่ละเดือน เพื่อคุมการใช้เงินให้เป็นไปตามเป้าหมาย</p><form onSubmit={saveBudget}><label className="field-label" htmlFor="budget">งบประมาณ (บาท/เดือน)</label><div className="budget-field"><span>฿</span><input id="budget" type="text" inputMode="decimal" value={budgetEdit} onChange={e=>setBudgetEdit(e.target.value)} placeholder="เช่น 15000"/></div><small className="hint">เว้นว่างเพื่อลบวงเงินที่ตั้งไว้</small><button className="btn btn-primary" disabled={budgetSaving} type="submit"><Check size={17}/> {budgetSaving?'กำลังบันทึก':'บันทึกงบประมาณ'}</button></form></section><section className="surface settings-card"><div className="settings-icon peach"><Download size={23}/></div><h3>สำรองและนำเข้าข้อมูล</h3><p>ดาวน์โหลดสำเนาเก็บไว้ เพื่อป้องกันการสูญหายเมื่อล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนอุปกรณ์</p><p className="backup-last-date" role="status">{lastBackupAt?`สำรองข้อมูลครั้งล่าสุด: ${new Date(lastBackupAt).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}`:'ยังไม่มีประวัติการสำรองข้อมูลบนอุปกรณ์นี้'}</p><div className="settings-actions"><button className="btn btn-secondary" onClick={exportJson}><Download size={17}/> สำรองข้อมูล JSON</button><button className="btn btn-secondary" onClick={exportCsv}><FileSpreadsheet size={17}/> ส่งออก CSV</button><button className="btn btn-ghost bordered" onClick={()=>importRef.current?.click()}><Upload size={17}/> นำเข้าไฟล์ JSON</button><input ref={importRef} className="visually-hidden" aria-label="เลือกไฟล์สำรองข้อมูล JSON" type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)void importBackup(f);}}/></div></section><section className="surface settings-card privacy-settings"><div className="settings-icon blue"><ShieldCheck size={24}/></div><h3>ความเป็นส่วนตัว</h3><p>รายการที่บันทึกเก็บใน IndexedDB ของเบราว์เซอร์นี้ รูปที่เลือกส่งเข้า iPhone API อยู่ใน Private Storage และถูกปิดสิทธิ์เปิดดูเมื่อครบ 7 วัน ส่วนการลบไฟล์จริงจะทำโดยงาน Cleanup เมื่อระบบพร้อมใช้งาน</p><div className="info-banner"><CloudOff size={18}/><span>บันทึกในเครื่องใช้งานออฟไลน์ได้ การนำเข้าจาก iPhone เป็นการซิงก์ทางเดียว ภาพสลิปบนคลาวด์เข้าถึงได้เฉพาะบัญชีที่เชื่อม Review Token</span></div></section><section className="surface settings-card privacy-settings"><div className="settings-icon lavender"><Menu size={24}/></div><h3>เกี่ยวกับแอป</h3><p>เงินวันนี้เป็นสมุดบันทึกส่วนตัวสำหรับการเงินในชีวิตประจำวัน ไม่ใช่ระบบเชื่อมต่อบัญชีธนาคาร</p><div className="app-meta"><span>เวอร์ชัน</span><strong>0.5.0 · Mobile-first Minimal</strong></div><div className="app-meta"><span>ค่าเริ่มต้น</span><strong>ภาษาไทย · บาท (THB)</strong></div></section></div></>}
    </main><footer className="app-footer">© {new Date().getFullYear()} เงินวันนี้ · เล็กน้อยทุกวัน เปลี่ยนการเงินได้</footer></div>
    <button aria-label="เพิ่มรายการ" title="เพิ่มรายการ" className={`mobile-fab ${view==='home'||view==='inbox'||view==='settings'?'home-fab':''}`} onClick={openAdd}><Plus size={25}/></button><nav className="mobile-bottom-nav" aria-label="เมนูมือถือ">{navItems.map(({key,label,icon:Icon})=><button key={key} className={view===key?'active':''} aria-current={view===key?'page':undefined} onClick={()=>setView(key)}><Icon size={21}/><span>{label}</span>{key==='inbox'&&pendingDraftCount>0&&<span className="inbox-badge" aria-label={`${pendingDraftCount} รายการรอตรวจ`}>{pendingDraftCount>99?'99+':pendingDraftCount}</span>}</button>)}</nav>
    {toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
    {modalOpen&&<EntryModal initial={editing} existing={items} startWithScanner={scanOnOpen} close={()=>setModalOpen(false)} submit={onSave}/>}
    {pendingRestore&&<RestoreDialog existingCount={items.length} importedCount={pendingRestore.transactions.length} busy={restoreBusy} onBackup={exportJson} onConfirm={()=>{void confirmRestore();}} onClose={()=>setPendingRestore(null)}/>}
  </div>;
}

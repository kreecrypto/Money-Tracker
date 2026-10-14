import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {ArrowDownLeft,ArrowRight,ArrowUpRight,BarChart3,CalendarDays,Check,ScanLine,ChevronLeft,ChevronRight,CloudOff,Download,FileSpreadsheet,LayoutDashboard,Menu,MoreHorizontal,Pencil,Plus,Search,Settings as SettingsIcon,ShieldCheck,SlidersHorizontal,Trash2,TrendingDown,Upload,Wallet,WalletCards,X} from 'lucide-react';
import {baht,DEFAULT_SETTINGS,EXPENSE_CATEGORIES,expenseByCategory,INCOME_CATEGORIES,lastMonths,METHODS,monthLocal,monthly,summarize,todayLocal,toSatang,type EntryType,type Method,type Settings,type Transaction} from './lib/finance';
import {deleteTransaction,loadSettings,loadTransactions,replaceAll,saveSettings,saveTransaction,loadPendingSlips,savePendingSlip,deletePendingSlip} from './lib/storage';
import {makePendingSlip,pendingToSlipFields,type PendingSlip} from './lib/pendingSlips';
import PendingSlipsInbox from './PendingSlipsInbox';
import {createBackup,downloadText,parseBackup,toCsv} from './lib/backup';
import SlipScanner from './SlipScanner';
import RestoreDialog from './RestoreDialog';
import LineSyncSettings from './LineSyncSettings';
import IPhoneShortcutSettings from './IPhoneShortcutSettings';
import {iphoneConfigured,iphoneConnected,iphoneDrafts,iphoneSync} from './lib/iphoneSync';
import {lineLinked,syncLineInbox} from './lib/lineSync';
import type {SlipFields} from './lib/slip';
import {prepareAutoSlip} from './lib/slipAutoSave';
import {parseAccountHolderNames} from './lib/slipIdentity';
import type {SlipBatchOutcome,SlipBatchSummary} from './lib/slipBatch';
import {dailyTotals,groupTransactionsByDay,dateSectionLabel} from './lib/spendingInsights';

type Page='home'|'transactions'|'reports'|'settings';
type Filter='all'|'income'|'expense';
const pageLabels:Record<Page,string>={home:'ภาพรวม',transactions:'รายการ',reports:'รายงาน',settings:'ตั้งค่า'};
const navItems=[{key:'home' as const,icon:LayoutDashboard,label:'ภาพรวม'},{key:'transactions' as const,icon:WalletCards,label:'รายการ'},{key:'reports' as const,icon:BarChart3,label:'รายงาน'},{key:'settings' as const,icon:SettingsIcon,label:'ตั้งค่า'}];
const monthText=(value:string)=>{const [year,m]=value.split('-').map(Number);return new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(year,m-1,1));};
const dateText=(date:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${date}T12:00:00`));
const percent=(n:number,d:number)=>d<=0?0:Math.round(n/d*100);
const uuid=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;

function Logo(){return <div className="brand"><div className="brand-logo">฿<span className="brand-dot"/></div><span className="brand-text">เงินวันนี้<small>DAILY MONEY</small></span></div>}
function Empty({title,description,add,actionLabel='เพิ่มรายการ'}:{title:string;description:string;add?:()=>void;icon?:string;actionLabel?:string}){return <div className="empty"><div className="empty-symbol" aria-hidden="true"><WalletCards size={30} strokeWidth={1.5}/></div><b>{title}</b><p>{description}</p>{add&&<button className="btn btn-primary" onClick={add}><Plus size={16}/> {actionLabel}</button>}</div>}
function MoneyCard({title,value,icon,variation}:{title:string;value:number;icon:'income'|'expense'|'net';variation?:string}){
  const Icon=icon==='income'?ArrowDownLeft:icon==='expense'?ArrowUpRight:Wallet;
  return <div className={`metric ${icon}`}><div className="metric-top"><span>{title}</span><span className="metric-icon"><Icon size={18}/></span></div><div className="metric-number">฿{baht(value)}</div><span className="metric-foot">{variation||'ยอดรวมในเดือนที่เลือก'}</span></div>;
}
function TransactionRow({entry,onEdit,onDelete}:{entry:Transaction;onEdit:(t:Transaction)=>void;onDelete:(t:Transaction)=>void}){
  const [actionsOpen,setActionsOpen]=useState(false);
  return <div className="transaction-with-receipt"><div className="transaction-row">
    <div className={`transaction-emoji ${entry.type}`} aria-hidden="true">{entry.category.slice(0,1)}</div>
    <div className="transaction-copy"><strong>{(entry.type==='income'&&entry.sender)||entry.recipient||entry.note||entry.category}</strong><span>{entry.category}{entry.note&&entry.recipient?` · ${entry.note}`:""} <i>·</i> {METHODS[entry.method]}</span></div>
    <div className="transaction-end"><b className={entry.type==='income'?'positive':'negative'}>{entry.type==='income'?'+':'−'}฿{baht(entry.amountSatang)}</b><span>{dateText(entry.date)}{entry.time?` · ${entry.time} น.`:""}</span></div>
    <div className="transaction-actions"><button aria-label={`แก้ไข ${entry.note||entry.category}`} title="แก้ไข" className="icon-btn" onClick={()=>onEdit(entry)}><Pencil size={17}/></button><button aria-label={`ลบ ${entry.note||entry.category}`} title="ลบ" className="icon-btn danger" onClick={()=>onDelete(entry)}><Trash2 size={17}/></button></div>
    <div className="mobile-row-actions"><button className="icon-btn mobile-row-more" title="จัดการรายการ" aria-label={`จัดการ ${entry.note||entry.category}`} aria-expanded={actionsOpen} onClick={()=>setActionsOpen(!actionsOpen)}><MoreHorizontal size={21}/></button>
      {actionsOpen&&<div className="mobile-row-menu" role="group" aria-label="ตัวเลือกรายการ">
        <button onClick={()=>{setActionsOpen(false);onEdit(entry);}}><Pencil size={17}/> แก้ไข</button>
        <button className="danger" onClick={()=>{setActionsOpen(false);onDelete(entry);}}><Trash2 size={17}/> ลบรายการ</button>
      </div>}
    </div>
  </div>
  {entry.receipt&&<details className="receipt-details">
    <summary>ดูรายละเอียดใบเสร็จ{entry.receipt.items.length?' · '+entry.receipt.items.length+' รายการสินค้า':''}</summary>
    <div className="receipt-details-body">
      {entry.receipt.receiptId&&<div className="receipt-detail-line"><span>เลขที่อ้างอิง</span><strong>{entry.receipt.receiptId}</strong></div>}
      {entry.receipt.items.length>0&&<div className="receipt-item-list">{entry.receipt.items.map((item,i)=><div key={i} className="receipt-item-line"><span>{item.quantity} × {item.name}</span><strong>฿{baht(item.lineTotalSatang)}</strong></div>)}</div>}
      {entry.receipt.subtotalSatang!==undefined&&<div className="receipt-detail-line"><span>ยอดก่อนส่วนลด</span><strong>฿{baht(entry.receipt.subtotalSatang)}</strong></div>}
      {entry.receipt.discountSatang!==undefined&&<div className="receipt-detail-line"><span>ส่วนลด</span><strong>−฿{baht(entry.receipt.discountSatang)}</strong></div>}
      {entry.receipt.subsidySatang!==undefined&&<div className="receipt-detail-line"><span>สิทธิช่วยจ่าย</span><strong>−฿{baht(entry.receipt.subsidySatang)}</strong></div>}
      {entry.receipt.feeSatang!==undefined&&<div className="receipt-detail-line"><span>ค่าธรรมเนียม</span><strong>฿{baht(entry.receipt.feeSatang)}</strong></div>}
      <div className="receipt-detail-line receipt-total"><span>ยอดชำระจริง</span><strong>฿{baht(entry.amountSatang)}</strong></div>
    </div>
  </details>}
  </div>;
}
function TxList({items,onEdit,onDelete,limit,groupByDay=false}:{items:Transaction[];onEdit:(t:Transaction)=>void;onDelete:(t:Transaction)=>void;limit?:number;groupByDay?:boolean}){
  const visible=limit?items.slice(0,limit):items;
  if(!groupByDay)return <div className="tx-list">{visible.map(x=><TransactionRow key={x.id} entry={x} onEdit={onEdit} onDelete={onDelete}/>)}</div>;
  const today=todayLocal();
  const yesterday=new Date(today+'T12:00:00');yesterday.setDate(yesterday.getDate()-1);
  return <div className="tx-list tx-list-grouped">{groupTransactionsByDay(visible).map(group=><section className="transaction-day-group" key={group.date} aria-label={'รายการวันที่ '+dateText(group.date)}>
    <div className="transaction-day-heading"><strong>{dateSectionLabel(group.date,today,todayLocal(yesterday),dateText)}</strong><span>{group.items.length} รายการ</span></div>
    {group.items.map(entry=><TransactionRow key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete}/>)}
  </section>)}</div>;
}
function EntryModal({initial,existing,startWithScanner,close,submit,submitImported,undoImported,notifyBatch,queuePending,resolvePending}:{initial:Transaction|null;existing:Transaction[];startWithScanner:boolean;close:()=>void;submit:(t:Transaction)=>Promise<void>;submitImported:(t:Transaction)=>Promise<void>;undoImported:(ids:string[])=>Promise<void>;notifyBatch:(summary:SlipBatchSummary)=>void;queuePending:(slip:SlipFields,name:string,reason:string)=>Promise<{id:string;duplicate:boolean}>;resolvePending:(id:string)=>Promise<void>}){
  const [type,setType]=useState<EntryType>(initial?.type||'expense');
  const [amount,setAmount]=useState(initial?String(initial.amountSatang/100):'');
  const [date,setDate]=useState(initial?.date||todayLocal());
  const [time,setTime]=useState(initial?.time||'');
  const [recipient,setRecipient]=useState(initial?.recipient||'');
  const [category,setCategory]=useState(initial?.category||EXPENSE_CATEGORIES[0]);
  const [method,setMethod]=useState<Method>(initial?.method||'cash');
  const [note,setNote]=useState(initial?.note||'');
  const [pending,setPending]=useState(false);
  const [batchBusy,setBatchBusy]=useState(false);
  const [scannerOpen,setScannerOpen]=useState(startWithScanner&&!initial);
  const [duplicateAcknowledged,setDuplicateAcknowledged]=useState(false);
  const [error,setError]=useState('');
  const first=useRef<HTMLInputElement>(null);
  const dialogRef=useRef<HTMLElement>(null);
  const pendingReviewRef=useRef(0);
  const confirmLeave=()=>pendingReviewRef.current===0||window.confirm(`มีสลิป ${pendingReviewRef.current} รูปที่ยังไม่บันทึก หากออกตอนนี้ข้อมูลที่รอตรวจจะหายไป ต้องการออกหรือไม่?`);
  const safeClose=()=>{if(confirmLeave())close();};
  const closeRef=useRef(safeClose);closeRef.current=safeClose;
  const pendingRef=useRef(pending);pendingRef.current=pending;
  const busyRef=useRef(batchBusy);busyRef.current=batchBusy;
  useEffect(()=>{
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    if(window.innerWidth>660&&!startWithScanner)first.current?.focus();else dialogRef.current?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==='Escape'&&!pendingRef.current&&!busyRef.current){e.preventDefault();closeRef.current();}
      if(e.key!=='Tab')return;
      const controls=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')||[])
      .filter(el=>el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden'&&!el.classList.contains('visually-hidden'));
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
    if(time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){setError('เวลาทำรายการไม่ถูกต้อง');return;}
    if(similar.length&&!duplicateAcknowledged){setError('พบรายการคล้ายกัน กรุณายืนยันก่อนบันทึกซ้ำ');return;}
    const sats=toSatang(amount);if(!sats){setError('กรุณากรอกจำนวนเงินมากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง');return;}
    if(!/^\d{4}-\d\d-\d\d$/.test(date)){setError('กรุณาเลือกวันที่');return;}
    setPending(true);setError('');try{await submit({id:initial?.id||uuid(),type,amountSatang:sats,date,time:time||undefined,recipient:recipient.trim()||undefined,category,note:note.trim().slice(0,500),method,...(initial?.receipt&&sats===initial.amountSatang?{receipt:initial.receipt}:{}),createdAt:initial?.createdAt||Date.now()});close();}catch(err){setError(err instanceof Error?err.message:'บันทึกไม่สำเร็จ');setPending(false);}
  };
  const switchType=(newType:EntryType)=>{setType(newType);setCategory(newType==='expense'?EXPENSE_CATEGORIES[0]:INCOME_CATEGORIES[0]);setError('');};
  const autoImportSlip=async(data:SlipFields):Promise<SlipBatchOutcome>=>{
    // Re-query IndexedDB: another tab or inbox sync might have added the same payment.
    const latest=await loadTransactions();
    const decision=prepareAutoSlip(data,latest,uuid(),Date.now());
    if(decision.status!=='ready')return {status:decision.status,reason:decision.reason};
    setPending(true);
    try{
      await submitImported(decision.transaction);
      return {status:'saved',transactionId:decision.transaction.id,recipient:decision.transaction.type==='income'?(decision.transaction.sender||decision.transaction.recipient):decision.transaction.recipient,amountSatang:decision.transaction.amountSatang,date:decision.transaction.date};
    }finally{setPending(false);}
  };
  const finishBatch=(summary:SlipBatchSummary)=>{
    pendingReviewRef.current=Math.max(0,summary.incomplete-summary.queued);
    notifyBatch(summary);
    // Keep the result screen visible until the user explicitly finishes,
    // so the user can inspect corrections or undo this batch.
  };
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!pending&&!batchBusy)safeClose();}}><section ref={dialogRef} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow">SLIP-FIRST ENTRY</span><h2 id="modal-title">{initial?'แก้ไขรายการ':scannerOpen?'อัปโหลดสลิป':'กรอกรายการเอง'}</h2></div><button className="icon-btn" title="ปิด" aria-label="ปิด" disabled={pending||batchBusy} onClick={safeClose}><X size={21}/></button></div>
  <form onSubmit={save}>
  {!initial&&<div className="slip-entry slip-entry-first">
    {scannerOpen&&<div className="slip-flow" aria-label="ขั้นตอนบันทึกสลิป"><span className="current">1 เลือกรูป</span><span>2 อ่าน OCR</span><span>3 บันทึกหรือรอตรวจ</span></div>}
    <div className="slip-mode-picker" role="group" aria-label="วิธีเพิ่มรายการ">
      <button type="button" aria-pressed={scannerOpen} className={scannerOpen?'active':''} disabled={batchBusy} onClick={()=>setScannerOpen(true)}><ScanLine size={17}/> อัปโหลดสลิป</button>
      <button type="button" aria-pressed={!scannerOpen} className={!scannerOpen?'active':''} disabled={batchBusy} onClick={()=>{if(!confirmLeave())return;pendingReviewRef.current=0;setScannerOpen(false);setError('');}}><Plus size={17}/> กรอกเอง</button>
    </div>
  </div>}
  {scannerOpen?<SlipScanner onApply={autoImportSlip} onBusyChange={setBatchBusy} onComplete={finishBatch} onUndoBatch={undoImported} onQueuePending={queuePending} onResolvePending={resolvePending} onClose={safeClose}/>:<>
  <div className="type-switch" role="group" aria-label="ประเภทรายการ"><button type="button" aria-pressed={type==='expense'} className={type==='expense'?'selected expense':''} onClick={()=>switchType('expense')}><ArrowUpRight size={16}/> เงินออก / รายจ่าย</button><button type="button" aria-pressed={type==='income'} className={type==='income'?'selected income':''} onClick={()=>switchType('income')}><ArrowDownLeft size={16}/> เงินเข้า / รายรับ</button></div>
  <label className="field-label" htmlFor="amount">จำนวนเงิน (บาท)</label><div className="amount-input"><span>฿</span><input id="amount" ref={first} inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} required /></div>
  {similar.length>0&&<div className="duplicate-warning" role="status"><strong>พบ {similar.length} รายการที่อาจซ้ำ</strong><p>มียอด {amount} บาท วันที่ {date} และช่องทางเดียวกัน</p><label><input type="checkbox" checked={duplicateAcknowledged} onChange={e=>setDuplicateAcknowledged(e.target.checked)}/> ยืนยันว่าต้องการบันทึกรายการนี้ซ้ำ</label></div>}
  <div className="field-grid slip-date-time"><div><label className="field-label" htmlFor="entry-date">วันที่ทำรายการ</label><input id="entry-date" type="date" value={date} onChange={e=>setDate(e.target.value)} required/></div><div><label className="field-label" htmlFor="entry-time">เวลาทำรายการ (ถ้ามี)</label><input id="entry-time" type="time" value={time} onChange={e=>setTime(e.target.value)} /></div></div>
  <label className="field-label" htmlFor="recipient">ชื่อผู้รับ (ถ้ามี)</label><input id="recipient" maxLength={160} placeholder="เช่น SYNPHAET BANGNA CO., LTD." value={recipient} onChange={e=>setRecipient(e.target.value)} />
  <div className="field-grid"><div><label className="field-label" htmlFor="category">หมวดหมู่</label><select id="category" value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select></div><div><label className="field-label" htmlFor="method">ช่องทางชำระเงิน / รับเงิน</label><select id="method" value={method} onChange={e=>setMethod(e.target.value as Method)}>{Object.entries(METHODS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></div></div>
  <label className="field-label" htmlFor="note">รายละเอียด <span className="subtle">(ไม่บังคับ)</span></label><input id="note" maxLength={500} placeholder="เช่น กาแฟตอนเช้า" value={note} onChange={e=>setNote(e.target.value)}/>
  {error&&<p className="error-message" role="alert">{error}</p>}
  <div className="modal-footer"><button type="button" className="btn btn-ghost" disabled={pending} onClick={close}>ยกเลิก</button><button type="submit" className="btn btn-primary" disabled={pending}><Check size={17}/>{pending?'กำลังบันทึก...':'บันทึกรายการ'}</button></div></>}</form></section></div>;
}
export default function App(){
  const [items,setItems]=useState<Transaction[]>([]);const [settings,setSettings]=useState<Settings>(DEFAULT_SETTINGS);
  const [view,setView]=useState<Page>('home');const [month,setMonth]=useState(monthLocal());const [modalOpen,setModalOpen]=useState(false);const [scanOnOpen,setScanOnOpen]=useState(false);const [editing,setEditing]=useState<Transaction|null>(null);
  const [inboxTab,setInboxTab]=useState(false);
  const [slipInboxTab,setSlipInboxTab]=useState(false);
  const [pendingSlips,setPendingSlips]=useState<PendingSlip[]>([]);
  const [iphonePending,setIphonePending]=useState<number|null>(null);
  const [iphoneSyncError,setIphoneSyncError]=useState('');
  const [ready,setReady]=useState(false);const [loadingError,setLoadingError]=useState('');const [toast,setToast]=useState('');const [search,setSearch]=useState('');const [filter,setFilter]=useState<Filter>('all');
  const [budgetEdit,setBudgetEdit]=useState('');const [budgetSaving,setBudgetSaving]=useState(false);
  const [accountNamesEdit,setAccountNamesEdit]=useState('');const [accountNamesSaving,setAccountNamesSaving]=useState(false);
  const [lastBackupAt,setLastBackupAt]=useState(()=>{try{return Number(localStorage.getItem('ngoentoday-last-backup')||0);}catch{return 0;}});
  const [pendingRestore,setPendingRestore]=useState<ReturnType<typeof parseBackup>|null>(null);
  const [restoreBusy,setRestoreBusy]=useState(false);
  const importRef=useRef<HTMLInputElement>(null);
  const reloadPending=useCallback(async()=>{setPendingSlips(await loadPendingSlips());},[]);
  const reload=useCallback(async()=>{const [rows,s,pending]=await Promise.all([loadTransactions(),loadSettings(),loadPendingSlips()]);setItems(rows);setSettings(s);setPendingSlips(pending);setBudgetEdit(s.monthlyBudgetSatang?String(s.monthlyBudgetSatang/100):'');setAccountNamesEdit((s.accountHolderNames||[]).join('\n'));},[]);
  useEffect(()=>{reload().catch(e=>setLoadingError(e instanceof Error?e.message:'เปิดฐานข้อมูลไม่สำเร็จ')).finally(()=>setReady(true));},[reload]);
  useEffect(()=>{const onVisible=()=>{if(document.visibilityState==='visible')reload().catch(console.error);};document.addEventListener('visibilitychange',onVisible);return()=>document.removeEventListener('visibilitychange',onVisible);},[reload]);
  useEffect(()=>{const sync=()=>{if(!lineLinked())return;syncLineInbox().then(x=>{if(x.imported>0)void reload();}).catch(()=>{});};sync();const onVisible=()=>{if(document.visibilityState==='visible')sync();};document.addEventListener('visibilitychange',onVisible);return()=>document.removeEventListener('visibilitychange',onVisible);},[reload]);
  useEffect(()=>{
    // Remote records already exist in Supabase after a successful Shortcut POST.
    // Bring them into the local-first dashboard on app open, app resume, and
    // periodically while the app is visible. Never expose an API secret in the bundle.
    let running=false;
    const sync=async()=>{
      if(running||document.visibilityState!=='visible'||!iphoneConfigured()||!iphoneConnected())return;
      running=true;
      try{
        const [result,drafts]=await Promise.all([iphoneSync(),iphoneDrafts()]);
        setIphonePending(drafts.length);
        setIphoneSyncError('');
        if(result.imported>0)await reload();
      }catch(e){
        const reason=e instanceof Error?e.message:'ไม่สามารถเชื่อมต่อได้';
        setIphoneSyncError(reason);
        console.warn('[iphone] sync unavailable',reason);
      }
      finally{running=false;}
    };
    void sync();
    const onVisible=()=>{if(document.visibilityState==='visible')void sync();};
    const interval=window.setInterval(()=>{void sync();},60_000);
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('focus',onVisible);
    return()=>{window.clearInterval(interval);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',onVisible);};
  },[reload]);
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(''),3500);return()=>window.clearTimeout(id);},[toast]);
  const selected=useMemo(()=>monthly(items,month),[items,month]);
  const sums=useMemo(()=>summarize(selected),[selected]);
  const allSums=useMemo(()=>summarize(items),[items]);
  const byCategory=useMemo(()=>expenseByCategory(selected),[selected]);
  const todaySummary=useMemo(()=>dailyTotals(items,todayLocal()),[items]);
  const usedBudget=percent(sums.expense,settings.monthlyBudgetSatang);
  const filtered=useMemo(()=>selected.filter(x=>(filter==='all'||x.type===filter) && (!search.trim()||`${x.category} ${x.note} ${x.recipient||''} ${x.sender||''} ${x.time||''} ${x.receipt?.receiptId||''} ${(x.receipt?.items||[]).map(i=>i.name).join(' ')} ${METHODS[x.method]}`.toLocaleLowerCase('th-TH').includes(search.trim().toLocaleLowerCase('th-TH')))),[selected,filter,search]);
  const history=useMemo(()=>{const [y,m]=month.split('-').map(Number);return lastMonths(6,new Date(y,m-1,1)).map(period=>({...period,...summarize(monthly(items,period.key))}));},[items,month]);
  const maxBar=Math.max(1,...history.map(x=>Math.max(x.income,x.expense)));
  const openReview=()=>{setInboxTab(true);setSlipInboxTab(false);setView('transactions');};
  const openPendingSlips=()=>{setInboxTab(false);setSlipInboxTab(true);setView('transactions');};
  const openAdd=()=>{setScanOnOpen(true);setEditing(null);setModalOpen(true)};
  const openManual=()=>{setScanOnOpen(false);setEditing(null);setModalOpen(true)};
  const onSave=async(t:Transaction)=>{await saveTransaction(t);await reload();setToast(editing?'แก้ไขรายการเรียบร้อย':`บันทึก${t.type==='income'?'รายรับ':'รายจ่าย'} ฿${baht(t.amountSatang)} สำเร็จ`);};
  const onSaveImported=async(t:Transaction)=>{await saveTransaction(t);await reload();};
  const undoImported=async(ids:string[])=>{for(const id of ids)await deleteTransaction(id);await reload();setToast('ยกเลิกการบันทึกจากสลิปแล้ว');};
  const queuePending=async(slip:SlipFields,name:string,reason:string)=>{
    const result=await savePendingSlip(makePendingSlip(slip,name,reason,uuid()));
    await reloadPending();
    return result;
  };
  const resolvePending=async(id:string)=>{await deletePendingSlip(id);await reloadPending();};
  const savePendingTransaction=async(draft:PendingSlip):Promise<{status:'saved'|'duplicate'|'incomplete';reason?:string}>=>{
    const slip=pendingToSlipFields(draft);
    const decision=prepareAutoSlip(slip,await loadTransactions(),uuid(),Date.now());
    if(decision.status==='incomplete')return {status:'incomplete',reason:decision.reason};
    if(decision.status==='duplicate'){
      await deletePendingSlip(draft.id);await reload();
      setToast('รายการนี้ถูกบันทึกไว้แล้ว จึงนำออกจากรอตรวจ');
      return {status:'duplicate'};
    }
    if(decision.status!=='ready')return {status:'incomplete',reason:decision.reason};
    await saveTransaction(decision.transaction);
    try{await deletePendingSlip(draft.id);}
    catch(error){await reload();throw new Error('บันทึกรายการสำเร็จ แต่ลบออกจากคิวรอตรวจไม่ได้ กรุณาลองอีกครั้ง');}
    await reload();setToast('บันทึกจากรายการรอตรวจสำเร็จ ฿'+baht(decision.transaction.amountSatang));
    return {status:'saved'};
  };
  const keepPendingDraft=async(draft:PendingSlip)=>{await savePendingSlip(draft);await reloadPending();};
  const discardPendingDraft=async(id:string)=>{await deletePendingSlip(id);await reloadPending();setToast('นำออกจากรอตรวจแล้ว โดยไม่กระทบรายการที่บันทึก');};
  const onDelete=async(t:Transaction)=>{if(!window.confirm(`ต้องการลบรายการ “${t.note||t.category}” ฿${baht(t.amountSatang)} ใช่หรือไม่?`))return;try{await deleteTransaction(t.id);await reload();setToast('ลบรายการแล้ว');}catch(e){setToast(e instanceof Error?e.message:'ลบรายการไม่สำเร็จ');}};
  const onEdit=(t:Transaction)=>{setScanOnOpen(false);setEditing(t);setModalOpen(true);};
  const changeMonth=(n:number)=>{const [y,m]=month.split('-').map(Number);setMonth(monthLocal(new Date(y,m-1+n,1)));};
  const saveBudget=async(e:FormEvent)=>{e.preventDefault();const n=budgetEdit.trim()===''?0:toSatang(budgetEdit);if(n===null){setToast('ระบุงบประมาณเป็นจำนวนเงินที่ถูกต้อง');return;}try{setBudgetSaving(true);const next={...settings,monthlyBudgetSatang:n};await saveSettings(next);setSettings(next);setToast('บันทึกงบประมาณแล้ว');}catch(err){setToast(err instanceof Error?err.message:'บันทึกไม่สำเร็จ');}finally{setBudgetSaving(false);}};
  const saveAccountNames=async(e:FormEvent)=>{
    e.preventDefault();
    try{
      const names=parseAccountHolderNames(accountNamesEdit);
      setAccountNamesSaving(true);
      const next={...settings,accountHolderNames:names};
      await saveSettings(next);
      setSettings(next);
      setAccountNamesEdit(names.join('\n'));
      setToast(names.length?'บันทึกชื่อบัญชีสำหรับแยกรายรับรายจ่ายแล้ว':'ลบชื่อบัญชีที่ตั้งค่าแล้ว');
    }catch(err){setToast(err instanceof Error?err.message:'บันทึกชื่อบัญชีไม่สำเร็จ');}
    finally{setAccountNamesSaving(false);}
  };
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
  return <div className="app-shell"><aside className="sidebar"><Logo/><div className="workspace-label">WORKSPACE</div><nav aria-label="เมนูหลัก">{navItems.map(({key,label,icon:Icon})=><button key={key} className={`nav-item ${view===key?'active':''}`} aria-label={label} aria-current={view===key?'page':undefined} onClick={()=>setView(key)}><Icon size={19} strokeWidth={1.9}/><span>{label}</span>{view===key&&<span className="nav-active-indicator"/>}</button>)}</nav><div className="sidebar-spacer"/><div className="privacy-card"><div className="privacy-graphic"><ShieldCheck size={24}/></div><strong>ข้อมูลเป็นของคุณ</strong><p>รายการในเครื่องเป็นส่วนตัว; รายการจาก Shortcut เก็บใน Cloud เมื่อเปิดการเชื่อมต่อ</p><span><CloudOff size={13}/> LOCAL FIRST</span></div><p className="sidebar-version">เงินวันนี้ · เวอร์ชัน 0.5.0</p></aside>
    <div className="app-body"><header className="topbar"><div className="topbar-left"><span className="greeting">เงินวันนี้ <span className="mobile-today">· {dateText(todayLocal())}</span></span><h1>{pageLabels[view]}</h1></div><div className="topbar-actions"><div className="today-chip"><CalendarDays size={16}/><span>{dateText(todayLocal())}</span></div><button className="btn btn-primary top-add" onClick={openAdd}><ScanLine size={18}/> <span>อัปโหลดสลิป</span></button></div></header>
    <main className="main-content">
      {view!=='settings'&&view!=='home' && <div className="view-topline"><div><span className="eyebrow">FINANCIAL OVERVIEW</span><h2>{view==='reports'?'มองเห็นภาพรวมการใช้เงิน':slipInboxTab?'สลิปที่รอตรวจ':inboxTab?'ตรวจข้อมูลจาก iPhone':'รายการรายรับ–รายจ่าย'}</h2><p>{view==='reports'?'รู้ว่าเงินของคุณไปอยู่ที่ไหนบ้าง':slipInboxTab?'กลับมาแก้ไขสลิปที่อ่านไม่ครบได้ทุกเมื่อ':inboxTab?'ตรวจข้อมูลที่ยังไม่ครบก่อนบันทึก':'ค้นหาและจัดการรายการที่บันทึกไว้'}</p></div>{(view==='reports'||(!inboxTab&&!slipInboxTab))&&<div className="month-picker"><button aria-label="เดือนก่อนหน้า" title="เดือนก่อนหน้า" onClick={()=>changeMonth(-1)}><ChevronLeft size={18}/></button><span>{monthText(month)}</span><button aria-label="เดือนถัดไป" title="เดือนถัดไป" onClick={()=>changeMonth(1)}><ChevronRight size={18}/></button></div>}</div>}
      {view==='home'&&<div className="home-dashboard">
         <div className="home-month-picker" aria-label="เดือนของภาพรวม"><span className="home-month-caption">ภาพรวมรายเดือน</span><div className="month-picker"><button aria-label="เดือนก่อนหน้า" title="เดือนก่อนหน้า" onClick={()=>changeMonth(-1)}><ChevronLeft size={18}/></button><span>{monthText(month)}</span><button aria-label="เดือนถัดไป" title="เดือนถัดไป" onClick={()=>changeMonth(1)}><ChevronRight size={18}/></button></div></div>
        {items.length>=5&&Date.now()-lastBackupAt>30*24*60*60*1000&&<div className="backup-alert" role="status"><div><strong>อย่าลืมสำรองข้อมูลการเงิน</strong><span>รายการที่เพิ่มในเครื่องอาจสูญหายหากล้างข้อมูลเบราว์เซอร์ กรุณาสำรองข้อมูล</span></div><button type="button" className="btn btn-secondary" onClick={exportJson}>สำรองข้อมูล JSON</button></div>}
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
          <button type="button" className="mobile-action-scan" onClick={openAdd}><span className="quick-action-symbol"><ScanLine size={22}/></span><span><strong>เพิ่มสลิปหรือใบเสร็จ</strong><small>อ่านและบันทึกอัตโนมัติเมื่อข้อมูลครบ</small></span><ArrowRight size={17}/></button>
          <button type="button" className="mobile-action-add" onClick={openManual}><span className="quick-action-symbol"><Plus size={20}/></span><span><strong>กรอกรายการเอง</strong><small>เมื่อไม่มีสลิป</small></span><ArrowRight size={17}/></button>
        </section>
        <section className="daily-snapshot" aria-label="สรุปเงินเข้าออกวันนี้">
          <div className="daily-snapshot-main"><span>วันนี้ใช้ไป</span><strong>฿{baht(todaySummary.expense)}</strong><small>จากรายการที่บันทึก {todaySummary.count} รายการ</small></div>
          <div className="daily-snapshot-income"><span><ArrowDownLeft size={16}/> รับเงินวันนี้</span><strong>+฿{baht(todaySummary.income)}</strong></div>
        </section>
        {pendingSlips.length>0&&<section className="pending-home-alert" role="status" aria-label="รายการรอตรวจจากสลิป">
          <div className="pending-home-icon"><ScanLine size={19}/></div>
          <div><strong>มีสลิป {pendingSlips.length} รูปรอตรวจ</strong>
            <span>ยังไม่รวมในรายรับ–รายจ่าย · เก็บข้อมูลไว้ในเครื่องแล้ว</span></div>
          <button type="button" onClick={openPendingSlips}>ตรวจรายการ <ArrowRight size={16}/></button>
        </section>}
        {settings.monthlyBudgetSatang>0&&sums.expense>settings.monthlyBudgetSatang&&<div className="budget-alert" role="status">⚠️ รายจ่ายเดือนนี้เกินงบที่ตั้งไว้ ฿{baht(sums.expense-settings.monthlyBudgetSatang)}</div>}
        {iphoneConfigured()&&iphoneConnected()&&<section className={"iphone-inbox-banner"+(iphoneSyncError?" is-error":"")} aria-label="สถานะการนำเข้าจาก iPhone">
          <div className="iphone-inbox-banner-copy">
            <strong>{iphoneSyncError?'ซิงก์จาก iPhone ไม่สำเร็จ':iphonePending===null?'กำลังตรวจสถานะรายการจาก iPhone':iphonePending>0?'มีรายการที่ต้องตรวจจาก iPhone '+iphonePending+' รายการ':'นำเข้าจาก iPhone'}</strong>
            <span>{iphoneSyncError?'ยังดึงรายการล่าสุดไม่ได้ รายการในเครื่องยังใช้งานได้':iphonePending===null?'ตรวจสอบการเชื่อมต่อและรายการที่ต้องตรวจ':'รายการที่ต้องตรวจจะยังไม่รวมในยอดรายรับ–รายจ่าย'}</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={iphoneSyncError?()=>setView('settings'):openReview}>
            {iphoneSyncError?'ดูการเชื่อมต่อ':iphonePending&&iphonePending>0?'ตรวจรายการ':'ดูรายการ'} <ArrowRight size={16}/>
          </button>
        </section>}
        <section className="surface transactions-surface"><div className="section-header"><div><span className="card-overline">RECENT ACTIVITY</span><h3>รายการล่าสุด</h3></div><button className="text-action" onClick={()=>setView('transactions')}>ดูทั้งหมด <ArrowRight size={16}/></button></div>{selected.length?<TxList items={selected} onEdit={onEdit} onDelete={onDelete} limit={6}/>:<Empty title={items.length?'เดือนนี้ยังไม่มีรายการ':'เริ่มต้นด้วยสลิปใบแรก'} description="เลือกรูปสลิปหรือใบเสร็จ ระบบจะอ่านและบันทึกเมื่อข้อมูลครบ" add={openAdd} actionLabel="เพิ่มสลิป"/>}</section>
        <section className="surface home-spending-card" aria-label="สัดส่วนรายจ่ายเดือนที่เลือก">
           <div className="section-header"><div><span className="card-overline">SPENDING INSIGHTS</span><h3>3 หมวดที่ใช้จ่ายสูงสุด</h3></div><button type="button" className="text-action" onClick={()=>setView('reports')}>ดูทั้งหมด <ArrowRight size={16}/></button></div>
           {byCategory.length>0?<div className="home-category-list">{byCategory.slice(0,3).map((category,index)=><div className="home-category-row" key={category.name}>
             <div className="home-category-info"><span><b className="home-category-rank">{index+1}</b>{category.name}</span><strong>฿{baht(category.total)}</strong></div>
             <div className="home-category-track" role="progressbar" aria-label={category.name+' คิดเป็นร้อยละของรายจ่ายเดือนที่เลือก'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(category.total,sums.expense)}><span style={{width:percent(category.total,sums.expense)+'%'}}/></div>
           </div>)}</div>:<p className="home-category-empty">ยังไม่มีรายจ่ายในเดือนนี้ สแกนสลิปหรือเพิ่มรายการเพื่อดูว่าใช้เงินไปกับอะไรบ้าง</p>}
         </section>
         <div className="home-report-link"><button type="button" className="btn btn-ghost bordered" onClick={()=>setView('reports')}><BarChart3 size={17}/> ดูรายงานและกราฟทั้งหมด <ArrowRight size={16}/></button></div>
      </div>}
      {view==='transactions'&&<>
        <div className="inbox-view-tabs" role="group" aria-label="หมวดรายการ">
          <button type="button" className={!inboxTab&&!slipInboxTab?'active':''} aria-pressed={!inboxTab&&!slipInboxTab} onClick={()=>{setInboxTab(false);setSlipInboxTab(false);}}>บันทึกแล้ว</button>
          <button type="button" className={slipInboxTab?'active':''} aria-pressed={slipInboxTab} onClick={()=>{setInboxTab(false);setSlipInboxTab(true);}}>
            รอตรวจจากสลิป {pendingSlips.length>0?`(${pendingSlips.length})`:''}
          </button>
          <button type="button" className={inboxTab?'active':''} aria-pressed={inboxTab} onClick={()=>{setInboxTab(true);setSlipInboxTab(false);}}>
            รอตรวจจาก iPhone {iphonePending!==null&&iphonePending>0?`(${iphonePending})`:''}
          </button>
        </div>
        {slipInboxTab?<PendingSlipsInbox items={pendingSlips} onSave={savePendingTransaction} onKeep={keepPendingDraft} onDiscard={discardPendingDraft} onAdd={openAdd}/>:
         inboxTab?<IPhoneShortcutSettings variant="review" onImported={reload} onPendingChanged={setIphonePending}/>:
      <section className="surface transaction-page"><div className="list-tools"><div className="search-box"><Search size={19}/><input type="search" aria-label="ค้นหารายการ" placeholder="ค้นหาชื่อร้าน หมวดหมู่ หรือรหัสอ้างอิง" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button className="search-clear" type="button" aria-label="ล้างคำค้นหา" onClick={()=>setSearch('')}><X size={16}/></button>}</div><div className="filter-tabs" aria-label="กรองประเภทรายการ">{([['all','ทั้งหมด'],['income','รายรับ'],['expense','รายจ่าย']] as const).map(([key,label])=><button key={key} className={filter===key?'selected':''} onClick={()=>setFilter(key)}>{label}</button>)}</div></div><div className="list-count"><SlidersHorizontal size={16}/> แสดง {filtered.length} จาก {selected.length} รายการ <span>· {monthText(month)}</span>{(search||filter!=='all')&&<button className="filter-reset" type="button" onClick={()=>{setSearch('');setFilter('all');}}>ล้างตัวกรอง</button>}</div>{filtered.length?<TxList items={filtered} onEdit={onEdit} onDelete={onDelete} groupByDay/>:<Empty icon="🔎" title={selected.length?'ไม่พบรายการตามเงื่อนไข':'ยังไม่มีรายการในเดือนนี้'} description={selected.length?'ลองล้างคำค้นหาหรือตัวกรองเพื่อดูรายการทั้งหมด':'สแกนสลิปหรือเพิ่มรายการแรกของเดือนนี้'} add={selected.length===0?openAdd:()=>{setSearch('');setFilter('all');}} actionLabel={selected.length?'ล้างตัวกรอง':'เพิ่มสลิป'}/>}</section>
        }
      </>}
      {view==='reports'&&<><div className="stat-triplet"><MoneyCard title="รายรับรวม" value={sums.income} icon="income"/><MoneyCard title="รายจ่ายรวม" value={sums.expense} icon="expense"/><MoneyCard title="เงินสุทธิ" value={sums.net} icon="net"/></div><section className="two-column"><div className="surface chart-surface"><div className="section-header"><div><span className="card-overline">CASH FLOW</span><h3>แนวโน้ม 6 เดือนถึงเดือนที่เลือก</h3></div><div className="chart-legend"><span><i className="legend-income"/>รายรับ</span><span><i className="legend-expense"/>รายจ่าย</span></div></div><div className="bars-chart" role="img" aria-label="แผนภูมิแท่งรายรับและรายจ่ายย้อนหลัง 6 เดือน"><div className="bars-grid"><div/><div/><div/><div/></div>{history.map(h=><div className="bar-slot" key={h.key}><div className="bar-pair"><div className="bar income-bar" title={`รายรับ ${h.label}: ฿${baht(h.income)}`} style={{height:`${h.income?Math.max(3,(h.income/maxBar)*100):0}%`}}/><div className="bar expense-bar" title={`รายจ่าย ${h.label}: ฿${baht(h.expense)}`} style={{height:`${h.expense?Math.max(3,(h.expense/maxBar)*100):0}%`}}/></div><span>{h.label}</span></div>)}</div></div>
          <div className="surface category-surface"><div className="section-header"><div><span className="card-overline">SPENDING ANALYSIS</span><h3>ใช้จ่ายไปกับอะไรบ้าง</h3></div><button className="plain-icon" onClick={()=>setView('reports')} title="ดูรายงานเพิ่มเติม" aria-label="ดูรายงานเพิ่มเติม"><ArrowRight size={19}/></button></div>{byCategory.length? <div className="category-list">{byCategory.slice(0,5).map((c,i)=><div className="category-item" key={c.name}><div className="category-icon" aria-hidden="true">{c.name.slice(0,1)}</div><div className="category-line"><div><strong>{c.name}</strong><span>฿{baht(c.total)}</span></div><div className="track"><div style={{width:`${percent(c.total,sums.expense)}%`,background:['#2e8a78','#e7a969','#8a9bdd','#c39ac9','#93bfa0'][i%5]}}/></div></div></div>)}</div>:<Empty icon="🧾" title="ยังไม่มีข้อมูลรายจ่าย" description="เพิ่มรายการรายจ่ายเพื่อดูสัดส่วนการใช้เงิน"/>}</div></section>
        <section className="two-column report-panels"><div className="surface report-table"><div className="section-header"><div><span className="card-overline">CATEGORY REPORT</span><h3>รายจ่ายตามหมวดหมู่</h3></div><TrendingDown size={20} color="#9aa5a9"/></div>{byCategory.length?byCategory.map((x,i)=><div className="report-category" key={x.name}><span className="category-index">{String(i+1).padStart(2,'0')}</span><span className="report-cat-emoji" aria-hidden="true">{x.name.slice(0,1)}</span><div><strong>{x.name}</strong><span>{percent(x.total,sums.expense)}% ของรายจ่าย</span></div><b>฿{baht(x.total)}</b></div>):<Empty icon="📊" title="รอข้อมูลเพื่อสร้างรายงาน" description="รายงานจะแสดงเมื่อคุณบันทึกรายจ่าย"/>}</div><div className="surface report-summary"><div className="section-header"><div><span className="card-overline">MONTHLY INSIGHTS</span><h3>สรุปการเงิน</h3></div><MoreHorizontal color="#96a2a8" size={22}/></div><div className="report-stat"><span>{sums.net<0?'รายจ่ายมากกว่ารายรับ':'อัตราเก็บเงินจากรายรับ'}</span><strong>{sums.income?`${Math.round(sums.net/sums.income*100)}%`:'—'}</strong></div><div className="report-stat"><span>จำนวนรายการ</span><strong>{selected.length.toLocaleString('th-TH')} รายการ</strong></div><div className="report-stat"><span>ค่าใช้จ่ายเฉลี่ยต่อวันที่ผ่านมา</span><strong>฿{baht(sums.expense/(month===monthLocal()?Number(todayLocal().slice(8)):new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate()))}</strong></div><div className="report-stat"><span>รายรับ-รายจ่ายสุทธิทั้งหมด</span><strong className={allSums.net>=0?'positive':'negative'}>฿{baht(allSums.net)}</strong></div><button className="btn btn-secondary full" onClick={exportCsv}><FileSpreadsheet size={17}/> ดาวน์โหลดรายการทั้งหมด (CSV)</button></div></section></>}
      {view==='settings'&&<><div className="settings-intro"><span className="eyebrow">SETTINGS</span><h2>ตั้งค่าการใช้งาน</h2><p>เชื่อมต่อ iPhone ตั้งงบประมาณ และดูแลข้อมูลส่วนตัว</p></div><div className="settings-grid"><IPhoneShortcutSettings onImported={reload}/><LineSyncSettings onImported={reload}/><section className="surface settings-card"><div className="settings-icon blue"><ShieldCheck size={23}/></div><h3>ชื่อบัญชีของฉัน (สำหรับ OCR)</h3><p>เพิ่มชื่อจริงของเจ้าของบัญชีตามที่ปรากฏบนสลิป เพื่อเทียบชื่อผู้ส่งและผู้รับโดยอัตโนมัติ ชื่อทั้งสองฝั่งตรงกับของฉันจะไม่นับเป็นรายรับหรือรายจ่าย</p><form onSubmit={saveAccountNames}><label className="field-label" htmlFor="ocr-account-names">ชื่อบนบัญชี · 1 ชื่อต่อบรรทัด</label><textarea id="ocr-account-names" className="owner-names-input" rows={3} maxLength={1009} value={accountNamesEdit} onChange={e=>setAccountNamesEdit(e.target.value)} placeholder="นาย สมชาย ใจดี"/><small className="hint">ใส่ชื่อสะกดต่างกันได้สูงสุด 10 ชื่อ ระบบเทียบชื่อเต็มเท่านั้นเพื่อป้องกันการจับคู่ผิด เก็บข้อมูลไว้ในเครื่องของคุณ</small><button type="submit" className="btn btn-primary" disabled={accountNamesSaving}><Check size={17}/>{accountNamesSaving?'กำลังบันทึก':'บันทึกชื่อบัญชี'}</button></form></section><section className="surface settings-card"><div className="settings-icon green"><Wallet size={23}/></div><h3>งบประมาณรายเดือน</h3><p>ตั้งวงเงินรายจ่ายที่ต้องการใช้ในแต่ละเดือน เพื่อคุมการใช้เงินให้เป็นไปตามเป้าหมาย</p><form onSubmit={saveBudget}><label className="field-label" htmlFor="budget">งบประมาณ (บาท/เดือน)</label><div className="budget-field"><span>฿</span><input id="budget" type="text" inputMode="decimal" value={budgetEdit} onChange={e=>setBudgetEdit(e.target.value)} placeholder="เช่น 15000"/></div><small className="hint">เว้นว่างเพื่อลบวงเงินที่ตั้งไว้</small><button className="btn btn-primary" disabled={budgetSaving} type="submit"><Check size={17}/> {budgetSaving?'กำลังบันทึก':'บันทึกงบประมาณ'}</button></form></section><section className="surface settings-card"><div className="settings-icon peach"><Download size={23}/></div><h3>สำรองและนำเข้าข้อมูล</h3><p>ดาวน์โหลดสำเนาเก็บไว้ เพื่อป้องกันการสูญหายเมื่อล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนอุปกรณ์</p><div className="settings-actions"><button className="btn btn-secondary" onClick={exportJson}><Download size={17}/> สำรองข้อมูล JSON</button><button className="btn btn-secondary" onClick={exportCsv}><FileSpreadsheet size={17}/> ส่งออก CSV</button><button className="btn btn-ghost bordered" onClick={()=>importRef.current?.click()}><Upload size={17}/> นำเข้าไฟล์ JSON</button><input ref={importRef} className="visually-hidden" aria-label="เลือกไฟล์สำรองข้อมูล JSON" type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)void importBackup(f);}}/></div></section><section className="surface settings-card privacy-settings"><div className="settings-icon blue"><ShieldCheck size={24}/></div><h3>ข้อมูลและความเป็นส่วนตัว</h3><p>รายการที่กรอกเองและอัปโหลดรูปจะเก็บใน IndexedDB บนอุปกรณ์นี้ ส่วนข้อความ OCR ที่ส่งผ่าน iPhone Shortcut จะเก็บเฉพาะข้อมูลธุรกรรมที่แยกได้ใน Supabase และซิงก์เข้ามาเมื่อเชื่อม Review Token</p><div className="info-banner"><CloudOff size={18}/><span>รายการในเครื่องใช้งานออฟไลน์ได้; รายการจาก iPhone Shortcut จะซิงก์เมื่อเชื่อม API และมีอินเทอร์เน็ต</span></div></section><section className="surface settings-card privacy-settings"><div className="settings-icon lavender"><Menu size={24}/></div><h3>เกี่ยวกับแอป</h3><p>เงินวันนี้เป็นสมุดบันทึกส่วนตัวสำหรับการเงินในชีวิตประจำวัน ไม่ใช่ระบบเชื่อมต่อบัญชีธนาคาร</p><div className="app-meta"><span>เวอร์ชัน</span><strong>0.5.0 · Mobile-first Minimal</strong></div><div className="app-meta"><span>ค่าเริ่มต้น</span><strong>ภาษาไทย · บาท (THB)</strong></div></section></div></>}
    </main><footer className="app-footer">© {new Date().getFullYear()} เงินวันนี้ · เล็กน้อยทุกวัน เปลี่ยนการเงินได้</footer></div>
    <button aria-label="อัปโหลดสลิป" title="อัปโหลดสลิป" className={`mobile-fab ${view==='home'?'home-fab':''}`} onClick={openAdd}><ScanLine size={25}/></button><nav className="mobile-bottom-nav" aria-label="เมนูมือถือ">{navItems.map(({key,label,icon:Icon})=><button key={key} className={view===key?'active':''} aria-current={view===key?'page':undefined} onClick={()=>{if(key==='transactions'){setInboxTab(false);setSlipInboxTab(false);}setView(key);}}><Icon size={21}/><span>{label}</span></button>)}</nav>
    {toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
    {modalOpen&&<EntryModal initial={editing} existing={items} startWithScanner={scanOnOpen} close={()=>setModalOpen(false)} submit={onSave} submitImported={onSaveImported} undoImported={undoImported} queuePending={queuePending} resolvePending={resolvePending} notifyBatch={summary=>{
      if(summary.saved>0)setToast('บันทึกสลิปสำเร็จ '+summary.saved+' รูป'+(summary.duplicate+summary.incomplete+summary.errors?' · รอตรวจ '+(summary.incomplete+summary.errors)+' รูป':''));
      else if(summary.duplicate>0&&summary.incomplete+summary.errors===0)setToast('ตรวจพบสลิปซ้ำ '+summary.duplicate+' รูป ไม่มีรายการใหม่');
      else if(summary.queued>0)setToast('เก็บสลิปรอตรวจในเครื่องแล้ว '+summary.queued+' รูป');
      else if(summary.incomplete+summary.errors>0)setToast('มีสลิป '+(summary.incomplete+summary.errors)+' รูปที่ยังไม่ได้บันทึก กรุณาตรวจข้อมูล');
      else if((summary.excluded||0)>0)setToast('ไม่นับการโอนเงินระหว่างบัญชี '+summary.excluded+' รายการ');
    }}/>}
    {pendingRestore&&<RestoreDialog existingCount={items.length} importedCount={pendingRestore.transactions.length} busy={restoreBusy} onBackup={exportJson} onConfirm={()=>{void confirmRestore();}} onClose={()=>setPendingRestore(null)}/>}
  </div>;
}

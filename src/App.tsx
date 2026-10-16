import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {ArrowDownLeft,ArrowRight,ArrowUpRight,BarChart3,CalendarDays,Check,ScanLine,ChevronLeft,CloudOff,Download,FileSpreadsheet,Menu,MoreHorizontal,Pencil,Plus,Settings as SettingsIcon,ShieldCheck,Trash2,Upload,Wallet,WalletCards,X,House,ReceiptText,UtensilsCrossed,ShoppingBag,TrainFront,HandCoins,Ellipsis,Sprout,} from 'lucide-react';
import {baht,DEFAULT_SETTINGS,EXPENSE_CATEGORIES,INCOME_CATEGORIES,METHODS,monthLocal,monthly,summarize,todayLocal,toSatang,type EntryType,type Method,type Settings,type Transaction} from './lib/finance';
import {deleteTransaction,loadSettings,loadTransactions,replaceAll,saveSettings,saveTransaction,loadPendingSlips,savePendingSlip,deletePendingSlip} from './lib/storage';
import {makePendingSlip,pendingToSlipFields,matchingPendingBySlipHash,type PendingSlip} from './lib/pendingSlips';
import PendingSlipsInbox from './PendingSlipsInbox';
import {createBackup,downloadText,parseBackup,toCsv} from './lib/backup';
import SlipScanner from './SlipScanner';
import HomeScreen,{AppBrandBar,HomeTopbar} from './HomeScreen';
import TransactionsScreen from './TransactionsScreen';
import ReportsScreen from './ReportsScreen';
import RestoreDialog from './RestoreDialog';
import ResetDataDialog from './ResetDataDialog';
import {eraseLocalMoneyTrackerData} from './lib/localDataReset';
import LineSyncSettings from './LineSyncSettings';
import IPhoneShortcutSettings from './IPhoneShortcutSettings';
import {iphoneConfigured,iphoneConnected,iphoneDrafts,iphoneSync,resetIphoneImportHistory} from './lib/iphoneSync';
import {lineLinked,syncLineInbox} from './lib/lineSync';
import type {SlipFields} from './lib/slip';
import {prepareAutoSlip} from './lib/slipAutoSave';
import {sanitizeOwnerNames} from './lib/slipIdentity';
import type {SlipBatchOutcome,SlipBatchSummary} from './lib/slipBatch';
import {groupTransactionsByDay,dateSectionLabel} from './lib/spendingInsights';
import {APP_VERSION,APP_BUILD_SHA,APP_BUILT_AT,hasNewBundle} from './lib/appVersion';

type Page='home'|'transactions'|'reports'|'settings';
type Filter='all'|'income'|'expense';
const pageLabels:Record<Page,string>={home:'ภาพรวม',transactions:'รายการ',reports:'รายงาน',settings:'ตั้งค่า'};
const navItems=[{key:'home' as const,icon:House,label:'ภาพรวม'},{key:'transactions' as const,icon:ReceiptText,label:'รายการ'},{key:'reports' as const,icon:BarChart3,label:'รายงาน'},{key:'settings' as const,icon:SettingsIcon,label:'ตั้งค่า'}];
const monthText=(value:string)=>{const [year,m]=value.split('-').map(Number);return new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(year,m-1,1));};
const dateText=(date:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${date}T12:00:00`));
function CategoryGlyph({category,type}:{category:string;type:EntryType}){
  const food=/อาหาร|ข้าว|กาแฟ|เครื่องดื่ม|ร้าน|restaurant|cafe/i.test(category);
  const shop=/ซื้อ|ช้อป|สินค้า|shopping|shopee/i.test(category);
  const transport=/เดินทาง|รถ|ขนส่ง|bts|mrt/i.test(category);
  const home=/บ้าน|ที่อยู่|น้ำ|ไฟ|ค่าเช่า/i.test(category);
  const Icon=type==='income'?HandCoins:food?UtensilsCrossed:shop?ShoppingBag:transport?TrainFront:home?House:Ellipsis;
  return <span className={`money-category-icon ${type==='income'?'cat-income':food?'cat-food':shop?'cat-shopping':transport?'cat-transport':home?'cat-home':'cat-other'}`} aria-hidden="true"><Icon size={19} strokeWidth={2}/></span>;
}
const uuid=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;

function Logo(){return <div className="brand"><div className="brand-logo mt-app-brand-logo" aria-hidden="true"><Sprout size={25} strokeWidth={2.8}/></div><span className="brand-text">เงินวันนี้<small>DAILY MONEY</small></span></div>}
function Empty({title,description,add,actionLabel='เพิ่มรายการ'}:{title:string;description:string;add?:()=>void;icon?:string;actionLabel?:string}){return <div className="empty"><div className="empty-symbol" aria-hidden="true"><WalletCards size={30} strokeWidth={1.5}/></div><b>{title}</b><p>{description}</p>{add&&<button className="btn btn-primary" onClick={add}><Plus size={16}/> {actionLabel}</button>}</div>}
function TransactionRow({entry,onEdit,onDelete}:{entry:Transaction;onEdit:(t:Transaction)=>void;onDelete:(t:Transaction)=>void}){
  const [actionsOpen,setActionsOpen]=useState(false);
  const actionsRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!actionsOpen)return;
    const onOutside=(event:PointerEvent)=>{
      if(event.target instanceof Node&&!actionsRef.current?.contains(event.target))setActionsOpen(false);
    };
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){setActionsOpen(false);event.stopPropagation();}
    };
    document.addEventListener('pointerdown',onOutside);
    document.addEventListener('keydown',onKey);
    return ()=>{
      document.removeEventListener('pointerdown',onOutside);
      document.removeEventListener('keydown',onKey);
    };
  },[actionsOpen]);
  return <div className="transaction-with-receipt"><div className="transaction-row">
    <CategoryGlyph category={entry.category} type={entry.type}/>
    <div className="transaction-copy"><strong>{entry.recipient||entry.note||entry.category}</strong><span>{entry.category}{entry.sender?` · จาก ${entry.sender}`:''}{entry.note&&entry.recipient?` · ${entry.note}`:""} <i>·</i> {METHODS[entry.method]}</span></div>
    <div className="transaction-end"><b className={entry.type==='income'?'positive':'negative'}>{entry.type==='income'?'+':'−'}฿{baht(entry.amountSatang)}</b><span>{dateText(entry.date)}{entry.time?` · ${entry.time} น.`:""}</span></div>
    <div className="transaction-actions"><button aria-label={`แก้ไข ${entry.note||entry.category}`} title="แก้ไข" className="icon-btn" onClick={()=>onEdit(entry)}><Pencil size={17}/></button><button aria-label={`ลบ ${entry.note||entry.category}`} title="ลบ" className="icon-btn danger" onClick={()=>onDelete(entry)}><Trash2 size={17}/></button></div>
    <div className="mobile-row-actions" ref={actionsRef}><button className="icon-btn mobile-row-more" title="จัดการรายการ" aria-label={`จัดการ ${entry.note||entry.category}`} aria-expanded={actionsOpen} onClick={()=>setActionsOpen(!actionsOpen)}><MoreHorizontal size={21}/></button>
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
    <div className="transaction-day-heading"><strong>{dateSectionLabel(group.date,today,todayLocal(yesterday),dateText)} · {dateText(group.date)}</strong><span className={group.items.reduce((t,item)=>t+(item.type==='income'?item.amountSatang:-item.amountSatang),0)>=0?'positive':'negative'}>{group.items.reduce((t,item)=>t+(item.type==='income'?item.amountSatang:-item.amountSatang),0)>=0?'+':'−'}฿{baht(Math.abs(group.items.reduce((t,item)=>t+(item.type==='income'?item.amountSatang:-item.amountSatang),0)))}</span></div>
    {group.items.map(entry=><TransactionRow key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete}/>)}
  </section>)}</div>;
}
function EntryModal({initial,existing,startWithScanner,close,submit,submitImported,undoImported,notifyBatch,queuePending,resolvePending,ownerNames,viewSaved}:{initial:Transaction|null;existing:Transaction[];startWithScanner:boolean;close:()=>void;submit:(t:Transaction)=>Promise<void>;submitImported:(t:Transaction)=>Promise<void>;undoImported:(ids:string[])=>Promise<void>;notifyBatch:(summary:SlipBatchSummary)=>void;queuePending:(slip:SlipFields,name:string,reason:string)=>Promise<{id:string;duplicate:boolean}>;resolvePending:(id:string)=>Promise<void>;ownerNames:readonly string[];viewSaved:(date:string)=>void}){
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
      return {status:'saved',transactionId:decision.transaction.id,recipient:decision.transaction.recipient,amountSatang:decision.transaction.amountSatang,date:decision.transaction.date,direction:decision.transaction.type};
    }finally{setPending(false);}
  };
  const finishBatch=(summary:SlipBatchSummary)=>{
    pendingReviewRef.current=Math.max(0,summary.incomplete-summary.queued);
    notifyBatch(summary);
    // Keep the result screen visible until the user explicitly finishes,
    // so the user can inspect corrections or undo this batch.
  };
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!pending&&!batchBusy)safeClose();}}><section ref={dialogRef} tabIndex={-1} className={`modal ${scannerOpen?'ref-ocr-modal':''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="eyebrow">เพิ่มรายการ</span><h2 id="modal-title">{initial?'แก้ไขรายการ':scannerOpen?'อัปโหลดสลิป':'กรอกรายการเอง'}</h2></div><button className="icon-btn" title={scannerOpen?'ย้อนกลับ':'ปิด'} aria-label={scannerOpen?'ย้อนกลับ':'ปิด'} disabled={pending||batchBusy} onClick={safeClose}>{scannerOpen?<ChevronLeft size={23}/>:<X size={21}/>}</button></div>
  <form onSubmit={save}>
  {!initial&&<div className="slip-entry slip-entry-first">
    {scannerOpen&&<div className="slip-flow" aria-label="ขั้นตอนบันทึกสลิป"><span className="current">1 เลือกรูป</span><span>2 อ่านข้อมูลจากสลิป</span><span>3 บันทึกหรือรอตรวจ</span></div>}
    <div className="slip-mode-picker" role="group" aria-label="วิธีเพิ่มรายการ">
      <button type="button" aria-pressed={scannerOpen} className={scannerOpen?'active':''} disabled={batchBusy} onClick={()=>setScannerOpen(true)}><ScanLine size={17}/> อัปโหลดสลิป</button>
      <button type="button" aria-pressed={!scannerOpen} className={!scannerOpen?'active':''} disabled={batchBusy} onClick={()=>{if(!confirmLeave())return;pendingReviewRef.current=0;setScannerOpen(false);setError('');}}><Plus size={17}/> กรอกเอง</button>
    </div>
  </div>}
  {scannerOpen?<SlipScanner ownerNames={ownerNames} onApply={autoImportSlip} onBusyChange={setBatchBusy} onComplete={finishBatch} onUndoBatch={undoImported} onQueuePending={queuePending} onResolvePending={resolvePending} onClose={safeClose} onViewSaved={date=>{if(confirmLeave())viewSaved(date);}}/>:<>
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
  const [reportTab,setReportTab]=useState<'overview'|'categories'|'trends'|'budget'>('overview');
  const [view,setView]=useState<Page>('home');const [month,setMonth]=useState(monthLocal());const [modalOpen,setModalOpen]=useState(false);const [scanOnOpen,setScanOnOpen]=useState(false);const [editing,setEditing]=useState<Transaction|null>(null);
  const [updateAvailable,setUpdateAvailable]=useState(false);
  const [inboxTab,setInboxTab]=useState(false);
  const [slipInboxTab,setSlipInboxTab]=useState(false);
  const [pendingSlips,setPendingSlips]=useState<PendingSlip[]>([]);
  const [iphonePending,setIphonePending]=useState<number|null>(null);
  const [iphoneSyncError,setIphoneSyncError]=useState('');
  const [ready,setReady]=useState(false);const [loadingError,setLoadingError]=useState('');const [toast,setToast]=useState('');const [search,setSearch]=useState('');const [filter,setFilter]=useState<Filter>('all');
  const [budgetEdit,setBudgetEdit]=useState('');const [budgetSaving,setBudgetSaving]=useState(false);
  const [ownerNamesEdit,setOwnerNamesEdit]=useState('');const [ownerNamesSaving,setOwnerNamesSaving]=useState(false);
  const [lastBackupAt,setLastBackupAt]=useState(()=>{try{return Number(localStorage.getItem('ngoentoday-last-backup')||0);}catch{return 0;}});
  const [pendingRestore,setPendingRestore]=useState<ReturnType<typeof parseBackup>|null>(null);
  const [resetDialogOpen,setResetDialogOpen]=useState(false);
  const [resetBusy,setResetBusy]=useState(false);
  const [resetError,setResetError]=useState('');
  const [repairBusy,setRepairBusy]=useState(false);
  const [restoreBusy,setRestoreBusy]=useState(false);
  const importRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    document.title=`${pageLabels[view]} — เงินวันนี้`;
    window.scrollTo({top:0,behavior:'auto'});
  },[view]);
  const reloadPending=useCallback(async()=>{setPendingSlips(await loadPendingSlips());},[]);
  const reload=useCallback(async()=>{const [rows,s,pending]=await Promise.all([loadTransactions(),loadSettings(),loadPendingSlips()]);setItems(rows);setSettings(s);setPendingSlips(pending);setBudgetEdit(s.monthlyBudgetSatang?String(s.monthlyBudgetSatang/100):'');setOwnerNamesEdit((s.ownerNames||[]).join('\n'));},[]);
  useEffect(()=>{reload().catch(e=>setLoadingError(e instanceof Error?e.message:'เปิดฐานข้อมูลไม่สำเร็จ')).finally(()=>setReady(true));},[reload]);
  useEffect(()=>{const onVisible=()=>{if(document.visibilityState==='visible')reload().catch(console.error);};document.addEventListener('visibilitychange',onVisible);return()=>document.removeEventListener('visibilitychange',onVisible);},[reload]);
  useEffect(()=>{
    let disposed=false;
    const check=async()=>{
      if(document.visibilityState==='hidden'||!navigator.onLine)return;
      try{
        const response=await fetch('/index.html',{cache:'no-store'});
        if(!response.ok)return;
        const current=document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')?.getAttribute('src')||'';
        if(!disposed&&hasNewBundle(await response.text(),current))setUpdateAvailable(true);
      }catch{/* Offline use continues; never block expense tracking. */}
    };
    void check();
    const onVisible=()=>{if(document.visibilityState==='visible')void check();};
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('focus',check);
    return()=>{disposed=true;document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',check);};
  },[]);
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
        setIphoneSyncError(result.invalid>0
          ?'รายการจาก iPhone '+result.invalid+' รายการมีข้อมูลไม่ถูกต้องและยังไม่ถูกนำเข้า'
          :'');
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
  const filtered=useMemo(()=>selected.filter(x=>(filter==='all'||x.type===filter) && (!search.trim()||`${x.category} ${x.note} ${x.recipient||''} ${x.time||''} ${x.receipt?.receiptId||''} ${(x.receipt?.items||[]).map(i=>i.name).join(' ')} ${METHODS[x.method]}`.toLocaleLowerCase('th-TH').includes(search.trim().toLocaleLowerCase('th-TH')))),[selected,filter,search]);
  const openReview=()=>{setInboxTab(true);setSlipInboxTab(false);setView('transactions');};
  const openPendingSlips=()=>{setInboxTab(false);setSlipInboxTab(true);setView('transactions');};
  const openAdd=()=>{setScanOnOpen(true);setEditing(null);setModalOpen(true)};
  const onSave=async(t:Transaction)=>{await saveTransaction(t);await reload();setToast(editing?'แก้ไขรายการเรียบร้อย':`บันทึก${t.type==='income'?'รายรับ':'รายจ่าย'} ฿${baht(t.amountSatang)} สำเร็จ`);};
  const onSaveImported=async(t:Transaction)=>{
    await saveTransaction(t);
    // A corrected re-upload of the exact same photo can now be saved. Clear
    // its stale local review entry only after the transaction is persisted.
    // A failed cleanup must never turn a successful save into a retry that
    // could create a duplicate financial transaction.
    if(t.slipHash){
      try{
        const matches=matchingPendingBySlipHash(await loadPendingSlips(),t.slipHash);
        await Promise.allSettled(matches.map(id=>deletePendingSlip(id)));
      }catch{/* Saved transaction remains authoritative; pending can be removed manually. */}
    }
    await reload();
  };
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
  const saveOwnerNames=async(e:FormEvent)=>{e.preventDefault();
    const requested=ownerNamesEdit.split(/\r?\n/u).map(x=>x.trim()).filter(Boolean);
    const ownerNames=sanitizeOwnerNames(requested);
    if(requested.length>8||ownerNames.length!==requested.length){
      setToast('กรุณากรอกชื่อที่ปรากฏบนสลิป ไม่ซ้ำกัน 1 ชื่อต่อบรรทัด สูงสุด 8 ชื่อ');return;
    }
    try{setOwnerNamesSaving(true);const next={...settings,ownerNames};
      await saveSettings(next);setSettings(next);setOwnerNamesEdit(ownerNames.join('\n'));
      setToast(ownerNames.length?'บันทึกชื่อของคุณเพื่อช่วยอ่านสลิปแล้ว':'ลบชื่อเจ้าของบัญชีแล้ว');
    }catch(err){setToast(err instanceof Error?err.message:'บันทึกชื่อบัญชีไม่สำเร็จ');}
    finally{setOwnerNamesSaving(false);}
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
  const repairIphoneSync=async()=>{
    if(!iphoneConnected()){setToast('เชื่อมต่อ iPhone ด้วย Review Token ก่อนซ่อมการซิงก์');return;}
    setRepairBusy(true);
    try{
      resetIphoneImportHistory();
      const result=await iphoneSync();
      await reload();
      setToast('ตรวจรายการจาก iPhone อีกครั้งแล้ว · นำเข้า '+result.imported+' รายการ');
    }catch(e){
      setToast(e instanceof Error?e.message:'ซ่อมการซิงก์ไม่สำเร็จ');
    }finally{setRepairBusy(false);}
  };
  const eraseDeviceData=async()=>{
    if(resetBusy)return;
    setResetBusy(true);setResetError('');
    try{
      await eraseLocalMoneyTrackerData();
      // A hard reload also stops current sync intervals and clears stale React state.
      window.location.reload();
    }catch(e){
      setResetError(e instanceof Error?e.message:'ลบข้อมูลในเครื่องไม่สำเร็จ');
      setResetBusy(false);
    }
  };
  if(!ready) return <div className="loading-screen"><div className="loading-icon">฿</div>กำลังเปิดสมุดบันทึกของคุณ...</div>;
  if(loadingError) return <div className="loading-screen"><span>⚠️</span><h2>ไม่สามารถเปิดข้อมูลได้</h2><p>{loadingError}</p><button className="btn btn-primary" onClick={()=>window.location.reload()}>ลองอีกครั้ง</button></div>;
  return <div className="app-shell"><a href="#main-content" className="skip-link">ข้ามไปยังเนื้อหาหลัก</a><aside className="sidebar"><Logo/><div className="workspace-label">เมนูหลัก</div><nav aria-label="เมนูหลัก">{navItems.map(({key,label,icon:Icon})=><button key={key} className={`nav-item ${view===key?'active':''}`} aria-label={label} aria-current={view===key?'page':undefined} onClick={()=>setView(key)}><Icon size={19} strokeWidth={1.9}/><span>{label}</span>{view===key&&<span className="nav-active-indicator"/>}</button>)}</nav><div className="sidebar-spacer"/><div className="privacy-card"><div className="privacy-graphic"><ShieldCheck size={24}/></div><strong>ข้อมูลเป็นของคุณ</strong><p>รายการในเครื่องเป็นส่วนตัว; รายการจาก Shortcut เก็บใน Cloud เมื่อเปิดการเชื่อมต่อ</p><span><CloudOff size={13}/> เก็บข้อมูลในเครื่อง</span></div><p className="sidebar-version">เงินวันนี้ · v{APP_VERSION} · {APP_BUILD_SHA}</p></aside>
    <div className="app-body"><header className={`topbar ${view==='home'?'topbar-home home-v2-topbar':'mt-shared-topbar'}`}>{view==='home'
      ?<HomeTopbar pendingCount={pendingSlips.length+(iphonePending||0)} onNotifications={()=>{if(pendingSlips.length)openPendingSlips();else if(iphonePending&&iphonePending>0)openReview();else setToast('ยังไม่มีรายการที่ต้องตรวจในตอนนี้');}} onSettings={()=>setView('settings')}/>
      :<><div className="mt-home-topbar mt-app-topbar"><AppBrandBar pendingCount={pendingSlips.length+(iphonePending||0)} onNotifications={()=>{if(pendingSlips.length)openPendingSlips();else if(iphonePending&&iphonePending>0)openReview();else setToast('ยังไม่มีรายการที่ต้องตรวจในตอนนี้');}} onSettings={()=>setView('settings')}/></div><div className="topbar-actions"><div className="today-chip"><CalendarDays size={16}/><span>{dateText(todayLocal())}</span></div><button className="btn btn-primary top-add" onClick={openAdd}><ScanLine size={18}/> <span>อัปโหลดสลิป</span></button></div></>}</header>
    <main id="main-content" className="main-content" tabIndex={-1}>
      {updateAvailable&&<div className="app-update-notice" role="status"><div><strong>มีแอปเวอร์ชันใหม่พร้อมใช้งาน</strong><span>อัปเดตหน้าเว็บโดยไม่ลบรายการที่บันทึกในเครื่อง</span></div><button type="button" className="btn btn-primary" onClick={()=>window.location.reload()}>โหลดเวอร์ชันใหม่</button></div>}
      {view==='home'&&<>
        <HomeScreen
          month={month} monthLabel={monthText(month)} net={sums.net} income={sums.income} expense={sums.expense}
          recent={selected}
          onMonthChange={setMonth}
          onUpload={openAdd}
          onTransactions={()=>{setInboxTab(false);setSlipInboxTab(false);setView('transactions');}}
          onReports={()=>setView('reports')}
          onBudget={()=>setView('settings')}
          onSettings={()=>setView('settings')}
        />
        <div className="mt-home-below">
          {(settings.ownerNames||[]).length===0&&<div className="mt-home-advisory"><div><strong>เพิ่มชื่อของคุณบนสลิป</strong><p>ช่วยให้แยกรายรับและรายจ่ายอัตโนมัติได้แม่นยำขึ้น</p></div><button type="button" onClick={()=>setView('settings')}>ตั้งชื่อของฉัน <ArrowRight size={16}/></button></div>}
          {pendingSlips.length>0&&<div className="mt-home-advisory mt-home-review pending-home-alert"><div><strong>มีสลิปรอตรวจ {pendingSlips.length} รายการ</strong><p>รายการที่ยังไม่ตรวจจะไม่รวมในยอดเงิน</p></div><button type="button" onClick={openPendingSlips}>ตรวจรายการ <ArrowRight size={16}/></button></div>}
          {items.length>=5&&Date.now()-lastBackupAt>30*24*60*60*1000&&<div className="mt-home-advisory"><div><strong>สำรองข้อมูลการเงิน</strong><p>ข้อมูลในเครื่องอาจสูญหายหากล้างข้อมูลของ Safari</p></div><button type="button" onClick={exportJson}>สำรอง JSON</button></div>}
          {iphoneConfigured()&&iphoneConnected()&&iphoneSyncError&&<div className="mt-home-advisory"><div><strong>ซิงก์จาก iPhone ไม่สำเร็จ</strong><p>รายการเดิมในเครื่องยังใช้งานได้</p></div><button type="button" onClick={()=>setView('settings')}>ดูการเชื่อมต่อ</button></div>}
        </div>
      </>}
            {view==='transactions'&&<>
        {(pendingSlips.length>0||(iphonePending!==null&&iphonePending>0)||slipInboxTab||inboxTab)&&<div className="inbox-view-tabs" role="group" aria-label="หมวดรายการ">
          <button type="button" className={!inboxTab&&!slipInboxTab?'active':''} aria-pressed={!inboxTab&&!slipInboxTab} onClick={()=>{setInboxTab(false);setSlipInboxTab(false);}}>บันทึกแล้ว</button>
          <button type="button" className={slipInboxTab?'active':''} aria-pressed={slipInboxTab} onClick={()=>{setInboxTab(false);setSlipInboxTab(true);}}>
            รอตรวจจากสลิป {pendingSlips.length>0?`(${pendingSlips.length})`:''}
          </button>
          <button type="button" className={inboxTab?'active':''} aria-pressed={inboxTab} onClick={()=>{setInboxTab(true);setSlipInboxTab(false);}}>
            รอตรวจจาก iPhone {iphonePending!==null&&iphonePending>0?`(${iphonePending})`:''}
          </button>
        </div>}
        {slipInboxTab?<PendingSlipsInbox items={pendingSlips} onSave={savePendingTransaction} onKeep={keepPendingDraft} onDiscard={discardPendingDraft} onAdd={openAdd}/>:
         inboxTab?<IPhoneShortcutSettings variant="review" onImported={reload} onPendingChanged={setIphonePending}/>:
      <TransactionsScreen monthLabel={monthText(month)} income={sums.income} expense={sums.expense}
          search={search} filter={filter} selectedCount={selected.length} visibleCount={filtered.length}
          onSearch={setSearch} onFilter={setFilter} onMonthChange={changeMonth}>
          {filtered.length?<TxList items={filtered} onEdit={onEdit} onDelete={onDelete} groupByDay/>:
            <Empty title={selected.length?'ไม่พบรายการตามเงื่อนไข':'ยังไม่มีรายการในเดือนนี้'}
             description={selected.length?'ลองล้างคำค้นหาหรือตัวกรองเพื่อดูรายการทั้งหมด':'สแกนสลิปหรือเพิ่มรายการแรกของเดือนนี้'}
             add={selected.length===0?openAdd:()=>{setSearch('');setFilter('all');}}
             actionLabel={selected.length?'ล้างตัวกรอง':'เพิ่มสลิป'}/>}
        </TransactionsScreen>
        }
      </>}
      {view==='reports'&&<ReportsScreen items={items} month={month} monthLabel={monthText(month)}
        budget={settings.monthlyBudgetSatang} tab={reportTab} onTab={setReportTab}
        onMonthChange={changeMonth} onSettings={()=>setView('settings')}/>}
      {view==='settings'&&<><div className="settings-intro"><span className="eyebrow">จัดการแอป</span><h2>ตั้งค่าการใช้งาน</h2><p>ตั้งงบประมาณ จัดการบัญชี และดูแลข้อมูลของคุณ</p></div><div className="settings-grid">
    <section className="surface settings-card ocr-owner-card">
      <div className="settings-icon blue"><ScanLine size={23}/></div>
      <h3>ชื่อของฉันบนสลิป</h3>
      <p>เพิ่มชื่อที่ใช้รับหรือโอนเงินตามที่แสดงบนสลิป (หนึ่งชื่อต่อบรรทัด) เพื่อช่วยแยกรายรับและรายจ่าย ไม่ต้องกรอกเลขบัญชี</p>
      <form onSubmit={saveOwnerNames}>
        <label className="field-label" htmlFor="ocr-owner-names">ชื่อผู้ถือบัญชีตามสลิป</label>
        <textarea id="ocr-owner-names" className="ocr-owner-input" rows={3} maxLength={1295}
          placeholder={'เช่น นาย สมชาย ใจดี\nสมชาย ใจดี'}
          value={ownerNamesEdit} onChange={e=>setOwnerNamesEdit(e.target.value)}/>
        <small className="hint">ชื่อเราเป็นผู้ส่ง = เงินออก · เป็นผู้รับ = เงินเข้า · หากเป็นชื่อเราทั้งสองฝั่งหรืออ่านชื่อไม่ชัด ระบบจะให้ตรวจสอบก่อนบันทึก</small>
        <button className="btn btn-primary" type="submit" disabled={ownerNamesSaving}>
          <Check size={17}/>{ownerNamesSaving?'กำลังบันทึก':'บันทึกชื่อของฉัน'}
        </button>
      </form>
    </section>
    <IPhoneShortcutSettings onImported={reload}/><LineSyncSettings onImported={reload}/><section className="surface settings-card"><div className="settings-icon green"><Wallet size={23}/></div><h3>งบประมาณรายเดือน</h3><p>ตั้งวงเงินรายจ่ายที่ต้องการใช้ในแต่ละเดือน เพื่อคุมการใช้เงินให้เป็นไปตามเป้าหมาย</p><form onSubmit={saveBudget}><label className="field-label" htmlFor="budget">งบประมาณ (บาท/เดือน)</label><div className="budget-field"><span>฿</span><input id="budget" type="text" inputMode="decimal" value={budgetEdit} onChange={e=>setBudgetEdit(e.target.value)} placeholder="เช่น 15000"/></div><small className="hint">เว้นว่างเพื่อลบวงเงินที่ตั้งไว้</small><button className="btn btn-primary" disabled={budgetSaving} type="submit"><Check size={17}/> {budgetSaving?'กำลังบันทึก':'บันทึกงบประมาณ'}</button></form></section><section className="surface settings-card"><div className="settings-icon peach"><Download size={23}/></div><h3>จัดการข้อมูล</h3><p>ดาวน์โหลดสำเนาเก็บไว้ เพื่อป้องกันการสูญหายเมื่อล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนอุปกรณ์</p><div className="settings-actions"><button className="btn btn-secondary" onClick={exportJson}><Download size={17}/> สำรองข้อมูล JSON</button><button className="btn btn-secondary" onClick={exportCsv}><FileSpreadsheet size={17}/> ส่งออก CSV</button><button className="btn btn-ghost bordered" onClick={()=>importRef.current?.click()}><Upload size={17}/> นำเข้าไฟล์ JSON</button><input ref={importRef} className="visually-hidden" aria-label="เลือกไฟล์สำรองข้อมูล JSON" type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)void importBackup(f);}}/></div>
  <div className="data-reset-options">
    <div className="data-repair-option">
      <div><strong>ซ่อมการซิงก์ iPhone</strong><p>ตรวจรายการที่เคยบันทึกใน Cloud อีกครั้ง โดยไม่ลบรายการหรือรหัสเชื่อมต่อในเครื่อง</p></div>
      <button className="btn btn-secondary" type="button" disabled={repairBusy} onClick={()=>{void repairIphoneSync();}}>
        {repairBusy?'กำลังตรวจรายการ...':'ตรวจและนำเข้ารายการอีกครั้ง'}
      </button>
    </div>
    <div className="data-clear-option">
      <div><strong>ลบข้อมูลในเครื่อง</strong><p>ลบรายการ สลิปรอตรวจ การตั้งค่า และการเชื่อมต่อบนอุปกรณ์นี้ ไม่ลบข้อมูล Supabase</p></div>
      <button className="btn btn-ghost bordered data-delete-btn" type="button" onClick={()=>{setResetError('');setResetDialogOpen(true);}}>
        <Trash2 size={17}/> ลบข้อมูลในเครื่อง
      </button>
    </div>
  </div></section><section className="surface settings-card privacy-settings"><div className="settings-icon blue"><ShieldCheck size={24}/></div><h3>ข้อมูลและความเป็นส่วนตัว</h3><p>รายการที่กรอกเองและอัปโหลดรูปจะเก็บใน IndexedDB บนอุปกรณ์นี้ ส่วนข้อความ OCR ที่ส่งผ่าน iPhone Shortcut จะเก็บเฉพาะข้อมูลธุรกรรมที่แยกได้ใน Supabase และซิงก์เข้ามาเมื่อเชื่อม Review Token</p><div className="info-banner"><CloudOff size={18}/><span>รายการในเครื่องใช้งานออฟไลน์ได้; รายการจาก iPhone Shortcut จะซิงก์เมื่อเชื่อม API และมีอินเทอร์เน็ต</span></div></section><section className="surface settings-card privacy-settings"><div className="settings-icon lavender"><Menu size={24}/></div><h3>เกี่ยวกับแอป</h3><p>เงินวันนี้เป็นสมุดบันทึกส่วนตัวสำหรับการเงินในชีวิตประจำวัน ไม่ใช่ระบบเชื่อมต่อบัญชีธนาคาร</p><div className="app-meta"><span>เวอร์ชันแอป</span><strong>{APP_VERSION}</strong></div><div className="app-meta"><span>Build ที่ใช้งาน</span><strong>{APP_BUILD_SHA}</strong></div><div className="app-meta"><span>สร้างเมื่อ</span><strong>{new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(APP_BUILT_AT))}</strong></div><div className="app-meta"><span>ค่าเริ่มต้น</span><strong>ภาษาไทย · บาท (THB)</strong></div></section></div></>}
    </main><footer className="app-footer">© {new Date().getFullYear()} เงินวันนี้ · เล็กน้อยทุกวัน เปลี่ยนการเงินได้</footer></div>
    <button aria-label="อัปโหลดสลิป" title="อัปโหลดสลิป" className={`mobile-fab ${view==='home'?'home-fab':''} ${view!=='transactions'?'ref-fab-hidden':''}`} onClick={openAdd}><ScanLine size={25}/></button><nav className="mobile-bottom-nav" aria-label="เมนูมือถือ">{navItems.map(({key,label,icon:Icon})=><button key={key} className={view===key?'active':''} aria-current={view===key?'page':undefined} onClick={()=>{if(key==='transactions'){setInboxTab(false);setSlipInboxTab(false);}setView(key);}}><Icon size={21}/><span>{label}</span></button>)}</nav>
    {toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
    {modalOpen&&<EntryModal initial={editing} existing={items} startWithScanner={scanOnOpen} close={()=>setModalOpen(false)} submit={onSave} submitImported={onSaveImported} undoImported={undoImported} queuePending={queuePending} resolvePending={resolvePending} ownerNames={settings.ownerNames||[]} viewSaved={date=>{
      setModalOpen(false);setInboxTab(false);setSlipInboxTab(false);
      setFilter('all');setSearch('');
      if(/^\d{4}-\d{2}-\d{2}$/.test(date))setMonth(date.slice(0,7));
      setView('transactions');
    }} notifyBatch={summary=>{
      if(summary.saved>0)setToast('บันทึกสลิปสำเร็จ '+summary.saved+' รูป'+(summary.incomplete>0?' · รอตรวจ '+summary.incomplete+' รูป':'')+(summary.errors>0?' · อ่านไม่สำเร็จ '+summary.errors+' รูป':''));
      else if(summary.duplicate>0&&summary.incomplete+summary.errors===0)setToast('ตรวจพบสลิปซ้ำ '+summary.duplicate+' รูป ไม่มีรายการใหม่');
      else if(summary.queued>0)setToast('เก็บสลิปรอตรวจในเครื่องแล้ว '+summary.queued+' รูป');
      else if(summary.incomplete+summary.errors>0)setToast((summary.incomplete>0?'รอตรวจข้อมูล '+summary.incomplete+' รูป':'')+(summary.errors>0?(summary.incomplete>0?' · ':'')+'อ่านไม่สำเร็จ '+summary.errors+' รูป กรุณาลองเลือกรูปใหม่':''));
      else if((summary.excluded||0)>0)setToast('ไม่นับการโอนเงินระหว่างบัญชี '+summary.excluded+' รายการ');
    }}/>}
    {pendingRestore&&<RestoreDialog existingCount={items.length} importedCount={pendingRestore.transactions.length} busy={restoreBusy} onBackup={exportJson} onConfirm={()=>{void confirmRestore();}} onClose={()=>setPendingRestore(null)}/>}
    {resetDialogOpen&&<ResetDataDialog transactionCount={items.length} pendingCount={pendingSlips.length}
      busy={resetBusy} error={resetError} onBackup={exportJson} onConfirm={()=>{void eraseDeviceData();}}
      onClose={()=>{if(!resetBusy)setResetDialogOpen(false);}}/>}
  </div>;
}

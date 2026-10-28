import {useEffect,useMemo,useRef,useState,type KeyboardEvent as ReactKeyboardEvent,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, Camera,
  ChevronDown, CircleUserRound,
  UtensilsCrossed, ShoppingBag, TrainFront, HandCoins, Ellipsis, Wallet,
} from 'lucide-react';
import {baht, METHODS, transactionDisplayName, type Transaction} from './lib/finance';
import {emailLedgerEvidence,emailLedgerExplanation,emailLedgerCategory} from './lib/emailLedger';
import sproutBrand from './assets/brand-sprout.svg';
import FinanceCalendar from './FinanceCalendar';
import {summarize,todayLocal} from './lib/finance';
import './finance-calendar.css';

type Props={
  month:string;
  monthLabel:string;
  net:number;
  income:number;
  expense:number;
  recent:Transaction[];
  onMonthChange:(month:string)=>void;
  onUpload:()=>void;
  onTransactions:()=>void;
  reportSlot:ReactNode;
};

export function HomeTopbar({pendingCount,onNotifications,onSettings}:{
  pendingCount:number;onNotifications:()=>void;onSettings:()=>void;
}){
  return <div className="mt-home-topbar">
    <div className="mt-home-brand-row">
      <span className="mt-home-brand-icon" aria-hidden="true"><img className="reference-brand-img" src={sproutBrand} alt=""/></span>
      <strong className="mt-home-brand-name">เงินวันนี้</strong>
      <div className="mt-home-header-actions">
        <button type="button" className="mt-home-header-button" aria-label={pendingCount>0?`การแจ้งเตือน: มีสลิปรอตรวจ ${pendingCount} รายการ`:'การแจ้งเตือน'} onClick={onNotifications}>
          <Bell size={21} strokeWidth={2.1}/>{pendingCount>0&&<span className="mt-home-alert-dot"/>}
        </button>
        <button type="button" className="mt-home-avatar" aria-label="ตั้งค่าของฉัน" onClick={onSettings}><CircleUserRound size={23}/></button>
      </div>
    </div>
  </div>;
}

function RecentIcon({transaction}:{transaction:Transaction}){
  const c=transaction.category;
  const food=/อาหาร|กาแฟ|เครื่องดื่ม|ร้าน/i.test(c);
  const shop=/ซื้อ|ช้อป|สินค้า|shopping/i.test(c);
  const ride=/รถ|เดินทาง|ขนส่ง|bts/i.test(c);
  const Icon=transaction.type==='income'?HandCoins:food?UtensilsCrossed:shop?ShoppingBag:ride?TrainFront:Ellipsis;
  return <span className={`mt-home-transaction-icon ${transaction.type==='income'?'is-income':food?'is-food':shop?'is-shop':ride?'is-ride':'is-other'}`} aria-hidden="true"><Icon size={18} strokeWidth={2.2}/></span>;
}

function shortDate(date:string,time?:string){
  const parts=date.split('-').map(Number);
  if(parts.length!==3||parts.some(x=>!Number.isFinite(x)))return date;
  const d=new Date(parts[0],parts[1]-1,parts[2]);
  const label=new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(d);
  return time?`${label} ${time}`:`${label}`;
}


function chooseMonthKeys(value:string):{key:string;label:string}[]{
  const [year,number]=value.split('-').map(Number);
  if(!Number.isInteger(year)||!Number.isInteger(number)||number<1||number>12)return [];
  // 13 months, centered on currently selected month; works for historic records.
  return Array.from({length:13},(_,index)=>{
    const d=new Date(year,number-1+index-6,1);
    return {key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:new Intl.DateTimeFormat('th-TH',{month:'short',year:'numeric'}).format(d)};
  });
}
function MonthChooser({month,label,onChange}:{
 month:string;label:string;onChange:(value:string)=>void
}){
  const [isOpen,setOpen]=useState(false);
  const triggerRef=useRef<HTMLButtonElement>(null);
  const menuRef=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState({top:0,right:16});
  const options=useMemo(()=>chooseMonthKeys(month),[month]);
  useEffect(()=>{
    if(!isOpen)return;
    const focusSelected=window.requestAnimationFrame(()=>menuRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus());
    const place=()=>{
      const r=triggerRef.current?.getBoundingClientRect();
      if(!r)return;
      const height=Math.min(272,Math.max(120,window.innerHeight-36));
      const top=Math.max(12,Math.min(r.bottom+8,window.innerHeight-height-12));
      setPosition({top,right:Math.max(12,window.innerWidth-r.right)});
    };
    const outside=(event:PointerEvent)=>{
      if(event.target instanceof Node&&!menuRef.current?.contains(event.target)&&!triggerRef.current?.contains(event.target))setOpen(false);
    };
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);triggerRef.current?.focus();}};
    place();
    window.addEventListener('resize',place);
    window.addEventListener('scroll',place,true);
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{
      window.cancelAnimationFrame(focusSelected);
      window.removeEventListener('resize',place);
      window.removeEventListener('scroll',place,true);
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('keydown',escape);
    };
  },[isOpen]);
  const onOptionKeyDown=(event:ReactKeyboardEvent<HTMLDivElement>)=>{
    if(!['ArrowDown','ArrowUp','Home','End','Tab'].includes(event.key))return;
    if(event.key==='Tab'){setOpen(false);return;}
    const options=Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')||[]);
    if(!options.length)return;
    event.preventDefault();
    const current=options.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='Home'?0:event.key==='End'?options.length-1:
      event.key==='ArrowDown'?(current+1)%options.length:(current<=0?options.length-1:current-1);
    options[next]?.focus();
  };
  return <div className="mt-home-month-control">
    <button ref={triggerRef} type="button" className="mt-home-month-picker" aria-haspopup="listbox" aria-expanded={isOpen} aria-controls="mt-home-month-menu" aria-label={'เลือกเดือน '+label} onClick={()=>setOpen(x=>!x)}>
      <span>{label} <ChevronDown size={14}/></span>
    </button>
    {isOpen&&createPortal(<div ref={menuRef} id="mt-home-month-menu" className="mt-home-month-popover" role="listbox" aria-label="เลือกเดือนของภาพรวม" onKeyDown={onOptionKeyDown} style={{top:position.top,right:position.right}}>
      {options.map(item=><button type="button" key={item.key} role="option" aria-selected={item.key===month} className={item.key===month?'selected':''} onClick={()=>{onChange(item.key);setOpen(false);triggerRef.current?.focus();}}>{item.label}</button>)}
    </div>,document.body)}
  </div>;
}
function TransactionDetail({value,onClose}:{
 value:Transaction;onClose:()=>void
}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
   const d=ref.current;
   if(!d)return;
   if(!d.open)d.showModal();
   return()=>{if(d.open)d.close();};
 },[]);
 return <dialog className="mt-home-detail" ref={ref} aria-labelledby="mt-home-detail-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}>
   <div className="mt-home-detail-inner">
     <div className="mt-home-detail-heading"><h2 id="mt-home-detail-title">รายละเอียดรายการ</h2><button type="button" onClick={onClose} aria-label="ปิดรายละเอียด">×</button></div>
     <strong className={value.type==='income'?'is-income':'is-expense'}>{value.type==='income'?'+':'−'} ฿ {baht(value.amountSatang)}</strong>
     <dl>
       <div><dt>คู่รายการ</dt><dd>{transactionDisplayName(value)}</dd></div>
       {value.sender&&<div><dt>ผู้โอนเงิน</dt><dd>{value.sender}</dd></div>}
       {value.recipient&&<div><dt>ผู้รับเงินบนสลิป</dt><dd>{value.recipient}</dd></div>}
       <div><dt>วันที่และเวลา</dt><dd>{shortDate(value.date,value.time)}</dd></div>
       <div><dt>ประเภท</dt><dd>{value.type==='income'?'รายรับ':'รายจ่าย'}</dd></div>
       <div><dt>หมวดหมู่</dt><dd>{emailLedgerCategory(value)}</dd></div>
       {value.note&&<div><dt>{value.id.startsWith('email-')?'คำชี้แจง':'หมายเหตุ'}</dt><dd className="email-ledger-document-note">{emailLedgerExplanation(value)}</dd></div>}
       {emailLedgerEvidence(value.note)&&<div><dt>หลักฐาน</dt><dd><a className="email-ledger-evidence-link" href={emailLedgerEvidence(value.note)} target="_blank" rel="noopener noreferrer">เปิดอีเมลใน Gmail</a></dd></div>}
       <div><dt>ช่องทาง</dt><dd>{METHODS[value.method]}</dd></div>
     </dl>
     <button type="button" className="mt-home-detail-done" onClick={onClose}>ปิดรายละเอียด</button>
   </div>
 </dialog>;
}

export default function HomeScreen({
  month,monthLabel,net,income,expense,recent,
  onMonthChange,onUpload,onTransactions,reportSlot
}:Props){
  const [detail,setDetail]=useState<Transaction|null>(null);
  const detailTriggerRef=useRef<HTMLButtonElement|null>(null);
  const [selectedDate,setSelectedDate]=useState(todayLocal());
  const activeDate=selectedDate.startsWith(month+'-')?selectedDate:month+'-01';
  const daily=useMemo(()=>recent.filter(item=>item.date===activeDate).sort((a,b)=>(b.time||'').localeCompare(a.time||'')||b.createdAt-a.createdAt),[recent,activeDate]);
  const daySums=useMemo(()=>summarize(daily),[daily]);
  const dayLabel=new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric'}).format(new Date(activeDate+'T12:00:00'));

  useEffect(()=>{if(!detail)detailTriggerRef.current?.focus();},[detail]);
  const closeDetail=()=>setDetail(null);
  return <div className="home-dashboard mt-home-screen" aria-label="หน้าแรก เงินวันนี้">
    <section className="summary-grid mt-home-summary" aria-label="ภาพรวมรายเดือน">
      <div className="hero-card mt-home-balance mt-home-calendar-summary">
        <div className="mt-home-balance-decoration" aria-hidden="true">
          <svg viewBox="0 0 98 105" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M43 106C52 68 67 48 89 29" stroke="#477D4B" strokeWidth="2.3" strokeLinecap="round"/>
            <path d="M62 70C34 75 27 55 31 40C52 42 62 51 62 70Z" fill="#92CF77"/>
            <path d="M76 49C56 43 58 24 69 14C84 27 88 38 76 49Z" fill="#78BD60"/>
            <path d="M81 43C89 27 93 21 98 19V46C93 49 87 49 81 43Z" fill="#4DAD5B"/>
            <path d="M48 93C24 102 13 83 17 70C37 71 46 79 48 93Z" fill="#BDE49C"/>
            <path d="M35 88h54l-5 18H42z" fill="#f2fdf1" opacity=".92"/>
            <ellipse cx="62" cy="87" rx="27" ry="5" fill="#fff" opacity=".9"/>
          </svg>
        </div>
        <div className="mt-home-balance-header">
          <span>ภาพรวม</span>
          <MonthChooser month={month} label={monthLabel} onChange={onMonthChange}/>
        </div>
        <div className="mt-home-total-label">สุทธิจากรายรับ − รายจ่าย</div>
        <strong className="mt-home-total">฿ {baht(net)}</strong>
        <div className="mt-home-balance-splits">
          <div className="mt-home-split">
            <div className="mt-home-split-head"><span className="mt-home-split-icon is-income"><ArrowDownLeft size={15}/></span> รายรับ</div>
            <strong>฿ {baht(income)}</strong>
          </div>
          <div className="mt-home-split">
            <div className="mt-home-split-head"><span className="mt-home-split-icon is-expense"><ArrowUpRight size={15}/></span> รายจ่าย</div>
            <strong>฿ {baht(expense)}</strong>
          </div>
        </div>
      </div>
    </section>
    <button className="ref-home-upload mobile-action-scan mt-home-upload" type="button" onClick={onUpload}>
      <span className="mt-home-camera"><Camera size={25} strokeWidth={2.7}/></span>
      <span><strong>อัปโหลดสลิป</strong><small>สลิป K PLUS หรือใบเสร็จ · เลือกได้หลายรูป</small></span>
    </button>
    {reportSlot}
    <section className="surface transactions-surface mt-home-recent" aria-label="รายการล่าสุด">
      <div className="mt-home-section-heading"><h2>หลักฐานธุรกรรมล่าสุด</h2><button type="button" onClick={onTransactions}>ดูทั้งหมด <ArrowRight size={15}/></button></div>
      {recent.length?
        <div className="mt-home-transaction-list">
          {recent.slice(0,4).map(tx=><button type="button" className="mt-home-transaction" key={tx.id} onClick={event=>{detailTriggerRef.current=event.currentTarget;setDetail(tx);}} aria-label={`ดูรายละเอียด ${transactionDisplayName(tx)} ${tx.type==='income'?'รายรับ':'รายจ่าย'} ${baht(tx.amountSatang)} บาท ${shortDate(tx.date,tx.time)}`}>
            <RecentIcon transaction={tx}/>
            <span className="mt-home-transaction-text"><strong>{transactionDisplayName(tx)}</strong><small>{shortDate(tx.date,tx.time)}</small></span>
            <b className={tx.type==='income'?'is-income':'is-expense'}>{tx.type==='income'?'+':'−'} ฿ {baht(tx.amountSatang)}</b>
          </button>)}
        </div>
       :<div className="mt-home-empty"><Wallet size={22}/><p>ยังไม่มีรายการในเดือนนี้</p></div>}
    </section>
    <FinanceCalendar month={month} transactions={recent} selectedDate={activeDate} onSelect={setSelectedDate} onMonthChange={onMonthChange}/>
    <section className="mt-home-day-detail" aria-label="รายการวันที่เลือก">
      <div className="mt-home-day-detail-heading"><h2>{dayLabel}</h2><button type="button" onClick={onTransactions}>ดูรายการทั้งเดือน <ArrowRight size={15}/></button></div>
      <div className="mt-home-day-summary">
        <div><span>รายรับ</span><strong className="is-income">+฿{baht(daySums.income)}</strong></div>
        <div><span>รายจ่าย</span><strong className="is-expense">−฿{baht(daySums.expense)}</strong></div>
      </div>
      {daily.length?<div className="mt-home-transaction-list">
        {daily.slice(0,4).map(tx=><button key={tx.id} type="button" className="mt-home-transaction" onClick={event=>{detailTriggerRef.current=event.currentTarget;setDetail(tx);}}>
          <RecentIcon transaction={tx}/>
          <span className="mt-home-transaction-text"><strong>{transactionDisplayName(tx)}</strong><small>{shortDate(tx.date,tx.time)}</small></span>
          <b className={tx.type==='income'?'is-income':'is-expense'}>{tx.type==='income'?'+':'−'} ฿ {baht(tx.amountSatang)}</b>
        </button>)}
        {daily.length>4&&<p className="mt-home-calendar-more">อีก {daily.length-4} รายการ · ดูทั้งหมดในหน้ารายการ</p>}
      </div>:<div className="mt-home-empty"><p>ยังไม่มีรายการในวันที่เลือก</p></div>}
    </section>
    {detail&&<TransactionDetail value={detail} onClose={closeDetail}/>}
  </div>;
}

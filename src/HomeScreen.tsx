import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, Bell, Camera,
  ChevronDown, CircleUserRound, List, Settings2, Sprout, Target,
  UtensilsCrossed, ShoppingBag, TrainFront, HandCoins, Ellipsis, Wallet,
} from 'lucide-react';
import {baht, type Transaction} from './lib/finance';

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
  onReports:()=>void;
  onBudget:()=>void;
  onSettings:()=>void;
};

export function HomeTopbar({pendingCount,onNotifications,onSettings}:{
  pendingCount:number;onNotifications:()=>void;onSettings:()=>void;
}){
  return <div className="mt-home-topbar">
    <div className="mt-home-brand-row">
      <span className="mt-home-brand-icon" aria-hidden="true"><Sprout size={23} strokeWidth={2.8}/></span>
      <strong className="mt-home-brand-name">เงินวันนี้</strong>
      <div className="mt-home-header-actions">
        <button type="button" className="mt-home-header-button" aria-label={pendingCount>0?`การแจ้งเตือน: มีสลิปรอตรวจ ${pendingCount} รายการ`:'การแจ้งเตือน'} onClick={onNotifications}>
          <Bell size={21} strokeWidth={2.1}/>{pendingCount>0&&<span className="mt-home-alert-dot"/>}
        </button>
        <button type="button" className="mt-home-avatar" aria-label="ตั้งค่าของฉัน" onClick={onSettings}><CircleUserRound size={23}/></button>
      </div>
    </div>
    <p className="mt-home-hello">สวัสดี ☀️</p>
    <p className="mt-home-subtitle">มาดูสุขภาพการเงินของคุณกันเลย</p>
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

export default function HomeScreen({
  month,monthLabel,net,income,expense,recent,
  onMonthChange,onUpload,onTransactions,onReports,onBudget,onSettings
}:Props){
  const shortcuts=[
    {key:'transactions',name:'รายการ',Icon:List,onClick:onTransactions},
    {key:'reports',name:'รายงาน',Icon:BarChart3,onClick:onReports},
    {key:'budget',name:'งบประมาณ',Icon:Target,onClick:onBudget},
    {key:'settings',name:'ตั้งค่า',Icon:Settings2,onClick:onSettings},
  ];
  return <div className="home-dashboard mt-home-screen" aria-label="หน้าแรก เงินวันนี้">
    <section className="summary-grid mt-home-summary" aria-label="ภาพรวมรายเดือน">
      <div className="hero-card mt-home-balance">
        <div className="mt-home-balance-decoration" aria-hidden="true">
          <svg viewBox="0 0 98 105" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M43 106C52 68 67 48 89 29" stroke="#477D4B" strokeWidth="2.3" strokeLinecap="round"/>
            <path d="M62 70C34 75 27 55 31 40C52 42 62 51 62 70Z" fill="#92CF77"/>
            <path d="M76 49C56 43 58 24 69 14C84 27 88 38 76 49Z" fill="#78BD60"/>
            <path d="M81 43C89 27 93 21 98 19V46C93 49 87 49 81 43Z" fill="#4DAD5B"/>
            <path d="M48 93C24 102 13 83 17 70C37 71 46 79 48 93Z" fill="#BDE49C"/>
          </svg>
        </div>
        <div className="mt-home-balance-header">
          <span>ภาพรวมเดือนนี้</span>
          <label className="mt-home-month-picker">
            <span>{monthLabel} <ChevronDown size={14}/></span>
            <input type="month" aria-label="เลือกเดือนของภาพรวม" value={month} onChange={e=>{if(e.target.value)onMonthChange(e.target.value);}}/>
          </label>
        </div>
        <div className="mt-home-total-label">ยอดสุทธิจากรายการ</div>
        <strong className="mt-home-total">฿ {baht(net)}</strong>
        <span className="mt-home-net-note">ไม่ใช่ยอดเงินจริงในบัญชีธนาคาร</span>
        <div className="mt-home-balance-splits">
          <div className="mt-home-split">
            <div className="mt-home-split-head"><span className="mt-home-split-icon is-income"><ArrowDownLeft size={15}/></span> รายรับ</div>
            <strong>฿ {baht(income)}</strong>
            <small>เดือนที่เลือก</small>
          </div>
          <div className="mt-home-split">
            <div className="mt-home-split-head"><span className="mt-home-split-icon is-expense"><ArrowUpRight size={15}/></span> รายจ่าย</div>
            <strong>฿ {baht(expense)}</strong>
            <small>เดือนที่เลือก</small>
          </div>
        </div>
      </div>
    </section>
    <button className="ref-home-upload mobile-action-scan mt-home-upload" type="button" onClick={onUpload}>
      <span className="mt-home-camera"><Camera size={25} strokeWidth={2.7}/></span>
      <span><strong>อัปโหลดสลิป</strong><small>เพิ่มรายการจากสลิปธนาคาร</small></span>
    </button>
    <section className="mobile-quick-actions mt-home-shortcuts" aria-label="เมนูลัด">
      <div className="mt-home-section-heading"><h2>เมนูลัด</h2><span>เลือกเมนูที่ต้องการ</span></div>
      <div className="mt-home-shortcut-grid">
        {shortcuts.map(({key,name,Icon,onClick})=><button type="button" className="mt-home-shortcut" key={key} onClick={onClick}>
          <span><Icon size={22} strokeWidth={2.1}/></span><strong>{name}</strong>
        </button>)}
      </div>
    </section>
    <section className="surface transactions-surface mt-home-recent" aria-label="รายการล่าสุด">
      <div className="mt-home-section-heading"><h2>รายการล่าสุด</h2><button type="button" onClick={onTransactions}>ดูทั้งหมด <ArrowRight size={15}/></button></div>
      {recent.length?
        <div className="mt-home-transaction-list">
          {recent.slice(0,3).map(tx=><button type="button" className="mt-home-transaction" key={tx.id} onClick={onTransactions} aria-label={`ดูรายการ ${tx.recipient||tx.note||tx.category}`}>
            <RecentIcon transaction={tx}/>
            <span className="mt-home-transaction-text"><strong>{tx.recipient||tx.note||tx.category}</strong><small>{shortDate(tx.date,tx.time)}</small></span>
            <b className={tx.type==='income'?'is-income':'is-expense'}>{tx.type==='income'?'+':'−'} ฿ {baht(tx.amountSatang)}</b>
          </button>)}
        </div>
       :<div className="mt-home-empty"><Wallet size={22}/><p>ยังไม่มีรายการในเดือนนี้</p><button type="button" onClick={onUpload}>เริ่มต้นด้วยสลิปใบแรก</button></div>}
    </section>
  </div>;
}

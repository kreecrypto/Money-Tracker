import type {ReactNode} from 'react';
import {ArrowDownLeft,ArrowUpRight,ChevronLeft,ChevronRight,Search,SlidersHorizontal,X} from 'lucide-react';
import {baht} from './lib/finance';

type Filter='all'|'income'|'expense';
type Props={
  monthLabel:string;
  income:number;
  expense:number;
  search:string;
  filter:Filter;
  selectedCount:number;
  visibleCount:number;
  onSearch:(value:string)=>void;
  onFilter:(value:Filter)=>void;
  onMonthChange:(direction:-1|1)=>void;
  children:ReactNode;
};
export default function TransactionsScreen({
  monthLabel,income,expense,search,filter,selectedCount,visibleCount,
  onSearch,onFilter,onMonthChange,children,
}:Props){
  return <div className="mt-transactions-screen" aria-label="รายการธุรกรรม">
    <div className="mt-page-heading">
      <div><span>ประวัติการเงิน</span><h2>รายการธุรกรรม</h2></div>
      <div className="mt-month-controls" role="group" aria-label="เดือนของรายการ">
        <button type="button" aria-label="เดือนก่อนหน้า" onClick={()=>onMonthChange(-1)}><ChevronLeft size={17}/></button>
        <strong>{monthLabel}</strong>
        <button type="button" aria-label="เดือนถัดไป" onClick={()=>onMonthChange(1)}><ChevronRight size={17}/></button>
      </div>
    </div>
    <section className="surface transaction-page mt-transaction-body" aria-label="ค้นหาและกรองธุรกรรม">
      <label className="mt-search-field search-box">
        <Search size={19} strokeWidth={2}/>
        <input type="search" aria-label="ค้นหารายการ" placeholder="ค้นหารายการ เช่น ร้านค้า, จำนวน..." value={search} onChange={e=>onSearch(e.target.value)}/>
        {search&&<button className="search-clear" type="button" aria-label="ล้างคำค้นหา" onClick={()=>onSearch('')}><X size={16}/></button>}
      </label>
      <div className="mt-filter-row">
        <div className="filter-tabs mt-segmented-filters" role="group" aria-label="กรองประเภทรายการ">
          {([['all','ทั้งหมด'],['income','รายรับ'],['expense','รายจ่าย']] as const).map(([key,label])=>
            <button key={key} type="button" className={filter===key?'selected':''} aria-pressed={filter===key} onClick={()=>onFilter(key)}>{label}</button>)}
        </div>
        <span className="mt-filter-count">{visibleCount} รายการ</span>
      </div>
      {(search||filter!=='all')&&<div className="mt-search-feedback"><SlidersHorizontal size={14}/> แสดง {visibleCount} จาก {selectedCount} รายการ <button type="button" onClick={()=>{onSearch('');onFilter('all');}}>ล้างตัวกรอง</button></div>}
      <div className="mt-transaction-results">{children}</div>
    </section>
    <details className="transaction-month-summary mt-transactions-month-summary">
      <summary>สรุปยอดรายรับ–รายจ่ายประจำเดือน</summary>
      <div className="transaction-financial-summary" aria-label="สรุปรายรับรายจ่ายของเดือนที่เลือก">
        <div className="transaction-summary-income"><span>รายรับ <ArrowDownLeft size={18}/></span><strong>฿{baht(income)}</strong></div>
        <div className="transaction-summary-expense"><span>รายจ่าย <ArrowUpRight size={18}/></span><strong>฿{baht(expense)}</strong></div>
      </div>
    </details>
  </div>;
}

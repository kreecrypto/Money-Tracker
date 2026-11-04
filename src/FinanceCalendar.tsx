import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {baht,todayLocal,type Transaction} from './lib/finance';
import {calendarMonthGrid,compactCalendarBaht,keyboardCalendarDate} from './lib/calendar';

type Props={
  month:string;
  transactions:readonly Transaction[];
  selectedDate:string;
  onSelect:(date:string)=>void;
  onToday:()=>void;
  monthControl:ReactNode;
};

const weekdays=['อา','จ','อ','พ','พฤ','ศ','ส'];
const longDate=(date:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric'}).format(new Date(date+'T12:00:00'));
const monthName=(date:string)=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(date+'-01T12:00:00'));

export default function FinanceCalendar({month,transactions,selectedDate,onSelect,onToday,monthControl}:Props){
  const today=todayLocal();
  const grid=useMemo(()=>calendarMonthGrid(month,transactions),[month,transactions]);
  const scrollRef=useRef<HTMLDivElement>(null);
  const [scrollEdge,setScrollEdge]=useState({start:true,end:true,overflow:false});
  const syncScroll=()=>{
    const el=scrollRef.current;
    if(el)setScrollEdge({start:el.scrollLeft<=1,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-1,overflow:el.scrollWidth>el.clientWidth+1});
  };
  useEffect(()=>{
    if(scrollRef.current)scrollRef.current.scrollLeft=0;
    syncScroll();
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(syncScroll):null;
    if(scrollRef.current)observer?.observe(scrollRef.current);
    window.addEventListener('resize',syncScroll);
    return()=>{observer?.disconnect();window.removeEventListener('resize',syncScroll);};
  },[month]);
  const moveCalendar=(direction:number)=>{
    const el=scrollRef.current;
    if(!el)return;
    el.scrollLeft+=direction*el.clientWidth;
    syncScroll();
  };
  return <section className="mt-finance-calendar" aria-label="ปฏิทินรายรับรายจ่าย">
    <div className="mt-calendar-heading">
      <h2>ปฏิทินรายรับรายจ่าย</h2>
      <div className="mt-calendar-month-label">{monthControl}<button type="button" className="mt-calendar-today" onClick={onToday} disabled={selectedDate===today&&month===today.slice(0,7)} aria-label="กลับไปวันนี้">วันนี้</button></div>
    </div>
    <div ref={scrollRef} onScroll={syncScroll} className="mt-calendar-scroll" role="region" aria-label="เลื่อนปฏิทินแนวนอนบนจอเล็ก" tabIndex={scrollEdge.overflow?0:undefined}>
    <div className="mt-calendar-grid" role="group" aria-label={'ปฏิทิน '+monthName(month)}>
      {weekdays.map(day=><span key={day} className="mt-calendar-weekday" aria-hidden="true">{day}</span>)}
      {grid.map(cell=>{
        const isToday=cell.inCurrentMonth&&cell.date===today;
        const hasIncome=cell.incomeSatang>0;
        const hasExpense=cell.expenseSatang>0;
        const description=(isToday?'วันนี้ ':'')+longDate(cell.date)+(cell.count?
          ' รายรับ '+baht(cell.incomeSatang)+' บาท รายจ่าย '+baht(cell.expenseSatang)+' บาท '+cell.count+' รายการ'
          :' ไม่มีรายการ');
        return <button key={cell.date} type="button" data-date={cell.date}
          className={'mt-calendar-day'+(cell.date===selectedDate?' is-selected':'')+(isToday?' is-today':'')+(!cell.inCurrentMonth?' is-outside':'')}
          disabled={!cell.inCurrentMonth} tabIndex={cell.inCurrentMonth?(cell.date===selectedDate?0:-1):undefined}
          aria-pressed={cell.inCurrentMonth?cell.date===selectedDate:undefined} aria-current={isToday?'date':undefined}
          aria-controls="mt-home-selected-day-detail" aria-label={description} title={description}
          onClick={()=>onSelect(cell.date)} onKeyDown={event=>{
            if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
            event.preventDefault();
            const next=keyboardCalendarDate(grid,cell.date,event.key);
            if(!next)return;
            onSelect(next);
            event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus();
          }}>
          <span className="mt-calendar-day-number">{cell.day}</span>
          <span className="mt-calendar-day-amounts" aria-hidden="true">
            {hasIncome&&<span className="is-income">+{compactCalendarBaht(cell.incomeSatang)}</span>}
            {hasExpense&&<span className="is-expense">−{compactCalendarBaht(cell.expenseSatang)}</span>}
          </span>
        </button>;
      })}
    </div></div>
    {scrollEdge.overflow&&<div className="mt-calendar-scroll-actions" aria-label="ตัวช่วยเลื่อนปฏิทิน">
      <span>{scrollEdge.start?'เลื่อนดูวันทางขวา':scrollEdge.end?'เลื่อนกลับเพื่อดูวันต้นสัปดาห์':'เลื่อนดูวันอื่น ๆ'}</span>
      <button type="button" aria-label="เลื่อนปฏิทินไปทางซ้าย" onClick={()=>moveCalendar(-1)} disabled={scrollEdge.start}>←</button>
      <button type="button" aria-label="เลื่อนปฏิทินไปทางขวา" onClick={()=>moveCalendar(1)} disabled={scrollEdge.end}>→</button>
    </div>}
    <p className="mt-calendar-legend"><span><i className="income-dot"/>รายรับ</span><span><i className="expense-dot"/>รายจ่าย</span><small>ยอดย่อ: k = พัน, m = ล้าน · แตะวันที่เพื่อดูยอดเต็ม</small></p>
  </section>;
}

import {useMemo,type ReactNode} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {baht,todayLocal,type Transaction} from './lib/finance';
import {calendarMonthGrid,compactCalendarBaht,keyboardCalendarDate} from './lib/calendar';

type Props={
  month:string;
  transactions:readonly Transaction[];
  selectedDate:string;
  onSelect:(date:string)=>void;
  onToday:()=>void;
  onMonthChange:(month:string)=>void;
  monthControl:ReactNode;
};

const weekdays=['อา','จ','อ','พ','พฤ','ศ','ส'];
const longDate=(date:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric'}).format(new Date(date+'T12:00:00'));
const monthName=(date:string)=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(date+'-01T12:00:00'));

export default function FinanceCalendar({month,transactions,selectedDate,onSelect,onToday,onMonthChange,monthControl}:Props){
  const today=todayLocal();
  const grid=useMemo(()=>calendarMonthGrid(month,transactions),[month,transactions]);
  const changeMonth=(step:number)=>{
    const [year,number]=month.split('-').map(Number);
    const next=new Date(year,number-1+step,1);
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`);
  };
  return <section className="mt-finance-calendar" aria-label="ปฏิทินรายรับรายจ่าย">
    <div className="mt-calendar-heading">
      <h2 className="mt-home-visually-hidden">ปฏิทินรายรับรายจ่าย</h2>
      <button type="button" className="mt-calendar-step" aria-label="เดือนก่อนหน้า" onClick={()=>changeMonth(-1)}><ChevronLeft size={21}/></button>
      <div className="mt-calendar-month-label">{monthControl}<button type="button" className="mt-calendar-today" onClick={onToday} disabled={selectedDate===today&&month===today.slice(0,7)} aria-label="กลับไปวันนี้">วันนี้</button></div>
      <button type="button" className="mt-calendar-step" aria-label="เดือนถัดไป" onClick={()=>changeMonth(1)}><ChevronRight size={21}/></button>
    </div>
    <p className="mt-calendar-legend"><span><i className="income-dot"/>รายรับ</span><span><i className="expense-dot"/>รายจ่าย</span><small>ยอดย่อ: k = พัน, m = ล้าน · แตะวันที่เพื่อดูยอดเต็ม</small></p>
    <div className="mt-calendar-viewport">
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
  </section>;
}

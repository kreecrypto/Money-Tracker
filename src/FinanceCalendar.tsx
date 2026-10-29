import {useMemo} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {baht,todayLocal,type Transaction} from './lib/finance';
import {calendarMonthGrid,compactCalendarBaht} from './lib/calendar';

type Props={
  month:string;
  transactions:readonly Transaction[];
  selectedDate:string;
  onSelect:(date:string)=>void;
  onMonthChange:(month:string)=>void;
};

const weekdays=['อา','จ','อ','พ','พฤ','ศ','ส'];
const longDate=(date:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric'}).format(new Date(date+'T12:00:00'));
const monthName=(date:string)=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(date+'-01T12:00:00'));

export default function FinanceCalendar({month,transactions,selectedDate,onSelect,onMonthChange}:Props){
  const grid=useMemo(()=>calendarMonthGrid(month,transactions),[month,transactions]);
  const today=todayLocal();
  const changeMonth=(delta:number)=>{
    const [year,number]=month.split('-').map(Number);
    const date=new Date(year,number-1+delta,1);
    onMonthChange(String(date.getFullYear())+'-'+String(date.getMonth()+1).padStart(2,'0'));
  };
  return <section className="mt-finance-calendar" aria-label="ปฏิทินรายรับรายจ่าย">
    <div className="mt-calendar-heading">
      <h2>ปฏิทินรายรับ–รายจ่าย</h2>
      <div className="mt-calendar-controls">
        <button type="button" onClick={()=>changeMonth(-1)} aria-label="เดือนก่อนหน้า"><ChevronLeft size={18}/></button>
        <span>{monthName(month)}</span>
        <button type="button" onClick={()=>changeMonth(1)} aria-label="เดือนถัดไป"><ChevronRight size={18}/></button>
      </div>
    </div>
    <div className="mt-calendar-grid" role="group" aria-label={'ปฏิทิน '+monthName(month)}>
      {weekdays.map(day=><span key={day} className="mt-calendar-weekday" aria-hidden="true">{day}</span>)}
      {grid.map(cell=>{
        const hasIncome=cell.incomeSatang>0;
        const hasExpense=cell.expenseSatang>0;
        const description=longDate(cell.date)+(cell.count?
          ' รายรับ '+baht(cell.incomeSatang)+' บาท รายจ่าย '+baht(cell.expenseSatang)+' บาท '+cell.count+' รายการ'
          :' ยังไม่มีรายการที่บันทึก');
        return <button key={cell.date} type="button" data-date={cell.date}
          className={'mt-calendar-day'+(cell.date===selectedDate?' is-selected':'')+(cell.date===today?' is-today':'')+(!cell.inCurrentMonth?' is-outside':'')}
          disabled={!cell.inCurrentMonth} aria-current={cell.date===today?'date':undefined} aria-controls={cell.inCurrentMonth?'mt-home-day-detail':undefined} aria-pressed={cell.inCurrentMonth?cell.date===selectedDate:undefined}
          aria-label={description+(cell.date===today?' วันนี้':'')+(cell.date===selectedDate?' วันที่เลือก':'')} title={description} onClick={()=>onSelect(cell.date)}>
          <span className="mt-calendar-day-number">{cell.day}</span>
          <span className="mt-calendar-day-amounts" aria-hidden="true">
            {hasIncome&&<span className="is-income">+{compactCalendarBaht(cell.incomeSatang)}</span>}
            {hasExpense&&<span className="is-expense">−{compactCalendarBaht(cell.expenseSatang)}</span>}
            {!hasIncome&&!hasExpense&&cell.inCurrentMonth&&<span className="mt-calendar-empty-dot"/>}
          </span>
        </button>;
      })}
    </div>
    <div className="mt-calendar-footer">
      <p className="mt-calendar-legend"><span><i className="income-dot"/>รายรับ</span><span><i className="expense-dot"/>รายจ่าย</span><small>แตะวันที่เพื่อดูยอดเต็มและรายการ · เฉพาะรายการที่บันทึกแล้ว</small></p>
      {selectedDate!==today&&<button type="button" className="mt-calendar-today" onClick={()=>{if(month!==today.slice(0,7))onMonthChange(today.slice(0,7));onSelect(today);}}>กลับไปวันนี้</button>}
    </div>
  </section>;
}

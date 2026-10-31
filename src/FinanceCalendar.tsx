import {useMemo} from 'react';
import {baht,type Transaction} from './lib/finance';
import {calendarMonthGrid,compactCalendarBaht} from './lib/calendar';

type Props={
  month:string;
  transactions:readonly Transaction[];
  selectedDate:string;
  onSelect:(date:string)=>void;
};

const weekdays=['อา','จ','อ','พ','พฤ','ศ','ส'];
const longDate=(date:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric'}).format(new Date(date+'T12:00:00'));
const monthName=(date:string)=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(date+'-01T12:00:00'));

export default function FinanceCalendar({month,transactions,selectedDate,onSelect}:Props){
  const grid=useMemo(()=>calendarMonthGrid(month,transactions),[month,transactions]);
  return <section className="mt-finance-calendar" aria-label="ปฏิทินรายรับรายจ่าย">
    <div className="mt-calendar-heading">
      <h2>ปฏิทินรายรับรายจ่าย</h2>
      <span className="mt-calendar-month-label">{monthName(month)}</span>
    </div>
    <div className="mt-calendar-grid" role="group" aria-label={'ปฏิทิน '+monthName(month)}>
      {weekdays.map(day=><span key={day} className="mt-calendar-weekday" aria-hidden="true">{day}</span>)}
      {grid.map(cell=>{
        const hasIncome=cell.incomeSatang>0;
        const hasExpense=cell.expenseSatang>0;
        const description=longDate(cell.date)+(cell.count?
          ' รายรับ '+baht(cell.incomeSatang)+' บาท รายจ่าย '+baht(cell.expenseSatang)+' บาท '+cell.count+' รายการ'
          :' ไม่มีรายการ');
        return <button key={cell.date} type="button" data-date={cell.date}
          className={'mt-calendar-day'+(cell.date===selectedDate?' is-selected':'')+(!cell.inCurrentMonth?' is-outside':'')}
          disabled={!cell.inCurrentMonth} aria-pressed={cell.inCurrentMonth?cell.date===selectedDate:undefined}
          aria-label={description} title={description} onClick={()=>onSelect(cell.date)}>
          <span className="mt-calendar-day-number">{cell.day}</span>
          <span className="mt-calendar-day-indicators" aria-hidden="true">
            {hasIncome&&<i className="is-income"/>}
            {hasExpense&&<i className="is-expense"/>}
          </span>
          <span className="mt-calendar-day-amounts" aria-hidden="true">
            {hasIncome&&<span className="is-income">+{compactCalendarBaht(cell.incomeSatang)}</span>}
            {hasExpense&&<span className="is-expense">−{compactCalendarBaht(cell.expenseSatang)}</span>}
            {!hasIncome&&!hasExpense&&cell.inCurrentMonth&&<span className="mt-calendar-empty-dot"/>}
          </span>
        </button>;
      })}
    </div>
    <p className="mt-calendar-legend"><span><i className="income-dot"/>รายรับ</span><span><i className="expense-dot"/>รายจ่าย</span><small>แตะวันที่เพื่อดูยอดรายรับ–รายจ่าย · เฉพาะรายการที่บันทึกแล้ว</small></p>
  </section>;
}

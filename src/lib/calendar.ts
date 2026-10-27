import type {Transaction} from './finance';

export type CalendarDay = {
  date: string;
  day: number;
  inCurrentMonth: boolean;
  incomeSatang: number;
  expenseSatang: number;
  count: number;
};

/** Read-only sums from Saved transactions; Pending drafts are never passed here. */
export function calendarMonthGrid(month:string, transactions:readonly Transaction[]):CalendarDay[]{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return [];
  const [year,monthNumber]=month.split('-').map(Number);
  const first=new Date(year,monthNumber-1,1);
  const daysInMonth=new Date(year,monthNumber,0).getDate();
  const offset=first.getDay();
  const totalCells=Math.ceil((offset+daysInMonth)/7)*7;
  const totals=new Map<string,{incomeSatang:number;expenseSatang:number;count:number}>();
  for(const item of transactions){
    if(!item.date.startsWith(month+'-'))continue;
    const sum=totals.get(item.date)||{incomeSatang:0,expenseSatang:0,count:0};
    if(item.type==='income')sum.incomeSatang+=item.amountSatang;
    else sum.expenseSatang+=item.amountSatang;
    sum.count+=1;
    totals.set(item.date,sum);
  }
  return Array.from({length:totalCells},(_,index)=>{
    const dateObj=new Date(year,monthNumber-1,index-offset+1);
    const date=[dateObj.getFullYear(),String(dateObj.getMonth()+1).padStart(2,'0'),String(dateObj.getDate()).padStart(2,'0')].join('-');
    const inCurrentMonth=date.startsWith(month+'-');
    const sum=inCurrentMonth?totals.get(date):undefined;
    return {date,day:dateObj.getDate(),inCurrentMonth,
      incomeSatang:sum?.incomeSatang||0,expenseSatang:sum?.expenseSatang||0,count:sum?.count||0};
  });
}

/** Compact cell labels; accessible names and day details always use full exact amounts. */
export function compactCalendarBaht(satang:number):string{
  const baht=Math.abs(satang)/100;
  if(baht>=1000)return new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(baht).toLowerCase();
  return new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(baht);
}

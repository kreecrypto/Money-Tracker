import type {Transaction} from './finance.js';

/** UI-only aggregation; never changes stored transactions or inferred bank balance. */
export function dailyTotals(items:readonly Transaction[],day:string){
  const rows=items.filter(item=>item.date===day);
  return {
    count:rows.length,
    income:rows.filter(item=>item.type==='income').reduce((sum,item)=>sum+item.amountSatang,0),
    expense:rows.filter(item=>item.type==='expense').reduce((sum,item)=>sum+item.amountSatang,0),
  };
}

/** Group the selected month's transactions into date sections, newest first. */
export function groupTransactionsByDay(items:readonly Transaction[]){
  const chronological=[...items].sort((a,b)=>
    b.date.localeCompare(a.date)||
    (b.time||'').localeCompare(a.time||'')||
    b.createdAt-a.createdAt);
  const groups:{date:string;items:Transaction[]}[]=[];
  for(const entry of chronological){
    const last=groups[groups.length-1];
    if(last?.date===entry.date)last.items.push(entry);
    else groups.push({date:entry.date,items:[entry]});
  }
  return groups;
}

export function dateSectionLabel(day:string,today:string,yesterday:string,format:(date:string)=>string){
  if(day===today)return 'วันนี้';
  if(day===yesterday)return 'เมื่อวาน';
  return format(day);
}

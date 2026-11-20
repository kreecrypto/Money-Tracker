import type {Transaction} from './finance.js';
import {emailLedgerCategory} from './emailLedger.js';

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

/** Display-only grouped preview: original email labels, no reclassification or writes. */
export function groupEmailLedgerByCategory(items:readonly Transaction[]){
  const groups=new Map<string,{name:string;totalSatang:number;items:Transaction[]}>();
  for(const item of items){
    const name=emailLedgerCategory(item);
    const group=groups.get(name)??{name,totalSatang:0,items:[]};
    group.totalSatang+=item.amountSatang;
    group.items.push(item);
    groups.set(name,group);
  }
  return [...groups.values()].sort((a,b)=>b.totalSatang-a.totalSatang||a.name.localeCompare(b.name,'th'));
}

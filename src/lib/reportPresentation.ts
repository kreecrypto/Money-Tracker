import type {Transaction} from './finance';

/** Only an explicit saved subtype label; do not guess intent from merchants or amount. */
export function savedExpenseSubtype(note:string):string{
  return /(?:^|\|)[ \t]*หมวดย่อย:[ \t]*([^\n|]{1,80})/u.exec(note)?.[1]?.trim()||'ยังไม่ระบุประเภทย่อย';
}

export function groupedExpenseSubtypes(items:readonly Transaction[],category:string){
  const groups=new Map<string,{name:string;amountSatang:number;items:Transaction[]}>();
  for(const item of items){
    if(item.type!=='expense'||item.category!==category)continue;
    const name=savedExpenseSubtype(item.note);
    const group=groups.get(name)||{name,amountSatang:0,items:[]};
    group.amountSatang+=item.amountSatang;
    group.items.push(item);
    groups.set(name,group);
  }
  return [...groups.values()].sort((a,b)=>b.amountSatang-a.amountSatang);
}

export function reportDailyCashOut(outflowSatang:number,month:string,today:string){
  const [year,number]=month.split('-').map(Number);
  const current=month===today.slice(0,7);
  const days=current?Number(today.slice(8)):new Date(year,number,0).getDate();
  return {
    amountSatang:days>0?outflowSatang/days:0,
    label:current?'เงินออกเฉลี่ยต่อวัน (ถึงวันนี้)':'เงินออกเฉลี่ยต่อวัน (ทั้งเดือน)',
  };
}

export function reportShortMonthYear(month:string){
  const [year,number]=month.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH',{month:'short',year:'2-digit'}).format(new Date(year,number-1,1));
}

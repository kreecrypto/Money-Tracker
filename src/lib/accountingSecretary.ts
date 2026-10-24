import {baht,expenseByCategory,monthly,summarize,type Transaction} from './finance';
import {dailyTotals} from './spendingInsights';

export type SecretaryQuestion='today'|'month'|'category'|'pending';
export type SecretaryAnswer={title:string;detail:string;source:string};

const money=(satang:number)=>'฿'+baht(satang);
const signedMoney=(satang:number)=>(satang<0?'−':'+')+money(Math.abs(satang));
const dayLabel=(day:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(day+'T12:00:00'));
const monthLabel=(month:string)=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00'));

/** Read-only answers; all figures come from saved transactions in this browser. */
export function secretaryAnswer(
  question:SecretaryQuestion,items:readonly Transaction[],month:string,today:string,
  localPending:number,iphonePending:number|null
):SecretaryAnswer{
  const selected=monthly([...items],month);
  const period=monthLabel(month);
  const source='อ้างอิงเฉพาะรายการที่บันทึกในเครื่องนี้ ไม่ใช่ยอดคงเหลือในธนาคาร';
  switch(question){
    case 'today':{
      const totals=dailyTotals(items,today);
      return {
        title:'สรุปวันนี้ · '+dayLabel(today),
        detail:totals.count===0
          ?'ยังไม่มีรายการที่บันทึกสำหรับวันนี้'
          :totals.count+' รายการ · รับ '+money(totals.income)+' · จ่าย '+money(totals.expense)+' · สุทธิ '+signedMoney(totals.income-totals.expense),
        source,
      };
    }
    case 'month':{
      const totals=summarize(selected);
      return {
        title:'สรุปเดือน'+period,
        detail:selected.length===0
          ?'ยังไม่มีรายการที่บันทึกในเดือนที่เลือก'
          :selected.length+' รายการ · รับ '+money(totals.income)+' · จ่าย '+money(totals.expense)+' · สุทธิ '+signedMoney(totals.net),
        source,
      };
    }
    case 'category':{
      const top=expenseByCategory(selected)[0];
      return {
        title:'หมวดรายจ่ายสูงสุด · '+period,
        detail:top?'หมวด '+top.name+' ใช้ไป '+money(top.total)+' จากรายการที่บันทึกในเดือนนี้':'ยังไม่มีรายจ่ายที่บันทึกในเดือนที่เลือก',
        source,
      };
    }
    case 'pending':
      return {
        title:'รายการที่ต้องตรวจ',
        detail:'สลิปรอตรวจในเครื่อง '+localPending+' รายการ · '+(iphonePending===null
          ?'ยังไม่มีข้อมูลจำนวนรายการรอตรวจจาก iPhone'
          :'รายการรอตรวจจาก iPhone '+iphonePending+' รายการ')+' · ยังไม่รวมรายการรอตรวจในยอดรายรับ–รายจ่าย',
        source:'คิวจากสลิปและ iPhone แสดงแยกกัน และอาจยังไม่ซิงก์',
      };
  }
}

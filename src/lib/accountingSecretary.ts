import {baht,expenseByCategory,monthly,summarize,type Transaction} from './finance';
import {dailyTotals} from './spendingInsights';

export type SecretaryQuestion='today'|'month'|'category'|'pending';
export type SecretaryMetric={label:string;value:string;kind?:'income'|'expense'|'net'};
export type SecretaryAnswer={title:string;detail:string;source:string;metrics:SecretaryMetric[]};
export type SecretaryBriefing={title:string;detail:string;needsReview:boolean};

const money=(satang:number)=>'฿'+baht(satang);
const signedMoney=(satang:number)=>(satang<0?'−':'+')+money(Math.abs(satang));
const dayLabel=(day:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(day+'T12:00:00'));
const monthLabel=(month:string)=>new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric'}).format(new Date(month+'-01T12:00:00'));
const source='นับเฉพาะรายการที่บันทึกในเครื่องนี้ ไม่รวมรายการรอตรวจ และไม่ใช่ยอดเงินคงเหลือในธนาคาร';

const moneyMetrics=(income:number,expense:number):SecretaryMetric[]=>[
  {label:'รายรับ',value:'+'+money(income),kind:'income'},
  {label:'รายจ่าย',value:'−'+money(expense),kind:'expense'},
  {label:'สุทธิจากรายการ',value:signedMoney(income-expense),kind:'net'},
];

/** A truthful proactive note; no scheduled notifications or money edits. */
export function secretaryBriefing(
  items:readonly Transaction[],today:string,localPending:number,iphonePending:number|null
):SecretaryBriefing{
  const needsReview=localPending>0||(iphonePending!==null&&iphonePending>0);
  if(needsReview){
    const known=localPending+(iphonePending||0);
    return {title:'มี '+known+' รายการรอตรวจ',detail:'ตรวจข้อมูลที่ยังไม่ครบก่อนบันทึก รายการเหล่านี้ยังไม่รวมยอดรายรับ–รายจ่าย',needsReview:true};
  }
  const totals=dailyTotals(items,today);
  if(totals.count>0){
    return {title:'วันนี้บันทึกแล้ว '+totals.count+' รายการ',detail:'รายจ่ายที่บันทึกวันนี้ '+money(totals.expense)+' · แตะคำถามด้านล่างเพื่อดูรายละเอียด',needsReview:false};
  }
  return {
    title:items.length===0?'เริ่มจดบัญชีได้เลย':'ยังไม่มีรายการที่บันทึกวันนี้',
    detail:'เมื่อบันทึกสลิปหรือเพิ่มรายการแล้ว เลขาจะสรุปจากข้อมูลจริงในเครื่องนี้',
    needsReview:false,
  };
}

/** Read-only answers using saved local transactions; never infer bank balance. */
export function secretaryAnswer(
  question:SecretaryQuestion,items:readonly Transaction[],month:string,today:string,
  localPending:number,iphonePending:number|null
):SecretaryAnswer{
  const selected=monthly([...items],month);
  const period=monthLabel(month);
  switch(question){
    case 'today':{
      const totals=dailyTotals(items,today);
      return {
        title:'สรุปวันนี้ · '+dayLabel(today),
        detail:totals.count===0?'ยังไม่มีรายการที่บันทึกสำหรับวันนี้':'พบ '+totals.count+' รายการที่บันทึกวันนี้',
        metrics:totals.count>0?moneyMetrics(totals.income,totals.expense):[],
        source,
      };
    }
    case 'month':{
      const totals=summarize(selected);
      return {
        title:'สรุปเดือน'+period,
        detail:selected.length===0?'ยังไม่มีรายการที่บันทึกในเดือนที่เลือก':'พบ '+selected.length+' รายการที่บันทึกในเดือนที่เลือก',
        metrics:selected.length>0?moneyMetrics(totals.income,totals.expense):[],
        source,
      };
    }
    case 'category':{
      const top=expenseByCategory(selected)[0];
      const total=summarize(selected).expense;
      return {
        title:'หมวดรายจ่ายสูงสุด · '+period,
        detail:top?'หมวด '+top.name+' ใช้เงินมากที่สุดจากรายการที่บันทึกในเดือนนี้':'ยังไม่มีรายจ่ายที่บันทึกในเดือนที่เลือก',
        metrics:top?[{label:'รายจ่ายของหมวด',value:money(top.total),kind:'expense'},
          {label:'สัดส่วนของรายจ่าย',value:Math.round(top.total/total*100)+'%'}]:[],
        source,
      };
    }
    case 'pending':
      return {
        title:'รายการที่ต้องตรวจ',
        detail:'รายการที่ยังรอตรวจไม่รวมในยอดรายรับ–รายจ่าย',
        metrics:[
          {label:'สลิปรอตรวจในเครื่อง',value:localPending+' รายการ'},
          {label:'รายการรอตรวจจาก iPhone',value:iphonePending===null?'ยังไม่มีข้อมูล':iphonePending+' รายการ'},
        ],
        source:'แสดงคิวสลิปและคิว iPhone แยกกัน จำนวนจาก iPhone อาจยังไม่อัปเดต',
      };
  }
}

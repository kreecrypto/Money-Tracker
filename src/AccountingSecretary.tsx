import {useState} from 'react';
import {ArrowRight,Bot,ClipboardCheck} from 'lucide-react';
import {todayLocal,type Transaction} from './lib/finance';
import {secretaryAnswer,secretaryBriefing,type SecretaryQuestion} from './lib/accountingSecretary';
import './accounting-secretary.css';

type Props={
  items:readonly Transaction[];
  month:string;
  localPending:number;
  iphonePending:number|null;
  onTransactions:(question:SecretaryQuestion)=>void;
  onReviewLocal:()=>void;
  onReviewIphone:()=>void;
};
const questions:{key:SecretaryQuestion;label:string}[]=[
  {key:'today',label:'วันนี้ใช้เงินเท่าไร'},
  {key:'month',label:'สรุปเดือนที่เลือก'},
  {key:'category',label:'จ่ายหมวดไหนมากสุด'},
  {key:'pending',label:'มีอะไรต้องตรวจบ้าง'},
];

export default function AccountingSecretary({items,month,localPending,iphonePending,onTransactions,onReviewLocal,onReviewIphone}:Props){
  const [question,setQuestion]=useState<SecretaryQuestion>('today');
  const today=todayLocal();
  const answer=secretaryAnswer(question,items,month,today,localPending,iphonePending);
  const briefing=secretaryBriefing(items,today,localPending,iphonePending);
  const transactionAction=question==='today'?'เปิดรายการเดือนปัจจุบัน':question==='category'&&answer.metrics.length?'เปิดรายการหมวดนี้':'ดูรายการในเดือนที่เลือก';
  return <section className="accounting-secretary surface" aria-label="เลขานักบัญชี">
    <div className="accounting-secretary-heading">
      <span className="accounting-secretary-avatar" aria-hidden="true"><Bot size={22}/></span>
      <div><h2>เลขานักบัญชี</h2></div>
    </div>
    <div className="accounting-secretary-briefing">
      <span>เรื่องที่ควรรู้ตอนนี้</span>
      <strong>{briefing.title}</strong>
      <p>{briefing.detail}</p>
    </div>
    <div className="accounting-secretary-questions" role="group" aria-label="คำถามสำเร็จรูป">
      {questions.map(item=><button key={item.key} type="button" className={question===item.key?'is-selected':''} aria-pressed={question===item.key} onClick={()=>setQuestion(item.key)}>{item.label}</button>)}
    </div>
    <div className="accounting-secretary-answer" aria-live="polite" aria-atomic="true">
      <strong>{answer.title}</strong>
      <p>{answer.detail}</p>
      {answer.metrics.length>0&&<dl className="accounting-secretary-metrics">
        {answer.metrics.map(metric=><div key={metric.label} className={'accounting-secretary-metric '+(metric.kind||'')}>
          <dt>{metric.label}</dt><dd>{metric.value}</dd>
        </div>)}
      </dl>}
      <small>{answer.source}</small>
    </div>
    <div className="accounting-secretary-actions">
      {question!=='pending'&&<button type="button" onClick={()=>onTransactions(question)}>{transactionAction} <ArrowRight size={17}/></button>}
      {localPending>0&&<button type="button" onClick={onReviewLocal}><ClipboardCheck size={17}/> ตรวจสลิป ({localPending})</button>}
      {iphonePending!==null&&iphonePending>0&&<button type="button" onClick={onReviewIphone}><ClipboardCheck size={17}/> ตรวจจาก iPhone ({iphonePending})</button>}
    </div>
    <p className="accounting-secretary-disclaimer">คำนวณจากข้อมูลในเครื่อง · ไม่ส่งให้ AI หรือแก้รายการอัตโนมัติ</p>
  </section>;
}

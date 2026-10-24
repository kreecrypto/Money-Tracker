import {useState} from 'react';
import {ArrowRight,Bot,ClipboardCheck} from 'lucide-react';
import type {Transaction} from './lib/finance';
import {secretaryAnswer,type SecretaryQuestion} from './lib/accountingSecretary';
import {todayLocal} from './lib/finance';
import './accounting-secretary.css';

type Props={
  items:readonly Transaction[];
  month:string;
  localPending:number;
  iphonePending:number|null;
  onTransactions:()=>void;
  onReview:()=>void;
};
const questions:{key:SecretaryQuestion;label:string}[]=[
  {key:'today',label:'วันนี้ใช้เงินเท่าไร'},
  {key:'month',label:'สรุปเดือนที่เลือก'},
  {key:'category',label:'จ่ายหมวดไหนมากสุด'},
  {key:'pending',label:'มีอะไรต้องตรวจบ้าง'},
];

export default function AccountingSecretary({items,month,localPending,iphonePending,onTransactions,onReview}:Props){
  const [question,setQuestion]=useState<SecretaryQuestion>('today');
  const answer=secretaryAnswer(question,items,month,todayLocal(),localPending,iphonePending);
  const hasPending=localPending>0||(iphonePending!==null&&iphonePending>0);
  return <section className="accounting-secretary surface" aria-label="เลขานักจดบัญชี">
    <div className="accounting-secretary-heading">
      <span className="accounting-secretary-avatar" aria-hidden="true"><Bot size={22}/></span>
      <div><h2>เลขานักจดบัญชี</h2><p>ถามเรื่องรายรับ–รายจ่ายจากข้อมูลที่บันทึกไว้</p></div>
    </div>
    <div className="accounting-secretary-questions" role="group" aria-label="คำถามสำเร็จรูป">
      {questions.map(item=><button key={item.key} type="button" className={question===item.key?'is-selected':''} aria-pressed={question===item.key} onClick={()=>setQuestion(item.key)}>{item.label}</button>)}
    </div>
    <div className="accounting-secretary-answer" aria-live="polite" aria-atomic="true">
      <strong>{answer.title}</strong>
      <p>{answer.detail}</p>
      <small>{answer.source}</small>
    </div>
    <div className="accounting-secretary-actions">
      <button type="button" onClick={onTransactions}>ดูรายการที่บันทึก <ArrowRight size={17}/></button>
      {hasPending&&<button type="button" onClick={onReview}><ClipboardCheck size={17}/> เปิดรายการรอตรวจ</button>}
    </div>
    <p className="accounting-secretary-disclaimer">รุ่นเริ่มต้น: คำตอบสำเร็จรูป คำนวณในเครื่อง ไม่ส่งข้อมูลให้ AI ภายนอก และไม่แก้ไขรายการโดยอัตโนมัติ</p>
  </section>;
}

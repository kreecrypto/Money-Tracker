import {AlertCircle,CheckCircle2,Info} from 'lucide-react';

export type ToastTone='success'|'error'|'warning'|'info';
export type ToastNotice={message:string;tone:ToastTone};

export default function StatusToast({notice}:{notice:ToastNotice}){
  const isAlert=notice.tone==='error'||notice.tone==='warning';
  const Icon=notice.tone==='success'?CheckCircle2:isAlert?AlertCircle:Info;
  return <div className={'toast toast--'+notice.tone} role={isAlert?'alert':'status'} aria-live={isAlert?'assertive':'polite'}>
    <Icon size={18} aria-hidden="true"/>
    <span>{notice.message}</span>
  </div>;
}

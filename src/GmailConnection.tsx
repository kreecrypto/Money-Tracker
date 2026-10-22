import {useEffect,useState} from 'react';
import {CheckCircle2,Mail,RefreshCw,ShieldCheck,Unlink} from 'lucide-react';
import './gmail-connection.css';

type ConnectionState={available:boolean;connected:boolean;email?:string;linkedAt?:string};
type View={state:'loading'|'ready'|'error';value:ConnectionState;message:string};
const blank:ConnectionState={available:false,connected:false};

export default function GmailConnection(){
  const [view,setView]=useState<View>({state:'loading',value:blank,message:''});
  const [busy,setBusy]=useState(false);
  const refresh=async()=>{
    const response=await fetch('/api/gmail/connection',{cache:'no-store',credentials:'same-origin'});
    if(!response.ok)throw new Error('ไม่สามารถตรวจสถานะการเชื่อมต่อ Gmail ได้');
    const data=await response.json() as ConnectionState;
    if(typeof data.available!=='boolean'||typeof data.connected!=='boolean')
      throw new Error('ข้อมูลสถานะ Gmail ไม่ถูกต้อง');
    setView({state:'ready',value:data,message:''});
  };
  useEffect(()=>{
    const reason=new URLSearchParams(window.location.search).get('gmail');
    const errorText:Record<string,string>={
      state_error:'ลิงก์เชื่อม Gmail หมดเวลา กรุณาลองใหม่',
      authorization_failed:'Google ยังไม่ได้อนุญาตให้เชื่อม Gmail',
      identity_failed:'ยืนยันบัญชี Google ไม่สำเร็จ',
      connection_failed:'เชื่อม Gmail ไม่สำเร็จ กรุณาลองใหม่'
    };
    const message=reason?errorText[reason]||'':'';
    let active=true;
    void fetch('/api/gmail/connection',{cache:'no-store',credentials:'same-origin'})
      .then(async response=>{
        if(!response.ok)throw new Error('ไม่สามารถตรวจสถานะ Gmail ได้');
        return await response.json() as ConnectionState;
      })
      .then(data=>{
        if(active)setView({state:'ready',value:data,message});
      })
      .catch(()=>{
        if(active)setView({state:'error',value:blank,message:'ตรวจสถานะ Gmail ไม่สำเร็จ'});
      });
    return()=>{active=false;};
  },[]);
  const disconnect=async()=>{
    if(busy||!window.confirm('ยกเลิกการเชื่อมต่อ Gmail? รายการที่บันทึกไว้จะยังอยู่'))return;
    setBusy(true);
    try{
      const response=await fetch('/api/gmail/connection',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({action:'disconnect'}),cache:'no-store',credentials:'same-origin'
      });
      if(!response.ok)throw new Error('ยกเลิกการเชื่อมต่อไม่สำเร็จ');
      const result=await response.json() as {googleRevoked:boolean};
      await refresh();
      if(!result.googleRevoked)setView(s=>({...s,message:'ยกเลิกใน Money Tracker แล้ว แต่โปรดตรวจการเพิกถอนสิทธิ์ที่บัญชี Google ด้วย'}));
    }catch(e){setView(s=>({...s,message:e instanceof Error?e.message:'เกิดข้อผิดพลาด'}));}
    finally{setBusy(false);}
  };
  return <section className="mt-gmail-panel" aria-label="การเชื่อมต่อ Gmail">
    <div className="mt-gmail-heading">
      <span className="mt-gmail-icon"><Mail size={21} aria-hidden="true"/></span>
      <div><strong>เชื่อมต่อ Gmail</strong><p>เตรียมบันทึกรายรับ–รายจ่ายจากอีเมล K PLUS</p></div>
    </div>
    {view.state==='loading'?<p className="mt-gmail-status" role="status"><RefreshCw size={15} aria-hidden="true"/> กำลังตรวจสถานะ Gmail</p>:
      view.state==='error'?<p className="mt-gmail-status" role="alert">{view.message}</p>:
      view.value.connected?
      <div className="mt-gmail-content">
        <p className="mt-gmail-status"><CheckCircle2 size={16} aria-hidden="true"/> เชื่อมบัญชีแล้ว · {view.value.email||'Gmail'}</p>
        <p className="mt-gmail-subnote">การนำเข้าธุรกรรมอัตโนมัติยังต้องเปิดใช้หลังผ่านการทดสอบ จึงยังไม่แสดงเวลาซิงก์</p>
        <button className="mt-gmail-secondary" type="button" onClick={()=>void disconnect()} disabled={busy}>
          <Unlink size={16} aria-hidden="true"/> {busy?'กำลังยกเลิก':'ยกเลิกการเชื่อมต่อ'}
        </button>
      </div>:
      <div className="mt-gmail-content">
        <p className="mt-gmail-subnote"><ShieldCheck size={16} aria-hidden="true"/> ขอสิทธิ์อ่าน Gmail เท่านั้น ไม่สามารถส่งหรือลบอีเมล</p>
        {view.value.available?
          <a className="mt-gmail-primary" href="/api/gmail/oauth/start">เชื่อม Gmail ผ่าน Google</a>:
          <p className="mt-gmail-status" role="status">ยังไม่เปิดใช้งานการเชื่อมต่อ Google OAuth โปรดตั้งค่า Backend ก่อน</p>}
      </div>}
    {view.message&&view.state==='ready'&&<p className="mt-gmail-warning" role="status">{view.message}</p>}
  </section>;
}

import {useCallback,useEffect,useRef,useState} from 'react';
import {Image as ImageIcon,ZoomIn,X,RefreshCcw,Clock4} from 'lucide-react';
import {iphoneImage,type IPhoneDraft} from './lib/iphoneSync';
import './iphone-slip-preview.css';

export default function IPhoneSlipPreview({draft}:{draft:IPhoneDraft}){
  const [url,setUrl]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [zoom,setZoom]=useState(false);
  const zoomCloseRef=useRef<HTMLButtonElement>(null);
  const [clock,setClock]=useState(Date.now());
  const meta=draft.image;
  const expiry=meta?.expiresAt?Date.parse(meta.expiresAt):null;
  const accessible=Boolean(meta?.available&&expiry&&expiry>clock);
  const release=useCallback(()=>setUrl(previous=>{if(previous)URL.revokeObjectURL(previous);return null;}),[]);
  useEffect(()=>{
    if(!zoom)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    zoomCloseRef.current?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();setZoom(false);}
      if(event.key==='Tab'){event.preventDefault();zoomCloseRef.current?.focus();}
    };
    document.addEventListener('keydown',key);
    return ()=>{document.removeEventListener('keydown',key);document.body.style.overflow=oldOverflow;previous?.focus();};
  },[zoom]);
  useEffect(()=>()=>{release();},[release]);
  useEffect(()=>{
    if(!expiry)return;
    const delay=Math.max(0,Math.min(expiry-Date.now(),2147483647));
    const id=setTimeout(()=>{setClock(Date.now());release();setZoom(false);},delay+10);
    return ()=>clearTimeout(id);
  },[expiry,release]);
  useEffect(()=>{release();setZoom(false);setError('');},[draft.id,release]);
  const load=async()=>{
    if(!accessible||expiry===null||expiry<=Date.now()||loading)return;
    setLoading(true);setError('');
    try{
      const blob=await iphoneImage(draft.id);
      release();setUrl(URL.createObjectURL(blob));
    }catch(e){setError(e instanceof Error?e.message:'โหลดภาพไม่สำเร็จ');}
    finally{setLoading(false);}
  };
  const ended=Boolean(meta?.expiresAt&&!accessible);
  return <section className="iphone-slip-evidence" aria-label="ภาพหลักฐานการโอนเงิน">
    <div className="iphone-slip-evidence-head"><strong><ImageIcon size={16}/> ภาพต้นฉบับ</strong>
      {meta?.expiresAt&&<small><Clock4 size={13}/> เปิดดูได้ถึง {new Date(meta.expiresAt).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'})}</small>}
    </div>
    {accessible?<>
      {url?<button type="button" className="iphone-slip-image-button" onClick={()=>setZoom(true)} aria-label="ขยายภาพสลิปต้นฉบับ">
        <img src={url} alt="ภาพหลักฐานสลิปธนาคารเพื่อใช้ตรวจยอด วันที่ และผู้รับโอน"/><span><ZoomIn size={16}/> ขยายภาพ</span>
      </button>:<button type="button" className="btn btn-secondary iphone-slip-load" onClick={()=>void load()} disabled={loading}>
        {loading?<RefreshCcw size={16}/>:<ImageIcon size={16}/>} {loading?'กำลังโหลดภาพ...':'แตะเพื่อเปิดภาพสลิป'}
      </button>}
      {error&&<p className="error-message" role="alert">{error} <button type="button" onClick={()=>void load()}>ลองใหม่</button></p>}
    </>:<p className="iphone-slip-placeholder" role="status">{ended?'หมดสิทธิ์เปิดภาพแล้ว ข้อมูลรายการยังคงอยู่':meta?.status==='upload_failed'?'ระบบไม่สามารถจัดเก็บภาพนี้ได้ กรุณาตรวจสอบข้อมูลจากต้นฉบับ':'รายการนี้ไม่มีภาพสลิปแนบมา (ส่งเฉพาะข้อความ)'}</p>}
    {zoom&&url&&<div className="iphone-slip-zoom" role="dialog" aria-modal="true" aria-label="ภาพสลิปขนาดใหญ่">
      <button type="button" ref={zoomCloseRef} className="iphone-slip-close" onClick={()=>setZoom(false)} aria-label="ปิดภาพขยาย"><X size={20}/></button>
      <img src={url} alt="ภาพสลิปขนาดใหญ่สำหรับอ่านรายละเอียดธุรกรรม"/>
    </div>}
  </section>;
}
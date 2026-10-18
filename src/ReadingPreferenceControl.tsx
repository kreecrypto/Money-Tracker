import {useState} from 'react';
import {Type} from 'lucide-react';
import {getReadingSize,setReadingSize,type ReadingSize} from './lib/readingPreference';

/** A discoverable reading preference shared by Home, ledger, charts and scanner. */
export default function ReadingPreferenceControl(){
  const [value,setValue]=useState<ReadingSize>(getReadingSize);
  const choose=(next:ReadingSize)=>{
    setReadingSize(next);
    setValue(next);
  };
  return <section id="settings-reading" className="surface settings-card reading-preference-card" aria-labelledby="reading-preference-heading">
    <div className="settings-icon green" aria-hidden="true"><Type size={23}/></div>
    <h3 id="reading-preference-heading">ขนาดตัวอักษร</h3>
    <p>เลือกขนาดที่อ่านสบายตา ใช้กับหน้าภาพรวม รายการ รายงาน และอัปโหลดสลิป</p>
    <div className="reading-preference-options" role="group" aria-label="ขนาดตัวอักษร">
      <button type="button" className={value==='standard'?'active':''} aria-pressed={value==='standard'} onClick={()=>choose('standard')}>
        <span className="reading-preference-preview" aria-hidden="true">กก</span><span>ขนาดปกติ</span>
      </button>
      <button type="button" className={value==='large'?'active':''} aria-pressed={value==='large'} onClick={()=>choose('large')}>
        <span className="reading-preference-preview is-large" aria-hidden="true">กก</span><span>ตัวอักษรใหญ่</span>
      </button>
    </div>
    <p className="reading-preference-help">บันทึกตัวเลือกไว้เฉพาะอุปกรณ์นี้ และเปลี่ยนกลับได้ทุกเมื่อ</p>
  </section>;
}

import {useMemo,useState} from 'react';
import {CheckCircle2,ClipboardCheck} from 'lucide-react';
import {baht,transactionDisplayName,type Transaction} from './lib/finance';
import {suggestCategory} from './lib/categorySuggestions';
import './category-review.css';

type Props={items:readonly Transaction[]; onApply:(ids:string[])=>Promise<void>};

export default function CategoryReview({items,onApply}:Props){
  const [excluded,setExcluded]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const proposed=useMemo(()=>items.flatMap(item=>{
    const suggestion=suggestCategory(item);
    return suggestion?[{item,...suggestion}]:[];
  }),[items]);
  if(!proposed.length)return null;
  const selected=proposed.filter(row=>!excluded.includes(row.item.id));
  const submit=async()=>{
    if(!selected.length||busy)return;
    if(!window.confirm('ยืนยันเปลี่ยนเฉพาะหมวดหมู่ของ '+selected.length+' รายการหรือไม่?\nแอปจะดาวน์โหลดข้อมูลสำรอง JSON ก่อนแก้ไข และไม่เปลี่ยนจำนวนเงินหรือประเภทรายรับ–รายจ่าย'))return;
    setBusy(true);setError('');
    try{await onApply(selected.map(row=>row.item.id));setExcluded([]);}
    catch(e){setError(e instanceof Error?e.message:'จัดหมวดหมู่ไม่สำเร็จ');}
    finally{setBusy(false);}
  };
  return <section className="surface category-review" aria-labelledby="category-review-title">
    <div className="category-review-heading"><ClipboardCheck size={20} aria-hidden="true"/>
      <div><h3 id="category-review-title">ช่วยจัดหมวดรายการเดิม</h3>
        <p>พบ {proposed.length} รายการในเดือนนี้ที่มีข้อมูลพอจะเสนอหมวดหมู่ได้ ตรวจแต่ละรายการก่อนยืนยัน</p>
      </div>
    </div>
    <p className="category-review-caution">ระบบไม่เดาหมวดจากชื่อบุคคลหรือยอดโอน ไม่เปลี่ยนรายการเติมเงิน Wallet และไม่แก้ข้อมูลเงินเข้า–ออก</p>
    <div className="category-review-tools">
      <span>เลือก {selected.length} จาก {proposed.length} รายการ</span>
      <button type="button" onClick={()=>setExcluded([])} disabled={busy}>เลือกทั้งหมด</button>
      <button type="button" onClick={()=>setExcluded(proposed.map(row=>row.item.id))} disabled={busy}>ไม่เลือก</button>
    </div>
    <div className="category-review-rows">
      {proposed.map(row=><label className="category-review-row" key={row.item.id}>
        <input type="checkbox" checked={!excluded.includes(row.item.id)} disabled={busy}
          onChange={e=>setExcluded(ids=>e.target.checked?ids.filter(id=>id!==row.item.id):[...ids,row.item.id])}/>
        <span className="category-review-detail">
          <strong>{transactionDisplayName(row.item)}</strong>
          <span>เดิม: {row.item.category} · แนะนำ: <b>{row.category}</b></span>
          <small>เหตุผล: {row.reason}</small>
        </span>
        <span className="category-review-amount">฿{baht(row.item.amountSatang)}</span>
      </label>)}
    </div>
    {error&&<p className="category-review-error" role="alert">{error}</p>}
    <button type="button" className="btn btn-primary category-review-submit" disabled={busy||selected.length===0} onClick={submit}>
      <CheckCircle2 size={17} aria-hidden="true"/> {busy?'กำลังบันทึก':'สำรองข้อมูลและยืนยัน '+selected.length+' รายการ'}
    </button>
  </section>;
}

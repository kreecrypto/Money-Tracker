import {ArrowRight,ClipboardCheck,Download,FileCheck2,AlertCircle,CheckCircle2,ChevronRight} from 'lucide-react';
import {baht,type Transaction} from './lib/finance';
import {
  accountantAudit,ACCOUNTANT_BUCKET_LABELS,
  type AccountantBucketKey,type AuditBucket
} from './lib/accountantAudit';
import './accountant-review.css';

type Props={
  items:readonly Transaction[];
  localPending:number;
  iphonePending:number|null;
  onTransactions:()=>void;
  onBucket:(key:AccountantBucketKey)=>void;
  onLocalReview:()=>void;
  onIphoneReview:()=>void;
  onExport:()=>void;
};
const money=(n:number)=>'฿'+baht(n);
const rows=(bucket:AuditBucket)=>bucket.count.toLocaleString('th-TH')+' รายการ';
const bucketDescriptions:Record<AccountantBucketKey,string>={
  debtPayments:'ยอดเงินออก ไม่ใช่รายจ่ายทางบัญชีทั้งหมด',
  walletTopups:'ตรวจการนับซ้ำเมื่อจ่ายผ่าน Wallet',
  needsClassification:'ยังไม่ทราบวัตถุประสงค์ที่แน่ชัด',
  otherCategorized:'จัดหมวดจากข้อมูลที่บันทึกไว้แล้ว'
};
const groups:AccountantBucketKey[]=[
  'debtPayments','walletTopups','needsClassification','otherCategorized'
];

export default function AccountantReview({
  items,localPending,iphonePending,onTransactions,onBucket,onLocalReview,onIphoneReview,onExport
}:Props){
  const data=accountantAudit(items);
  const combined=groups.reduce((sum,key)=>sum+data[key].amountSatang,0);
  const reviewCount=data.needsClassification.count;
  const hasReview=reviewCount>0||localPending>0||(iphonePending!==null&&iphonePending>0);
  return <section id="accountant-review" className="surface accountant-review" aria-labelledby="accountant-review-title">
    <header className="accountant-review-heading">
      <div className="accountant-review-kicker"><FileCheck2 size={16} aria-hidden="true"/> สมุดตรวจบัญชี</div>
      <h3 id="accountant-review-title">เงินของคุณ ไปอยู่ที่ไหนบ้าง?</h3>
      <p>เริ่มจากยอดเงินจริงที่บันทึก แล้วเปิดดูแต่ละประเภทก่อนตัดสินใจจัดหมวด</p>
    </header>
    <div className="accountant-review-totals">
      <div className="accountant-review-cashout">
        <span>เงินออกที่บันทึก · เดือนที่เลือก</span>
        <strong>−{money(data.outflow.amountSatang)}</strong>
        <small>{rows(data.outflow)} · ยังไม่ใช่ค่าใช้จ่ายทางบัญชีที่ตรวจรับรองแล้ว</small>
      </div>
      <div className="accountant-review-incoming">
        <span>เงินเข้าที่บันทึก</span>
        <strong>+{money(data.income.amountSatang)}</strong>
        <small>{rows(data.income)}</small>
      </div>
    </div>
    <div className="accountant-review-focus" aria-live="polite">
      {hasReview?<AlertCircle size={20} aria-hidden="true"/>:<CheckCircle2 size={20} aria-hidden="true"/>}
      <div><strong>{reviewCount>0?`มี ${reviewCount.toLocaleString('th-TH')} รายการที่ยังไม่ทราบประเภท`:
        hasReview?'ยังมีรายการรอตรวจในคิว':'ไม่พบรายการที่ยังไม่จัดหมวดในเดือนที่เลือก'}</strong>
        <span>{reviewCount>0?'แตะกลุ่ม “ยังจำแนกไม่ชัดเจน” เพื่อดูและแก้ไขได้ทันที':
          'รายการ Pending แยกจากยอดเงินที่บันทึกแล้ว และอาจอยู่คนละเดือน'}</span>
      </div>
      {reviewCount>0&&<button type="button" onClick={()=>onBucket('needsClassification')} aria-label="เปิดรายการที่ยังจำแนกไม่ชัดเจน"><ChevronRight size={20}/></button>}
    </div>
    <div className="accountant-review-subheading"><h4>แยกประเภทเงินออก</h4><span>แตะกลุ่มเพื่อดูรายการจริง</span></div>
    {data.outflow.count>0?<div className="accountant-review-ledger" role="group" aria-label="ประเภทของเงินออก">
      {groups.map((key,index)=><div key={key}>
        <button type="button" onClick={()=>onBucket(key)} disabled={!data[key].count}
          aria-label={`${ACCOUNTANT_BUCKET_LABELS[key]} ${money(data[key].amountSatang)} ${rows(data[key])} ดูรายการ`}>
          <span className={`accountant-review-number group-${index+1}`} aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
          <span className="accountant-review-group-label"><b>{ACCOUNTANT_BUCKET_LABELS[key]}</b>
            <small>{bucketDescriptions[key]} · {rows(data[key])}</small></span>
          <strong>{money(data[key].amountSatang)}</strong>
          <ChevronRight size={16} className="accountant-review-row-arrow" aria-hidden="true"/>
        </button>
      </div>)}
      <div className="accountant-review-check"><span>ตรวจยอดรวมทุกประเภท</span><strong>{money(combined)}</strong></div>
    </div>:<p className="accountant-review-empty">เดือนที่เลือกยังไม่มีเงินออกที่บันทึกไว้</p>}
    <div className="accountant-review-flags">
      <h4>สิ่งที่ต้องตรวจต่อ</h4>
      <ul>
        {data.outflow.count>0&&data.income.count===0&&<li>ยังไม่พบเงินเข้าในเดือนที่เลือก จึงยังประเมินเงินคงเหลือจริงไม่ได้</li>}
        {data.debtPayments.count>0&&<li>ชำระหนี้ {rows(data.debtPayments)} · ต้องแยกเงินต้นและดอกเบี้ยก่อนนับเป็นค่าใช้จ่ายจริง</li>}
        {data.walletTopups.count>0&&<li>เติม Wallet {rows(data.walletTopups)} · ระวังนับซ้ำเมื่อบันทึกยอดจ่ายผ่าน Wallet</li>}
        {data.needsClassification.count>0&&<li>มี {rows(data.needsClassification)} ที่ยังระบุวัตถุประสงค์ไม่ชัดเจน กดเข้าไปตรวจและแก้ไขได้</li>}
        {data.possibleDuplicatePairs>0&&<li>มีคู่รายการคล้ายกัน {data.possibleDuplicatePairs} คู่ · ต้องเทียบเลขอ้างอิงธนาคารก่อนจัดการ ไม่ลบเอง</li>}
        {localPending>0&&<li>สลิปรอตรวจในเครื่อง {localPending} รายการ (ทุกเดือน) ยังไม่รวมในยอดข้างต้น</li>}
        {iphonePending===null?<li>ยังไม่ได้ข้อมูลจำนวนรายการรอตรวจจาก iPhone Cloud</li>:
          iphonePending>0&&<li>iPhone Cloud รอตรวจ {iphonePending} รายการ (ทุกเดือน) ยังไม่รวมในยอด</li>}
        {data.outflow.count===0&&data.income.count===0&&localPending===0&&iphonePending===0&&<li>ยังไม่มีรายการในเดือนที่เลือก</li>}
      </ul>
      <p>ข้อมูลนี้ยังไม่ได้กระทบยอดกับ Bank Statement · ไม่ใช่ยอดคงเหลือ กำไร หรือค่าใช้จ่ายที่ตรวจรับรองแล้ว</p>
    </div>
    <div className="accountant-review-actions">
      <button type="button" className="btn btn-secondary" onClick={onTransactions}>รายการเดือนที่เลือก <ArrowRight size={16}/></button>
      {localPending>0&&<button type="button" className="btn btn-ghost bordered" onClick={onLocalReview}><ClipboardCheck size={16}/> ตรวจสลิป ({localPending})</button>}
      {iphonePending!==null&&iphonePending>0&&<button type="button" className="btn btn-ghost bordered" onClick={onIphoneReview}><ClipboardCheck size={16}/> ตรวจ iPhone ({iphonePending})</button>}
      <button type="button" className="btn btn-ghost bordered" onClick={onExport}><Download size={16}/> ส่งออก CSV (ทุกเดือน)</button>
    </div>
  </section>;
}

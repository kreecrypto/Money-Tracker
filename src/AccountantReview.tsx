import {ArrowRight,ClipboardCheck,Download,FileCheck2} from 'lucide-react';
import {baht,type Transaction} from './lib/finance';
import {accountantAudit,type AuditBucket} from './lib/accountantAudit';
import './accountant-review.css';

type Props={
  items:readonly Transaction[];
  localPending:number;
  iphonePending:number|null;
  onTransactions:()=>void;
  onLocalReview:()=>void;
  onIphoneReview:()=>void;
  onExport:()=>void;
};
const money=(n:number)=>'฿'+baht(n);
const rows=(bucket:AuditBucket)=>bucket.count.toLocaleString('th-TH')+' รายการ';

export default function AccountantReview({
  items,localPending,iphonePending,onTransactions,onLocalReview,onIphoneReview,onExport
}:Props){
  const data=accountantAudit(items);
  const combined=[data.debtPayments,data.walletTopups,data.needsClassification,data.otherCategorized]
    .reduce((sum,b)=>sum+b.amountSatang,0);
  return <section className="surface accountant-review" aria-label="ตรวจบัญชีเบื้องต้น">
    <div className="section-header">
      <div><h3><FileCheck2 size={19} aria-hidden="true"/> ตรวจบัญชีเบื้องต้น</h3>
        <p>แยกเงินออกตามลักษณะรายการ เพื่อไม่สับสนกับค่าใช้จ่ายจริง</p></div>
    </div>
    <div className="accountant-review-totals">
      <div><span>เงินออกที่บันทึก</span><strong>−{money(data.outflow.amountSatang)}</strong><small>{rows(data.outflow)}</small></div>
      <div><span>เงินเข้าที่บันทึก</span><strong>+{money(data.income.amountSatang)}</strong><small>{rows(data.income)}</small></div>
    </div>
    {data.outflow.count>0?<div className="accountant-review-ledger" role="group" aria-label="ประเภทของเงินออก">
      <div><span>ชำระหนี้ / บัตรเครดิต <small>{rows(data.debtPayments)}</small></span><strong>{money(data.debtPayments.amountSatang)}</strong></div>
      <div><span>เติมเงิน Wallet <small>{rows(data.walletTopups)}</small></span><strong>{money(data.walletTopups.amountSatang)}</strong></div>
      <div><span>ยังจำแนกไม่ชัดเจน <small>{rows(data.needsClassification)}</small></span><strong>{money(data.needsClassification.amountSatang)}</strong></div>
      <div><span>รายการอื่นที่จัดหมวดแล้ว <small>{rows(data.otherCategorized)}</small></span><strong>{money(data.otherCategorized.amountSatang)}</strong></div>
      <div className="accountant-review-check"><span>รวมยอดเงินออก</span><strong>{money(combined)}</strong></div>
    </div>:<p className="accountant-review-empty">เดือนนี้ยังไม่มีเงินออกที่บันทึกไว้</p>}
    <div className="accountant-review-flags">
      <h4>สิ่งที่นักบัญชีต้องตรวจต่อ</h4>
      <ul>
        {data.outflow.count>0&&data.income.count===0&&<li>ยังไม่พบเงินเข้าในเดือนที่เลือก จึงคำนวณฐานะการเงินสุทธิจริงไม่ได้</li>}
        {data.debtPayments.count>0&&<li>ชำระหนี้ {rows(data.debtPayments)} · ยอดชำระไม่ใช่ค่าใช้จ่ายทางบัญชีทั้งหมด ต้องแยกเงินต้นและดอกเบี้ยจากหลักฐาน</li>}
        {data.walletTopups.count>0&&<li>เติม Wallet {rows(data.walletTopups)} · ยังนับเป็นรายจ่ายตามกติกาแอป ระวังนับซ้ำเมื่อบันทึกยอดซื้อผ่าน Wallet</li>}
        {data.needsClassification.count>0&&<li>มี {rows(data.needsClassification)} ที่ยังระบุวัตถุประสงค์ไม่ชัดเจน ไม่ควรเดาเป็นค่าอาหารหรือรายจ่ายส่วนตัว</li>}
        {data.possibleDuplicatePairs>0&&<li>มีคู่รายการคล้ายกัน {data.possibleDuplicatePairs} คู่ (วัน ยอด ผู้รับ และเวลาใกล้กัน) · ต้องเทียบเลขอ้างอิงก่อนลบ</li>}
        {localPending>0&&<li>สลิปรอตรวจในเครื่อง {localPending} รายการ ยังไม่รวมในยอดข้างต้น</li>}
        {iphonePending===null
          ?<li>ยังไม่ได้ข้อมูลจำนวนรายการรอตรวจจาก iPhone Cloud</li>
          :iphonePending>0&&<li>iPhone Cloud รอตรวจ {iphonePending} รายการ (ทุกเดือน) ยังไม่รวมในยอด</li>}
        {data.outflow.count===0&&data.income.count===0&&localPending===0&&iphonePending===0&&<li>ยังไม่มีรายการในเดือนที่เลือก</li>}
      </ul>
      <p>ยังไม่ได้เทียบกับ Bank Statement · แสดงเฉพาะรายการที่บันทึกแล้วในเบราว์เซอร์นี้ ไม่ใช่ยอดเงินคงเหลือ กำไร หรือค่าใช้จ่ายที่ตรวจรับรองแล้ว</p>
    </div>
    <div className="accountant-review-actions">
      <button type="button" className="btn btn-secondary" onClick={onTransactions}>ตรวจรายการเดือนนี้ <ArrowRight size={16}/></button>
      {localPending>0&&<button type="button" className="btn btn-ghost bordered" onClick={onLocalReview}><ClipboardCheck size={16}/> ตรวจสลิป ({localPending})</button>}
      {iphonePending!==null&&iphonePending>0&&<button type="button" className="btn btn-ghost bordered" onClick={onIphoneReview}><ClipboardCheck size={16}/> ตรวจ iPhone ({iphonePending})</button>}
      <button type="button" className="btn btn-ghost bordered" onClick={onExport}><Download size={16}/> ส่งออก CSV (ทุกเดือน)</button>
    </div>
  </section>;
}

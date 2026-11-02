import {ChevronRight} from 'lucide-react';
import {baht,CATEGORY_ICONS,transactionDisplayName,type Transaction} from './lib/finance';
import {accountantBucketFor} from './lib/accountantAudit';

type Category={name:string;total:number};
const dateLabel=(date:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(date+'T12:00:00'));

/** Itemize saved cash outflows only; receipt products never become extra transactions. */
export default function ReportExpenseDetails({items,categories}:{items:readonly Transaction[];categories:readonly Category[]}){
  return <div className="report-category-list">
    {categories.map((category,index)=>{
      const entries=items.filter(item=>item.type==='expense'&&item.category===category.name)
        .sort((a,b)=>b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||'')||b.createdAt-a.createdAt);
      return <details className="report-category-breakdown" key={category.name}>
        <summary className="report-category" aria-label={category.name+' '+entries.length+' รายการ ยอดเงินออก ฿'+baht(category.total)+' แตะเพื่อดูรายละเอียด'}>
          <span className="category-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
          <span className="report-cat-emoji" aria-hidden="true">{CATEGORY_ICONS[category.name]||'🧾'}</span>
          <div className="report-category-name"><strong>{category.name}</strong>
            <span>{entries.length.toLocaleString('th-TH')} รายการ · แตะดูรายละเอียด</span></div>
          <b>฿{baht(category.total)}</b>
          <ChevronRight className="report-category-disclosure" size={17} aria-hidden="true"/>
        </summary>
        <div className="report-category-entries" role="group" aria-label={'รายละเอียดหมวด '+category.name}>
          {entries.map(item=>{
            const title=transactionDisplayName(item);
            const kind=accountantBucketFor(item);
            return <div className="report-category-expense-row" key={item.id}>
              <div className="report-category-expense-copy">
                <strong>{title}</strong>
                {item.note?.trim()&&item.note.trim()!==title&&<span>{item.note.trim()}</span>}
                <small>{dateLabel(item.date)}{item.time?' · '+item.time+' น.':''}</small>
                {kind==='walletTopups'&&<small className="report-category-clarification">เติม Wallet: เป็นเงินออก อาจนับซ้ำเมื่อบันทึกรายจ่ายจาก Wallet</small>}
                {kind==='debtPayments'&&<small className="report-category-clarification">ชำระหนี้: ยังไม่ได้แยกเงินต้นและดอกเบี้ย</small>}
                {kind==='needsClassification'&&<small className="report-category-clarification">ยังไม่ทราบประเภทที่แน่ชัด ควรตรวจรายการนี้</small>}
                {!!item.receipt?.items.length&&<div className="report-category-receipt">
                  <span>สิ่งที่ระบุในใบเสร็จ{item.receipt.itemsComplete?'':' (รายการอาจไม่ครบ)'}</span>
                  <ul>{item.receipt.items.map((line,i)=><li key={i}>{line.name}{line.quantity>1?' × '+line.quantity:''}</li>)}</ul>
                </div>}
              </div>
              <b className="report-category-expense-amount">−฿{baht(item.amountSatang)}</b>
            </div>;
          })}
          <div className="report-category-expense-total"><span>รวม {entries.length.toLocaleString('th-TH')} รายการ</span><strong>฿{baht(category.total)}</strong></div>
        </div>
      </details>;
    })}
    <p className="report-category-footnote">ยอดนี้คือเงินออกที่บันทึกในเดือนที่เลือก ไม่ใช่ยอดคงเหลือหรือค่าใช้จ่ายที่ตรวจรับรองแล้ว · รายการในใบเสร็จไม่ถูกบวกซ้ำ</p>
  </div>;
}

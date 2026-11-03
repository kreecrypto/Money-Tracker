import {useRef,useState} from 'react';
import {ChevronRight,Search,X} from 'lucide-react';
import {baht,CATEGORY_ICONS,transactionDisplayName,type Transaction} from './lib/finance';
import {accountantBucketFor} from './lib/accountantAudit';
import {groupedExpenseSubtypes,savedExpenseSubtype} from './lib/reportPresentation';

type Category={name:string;total:number};
type Match={category:Category;entries:Transaction[];total:number;partial:boolean};
const dateLabel=(date:string)=>new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'short',year:'numeric'}).format(new Date(date+'T12:00:00'));

/** Search saved expenses in the selected month; category matches show the whole category. */
export function matchingExpenseCategories(items:readonly Transaction[],categories:readonly Category[],query:string):Match[]{
  const search=query.trim().toLocaleLowerCase('th-TH');
  return categories.flatMap(category=>{
    const entries=items.filter(item=>item.type==='expense'&&item.category===category.name)
      .sort((a,b)=>b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||'')||b.createdAt-a.createdAt);
    const matchCategory=Boolean(search&&category.name.toLocaleLowerCase('th-TH').includes(search));
    const matching=search&&!matchCategory?entries.filter(item=>
      [transactionDisplayName(item),item.note,savedExpenseSubtype(item.note),item.date]
        .join(' ').toLocaleLowerCase('th-TH').includes(search)
    ):entries;
    if(!matching.length)return [];
    return [{category,entries:matching,total:matching.reduce((sum,item)=>sum+item.amountSatang,0),partial:Boolean(search&&!matchCategory)}];
  });
}

/** Itemize saved cash outflows only; receipt products never become extra transactions. */
export default function ReportExpenseDetails({items,categories}:{items:readonly Transaction[];categories:readonly Category[]}){
  const [query,setQuery]=useState('');
  const searchRef=useRef<HTMLInputElement>(null);
  const searching=Boolean(query.trim());
  const matches=matchingExpenseCategories(items,categories,query);
  const monthTotal=categories.reduce((sum,category)=>sum+category.total,0);
  const matchedTotal=matches.reduce((sum,group)=>sum+group.total,0);
  const matchedCount=matches.reduce((sum,group)=>sum+group.entries.length,0);
  const expenseCount=items.filter(item=>item.type==='expense').length;
  return <div className="report-category-list">
    {categories.length>0&&<div className="report-expense-tools">
      <label className="report-expense-search"><Search size={19} aria-hidden="true"/>
        <input ref={searchRef} type="search" aria-label="ค้นหาหมวดหรือรายการเงินออก" placeholder="ค้นหาหมวด ร้านค้า หรือรายการ" autoComplete="off"
          value={query} onChange={event=>setQuery(event.target.value)}/>
        {query&&<button type="button" aria-label="ล้างคำค้นหา" onClick={()=>{setQuery('');searchRef.current?.focus();}}><X size={18}/></button>}
      </label>
      <p className="report-expense-results" role="status">{searching
        ?'พบ '+matchedCount.toLocaleString('th-TH')+' รายการ ใน '+matches.length.toLocaleString('th-TH')+' หมวด · ยอดที่พบ ฿'+baht(matchedTotal)
        :categories.length.toLocaleString('th-TH')+' หมวด · '+expenseCount.toLocaleString('th-TH')+' รายการเงินออก'}</p>
    </div>}
    {matches.map(({category,entries,total,partial},index)=>{
      const groups=groupedExpenseSubtypes(entries,category.name);
      const share=monthTotal>0?Math.min(100,category.total/monthTotal*100):0;
      return <details className="report-category-breakdown" key={category.name} open={searching||undefined}>
        <summary className="report-category" aria-label={category.name+' '+entries.length+' รายการ ยอด'+(partial?'ที่ตรงคำค้นหา':'เงินออก')+' ฿'+baht(total)+' แตะเพื่อดูรายละเอียด'}>
          <span className="category-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>
          <span className="report-cat-emoji" aria-hidden="true">{CATEGORY_ICONS[category.name]||'🧾'}</span>
          <div className="report-category-name"><strong>{category.name}</strong>
            <span>{partial?'ผลค้นหา '+entries.length.toLocaleString('th-TH')+' รายการ · ทั้งหมวด ฿'+baht(category.total):entries.length.toLocaleString('th-TH')+' รายการ · '+share.toFixed(1)+'% ของเงินออกเดือนนี้'}</span>
            <span className="report-category-progress" aria-hidden="true"><span style={{width:share+'%'}}/></span></div>
          <b>฿{baht(total)}</b>
          <ChevronRight className="report-category-disclosure" size={17} aria-hidden="true"/>
        </summary>
        <div className="report-category-entries" role="group" aria-label={'รายละเอียดหมวด '+category.name}>
          {groups.map(group=><section className="report-category-subgroup" key={group.name}>
            <div className="report-subcategory-heading"><strong>{group.name}</strong><span>{group.items.length.toLocaleString('th-TH')} รายการ · ฿{baht(group.amountSatang)}</span></div>
            {group.items.map(item=>{
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
          </section>)}
          <div className="report-category-expense-total"><span>รวม {entries.length.toLocaleString('th-TH')} รายการ</span><strong>฿{baht(total)}</strong></div>
        </div>
      </details>;
    })}
    {searching&&matches.length===0&&<div className="report-expense-empty" role="status"><strong>ไม่พบรายการที่ค้นหา</strong><p>ลองค้นหาชื่อหมวด ร้านค้า หรือข้อความในรายการ</p><button type="button" onClick={()=>{setQuery('');searchRef.current?.focus();}}>ล้างคำค้นหา</button></div>}
    <p className="report-category-footnote">{searching?'ยอดผลค้นหาคิดจากรายการที่ตรงคำค้นหา ไม่ใช่ยอดเงินออกทั้งเดือน · ':''}ยอดนี้คือเงินออกที่บันทึกในเดือนที่เลือก ไม่ใช่ยอดคงเหลือหรือค่าใช้จ่ายที่ตรวจรับรองแล้ว · รายการในใบเสร็จไม่ถูกบวกซ้ำ</p>
  </div>;
}

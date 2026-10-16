import {ArrowRight,ChevronLeft,ChevronRight,UtensilsCrossed,ShoppingBag,TrainFront,House,HeartPulse,Clapperboard,Ellipsis,ChartNoAxesColumn} from 'lucide-react';
import {baht,expenseByCategory,monthly,lastMonths,summarize,type Transaction} from './lib/finance';

export type ReportTab='overview'|'categories'|'trends'|'budget';
type Props={
  items:Transaction[];
  month:string;
  monthLabel:string;
  budget:number;
  tab:ReportTab;
  onTab:(tab:ReportTab)=>void;
  onMonthChange:(direction:-1|1)=>void;
  onSettings:()=>void;
};
const COLORS=['#149358','#fb5b70','#3b86ef','#ffb02f','#9a69cf','#91a39b'];
const pct=(a:number,b:number)=>b>0?Math.round(100*a/b):0;
function iconFor(name:string){
  if(/อาหาร|กาแฟ|เครื่องดื่ม/.test(name))return UtensilsCrossed;
  if(/ซื้อ|ช้อป/.test(name))return ShoppingBag;
  if(/เดินทาง|รถ/.test(name))return TrainFront;
  if(/บ้าน|ไฟ|น้ำ/.test(name))return House;
  if(/สุขภาพ/.test(name))return HeartPulse;
  if(/บันเทิง/.test(name))return Clapperboard;
  return Ellipsis;
}
function donutGradient(totals:number[],sum:number){
  if(sum<=0)return 'conic-gradient(#ebf2ed 0 100%)';
  let start=0;
  const stops=totals.slice(0,5).map((n,i)=>{
    const end=Math.min(100,start+100*n/sum),s=`${COLORS[i]} ${start.toFixed(3)}% ${end.toFixed(3)}%`;
    start=end;return s;
  });
  if(start<100)stops.push(`${COLORS[5]} ${start.toFixed(3)}% 100%`);
  return 'conic-gradient('+stops.join(',')+')';
}
export default function ReportsScreen({items,month,monthLabel,budget,tab,onTab,onMonthChange,onSettings}:Props){
  const current=monthly(items,month);
  const {income,expense,net}=summarize(current);
  const categories=expenseByCategory(current);
  const [y,m]=month.split('-').map(Number);
  const history=lastMonths(6,new Date(y,m-1,1)).map(period=>({...period,...summarize(monthly(items,period.key))}));
  const max=Math.max(1,...history.map(x=>x.expense));
  const totalLimit=budget>0?pct(expense,budget):0;
  const major=categories.slice(0,5);
  const remainder=categories.slice(5).reduce((n,c)=>n+c.total,0);
  const donut=donutGradient([...major.map(x=>x.total),remainder],expense);
  return <div className="mt-reports-screen" aria-label="รายงานการเงิน">
    <div className="mt-page-heading">
      <div><span>วิเคราะห์การเงิน</span><h2>รายงาน</h2></div>
      <div className="mt-month-controls" role="group" aria-label="เดือนของรายงาน">
        <button aria-label="เดือนก่อนหน้า" type="button" onClick={()=>onMonthChange(-1)}><ChevronLeft size={17}/></button>
        <strong>{monthLabel}</strong>
        <button aria-label="เดือนถัดไป" type="button" onClick={()=>onMonthChange(1)}><ChevronRight size={17}/></button>
      </div>
    </div>
    <div className="ref-report-tabs mt-report-tabs" role="group" aria-label="เลือกมุมมองรายงาน">
      {([['overview','ภาพรวม'],['categories','หมวดหมู่'],['trends','แนวโน้ม'],['budget','งบประมาณ']] as const).map(([key,label])=>
        <button key={key} type="button" aria-pressed={tab===key} className={tab===key?'active':''} onClick={()=>onTab(key)}>{label}</button>)}
    </div>
    {(tab==='overview'||tab==='categories')&&<section id="report-spending" className="surface mt-report-card mt-spending-card ref-report-spending" aria-label="สัดส่วนรายจ่าย">
      <div className="mt-report-section-head"><h3>สัดส่วนรายจ่าย</h3><span>ดูทั้งหมด <ArrowRight size={14}/></span></div>
      {expense>0?<div className="mt-report-donut-layout">
        <div className="spending-donut mt-report-donut" role="img" aria-label={'รายจ่ายรวม ฿'+baht(expense)} style={{background:donut}}>
          <div className="spending-donut-hole mt-report-donut-hole"><span>รายจ่ายรวม</span><strong>฿ {baht(expense)}</strong><small>100%</small></div>
        </div>
        <div className="spending-legend mt-report-legend" id="report-categories">
          {major.map((x,i)=><div key={x.name} className="mt-report-legend-row"><i style={{background:COLORS[i]}}/><span>{x.name}</span><strong>{pct(x.total,expense)}%</strong></div>)}
          {remainder>0&&<div className="mt-report-legend-row"><i style={{background:COLORS[5]}}/><span>อื่น ๆ</span><strong>{pct(remainder,expense)}%</strong></div>}
        </div>
      </div>:<div id="report-categories" className="mt-report-empty"><ChartNoAxesColumn size={27}/><p>ยังไม่มีข้อมูลรายจ่ายเดือนนี้</p></div>}
      <p className="mt-report-data-note">สัดส่วนจากรายการที่บันทึกจริงในเดือนที่เลือก</p>
    </section>}
    {(tab==='overview'||tab==='budget')&&<section id="report-budget" className="surface mt-report-card mt-budget-card ref-report-budget">
      <div className="mt-report-section-head"><h3>งบประมาณรายเดือน</h3><button type="button" onClick={onSettings}>จัดการงบ <ArrowRight size={15}/></button></div>
      {budget>0?<div className="mt-budget-total">
        <div className="mt-budget-row"><span>ใช้งบประมาณรวม</span><strong>฿ {baht(expense)} / {baht(budget)}</strong></div>
        <div className="mt-budget-track" role="progressbar" aria-label="ความคืบหน้างบประมาณ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(totalLimit,100)}><span className={totalLimit>100?'is-over':''} style={{width:Math.min(totalLimit,100)+'%'}}/></div>
        <small>{totalLimit>100?'เกินงบแล้ว':'ใช้ไป'} {totalLimit}% ของงบประมาณรวม</small>
      </div>:<div className="mt-report-budget-empty"><p>ยังไม่ได้ตั้งงบประมาณรายเดือน</p><button type="button" onClick={onSettings}>ตั้งงบประมาณ</button></div>}
      {categories.length>0&&<>
        <div className="mt-report-mini-head">ค่าใช้จ่ายตามหมวดหมู่ <small>เทียบสัดส่วนรายจ่าย ไม่ใช่งบรายหมวด</small></div>
        {categories.slice(0,4).map((c,i)=>{
          const Icon=iconFor(c.name);
          return <div className="mt-report-category-row" key={c.name}>
            <span className="mt-report-category-icon" style={{color:COLORS[i%COLORS.length]}}><Icon size={16}/></span>
            <div className="mt-report-category-detail"><div><span>{c.name}</span><strong>฿ {baht(c.total)} <small>{pct(c.total,expense)}%</small></strong></div>
            <div className="mt-budget-track"><span style={{width:pct(c.total,expense)+'%',background:COLORS[i%COLORS.length]}}/></div></div>
          </div>;
        })}
      </>}
    </section>}
    {(tab==='overview'||tab==='trends')&&<section id="report-trends" className="surface mt-report-card mt-trend-card">
      <div className="mt-report-section-head"><h3>แนวโน้มรายจ่าย</h3><span>6 เดือนล่าสุดถึงเดือนที่เลือก</span></div>
      <div className="mt-trend-chart" role="img" aria-label={'กราฟแท่งรายจ่ายรายเดือน: '+history.map(h=>h.label+' ฿'+baht(h.expense)).join(', ')}>
        <div className="mt-trend-grid" aria-hidden="true"><span/><span/><span/><span/></div>
        {history.map(h=><div className="mt-trend-column" key={h.key}><div className="mt-trend-bar" style={{height:(h.expense?Math.max(5,h.expense/max*100):0)+'%'}} title={h.label+' ฿'+baht(h.expense)}>{h.expense===max&&h.expense>0&&<small>฿{baht(h.expense)}</small>}</div><label>{h.label}</label></div>)}
      </div>
    </section>}
    {tab==='overview'&&<div className="mt-report-net-summary"><div><span>รายรับเดือนนี้</span><strong className="positive">+฿{baht(income)}</strong></div><div><span>เงินสุทธิเดือนนี้</span><strong className={net>=0?'positive':'negative'}>{net<0?'−':''}฿{baht(Math.abs(net))}</strong></div></div>}
  </div>;
}

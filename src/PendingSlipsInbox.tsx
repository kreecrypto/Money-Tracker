import {useState,type FormEvent} from 'react';
import {AlertTriangle,ArchiveX,Check,CheckCircle2,ChevronDown,ChevronUp,Save,Wallet} from 'lucide-react';
import {EXPENSE_CATEGORIES,INCOME_CATEGORIES,baht,toSatang,type EntryType,type Method} from './lib/finance';
import type {PendingSlip} from './lib/pendingSlips';
import {isTrueMoneyBankTopUp} from './lib/slipReview';

type Decision={status:'saved'|'duplicate'|'incomplete';reason?:string};
type Props={
  items:PendingSlip[];
  onSave:(item:PendingSlip)=>Promise<Decision>;
  onKeep:(item:PendingSlip)=>Promise<void>;
  onDiscard:(id:string)=>Promise<void>;
  onAdd:()=>void;
};
function PendingCard({item,onSave,onKeep,onDiscard}:{
  item:PendingSlip;onSave:Props['onSave'];onKeep:Props['onKeep'];onDiscard:Props['onDiscard'];
}){
  const [expanded,setExpanded]=useState(false);
  // Pending wallet transfers remain unclassified until the user explicitly selects a direction.
  const [draft,setDraft]=useState(()=>item);
  const [amount,setAmount]=useState(item.amountSatang===null?'':String(item.amountSatang/100));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const patch=(change:Partial<PendingSlip>)=>{
    setDraft(p=>({...p,...change}));
    setError('');setNotice('');
  };
  const assemble=():PendingSlip=>({
    ...draft,amountSatang:toSatang(amount),updatedAt:Date.now(),
    recipient:draft.recipient?.trim()||null,
  });
  const keep=async()=>{
    setBusy(true);setError('');setNotice('');
    try{const updated=assemble();await onKeep(updated);setDraft(updated);setNotice('บันทึกข้อมูลที่แก้ไขไว้ในเครื่องแล้ว (ยังไม่รวมยอด)');}
    catch(e){setError(e instanceof Error?e.message:'เก็บข้อมูลไม่สำเร็จ');}
    finally{setBusy(false);}
  };
  const save=async(e:FormEvent)=>{
    e.preventDefault();
    if(!draft.direction){setError('กรุณาเลือกรายรับหรือรายจ่ายก่อนบันทึก');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const result=await onSave(assemble());
      if(result.status==='incomplete')setError(result.reason||'ข้อมูลยังไม่ครบ กรุณาตรวจอีกครั้ง');
      else if(result.status==='duplicate')setNotice('รายการนี้มีอยู่แล้วในสมุดบันทึก จึงลบออกจากคิวรอตรวจ');
    }catch(e){setError(e instanceof Error?e.message:'บันทึกรายการไม่สำเร็จ');}
    finally{setBusy(false);}
  };
  const discard=async()=>{
    const label=draft.kind==='wallet_topup'?'การเติมเงินนี้':'รายการรอตรวจนี้';
    if(!window.confirm('ต้องการลบ'+label+'ออกจากคิวใช่หรือไม่? ไม่มีรายการรายรับ–รายจ่ายถูกลบ'))return;
    setBusy(true);setError('');
    try{await onDiscard(item.id);}
    catch(e){setError(e instanceof Error?e.message:'ลบรายการรอตรวจไม่สำเร็จ');}
    finally{setBusy(false);}
  };
  const categories=draft.direction==='income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES;
  return <article className="pending-slip-card" aria-label={draft.name}>
    <div className="pending-slip-row">
      <div className="pending-slip-main">
        <span className="pending-slip-amount">{draft.amountSatang!==null?'฿'+baht(draft.amountSatang):'ยังอ่านยอดไม่ได้'}</span>
        <strong>{draft.recipient||draft.name||'สลิปที่รอตรวจ'}</strong>
        <span>{draft.date||'วันที่ยังไม่ครบ'}{draft.time?' · '+draft.time:''}</span>
      </div>
      <span className={'pending-slip-chip'+(draft.kind==='wallet_topup'?' wallet':'')}>{draft.kind==='wallet_topup'?'เติม Wallet':'รอตรวจ'}</span>
    </div>
    <div className="pending-slip-detail">{isTrueMoneyBankTopUp(draft)
      ?'เติมเงิน TrueMoney: ระบบกำหนดเป็นรายจ่ายจากธนาคารแล้ว ตรวจยอด วันที่ เวลา และผู้รับก่อนบันทึก'
      :draft.kind==='wallet_topup'
        ?'เติมเงิน Wallet: ระบบกำหนดเป็นรายจ่ายจากธนาคารแล้ว ตรวจข้อมูลที่ยังไม่ครบก่อนบันทึก'
        :draft.reason||'ยังอ่านข้อมูลจากสลิปไม่ครบ กรุณาตรวจข้อมูลก่อนบันทึก'}</div>
    <button type="button" className="pending-slip-toggle" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>
      {expanded?'ซ่อนรายละเอียด':'ตรวจและแก้ไข'} {expanded?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
    </button>
    {expanded&&<form className="pending-slip-form" onSubmit={save}>
      <div className="slip-attention-fields">
        <label>จำนวนเงิน (บาท)
          <input inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setError('');}} placeholder="0.00"/>
        </label>
        <label>ประเภท (ต้องเลือก)
          <select value={draft.direction||''} required onChange={e=>patch({direction:e.target.value as EntryType,category:'อื่น ๆ'})}>
            <option value="" disabled>เลือกประเภท</option>
            <option value="expense">เงินออก / รายจ่าย</option>
            <option value="income">เงินเข้า / รายรับ</option>
          </select>
        </label>
        <label>วันที่ทำรายการ<input type="date" value={draft.date||''} onChange={e=>patch({date:e.target.value||null})}/></label>
        <label>เวลาทำรายการ<input type="time" value={draft.time||''} onChange={e=>patch({time:e.target.value||null})}/></label>
        <label className="slip-attention-wide">ผู้รับเงิน / ร้านค้า
          <input maxLength={160} value={draft.recipient||''} onChange={e=>patch({recipient:e.target.value})}/>
        </label>
        {draft.direction&&<label>หมวดหมู่
          <select value={draft.category} onChange={e=>patch({category:e.target.value})}>
            {categories.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </label>}
        <label>ช่องทาง
          <select value={draft.method} onChange={e=>patch({method:e.target.value as Method})}>
            <option value="bank">โอน/ธนาคาร</option><option value="wallet">e-Wallet</option>
            <option value="card">บัตรเครดิต</option><option value="cash">เงินสด</option>
          </select>
        </label>
      </div>
      {error&&<p className="error-message" role="alert">{error}</p>}
      {notice&&<p className="pending-slip-notice" role="status"><CheckCircle2 size={16}/>{notice}</p>}
      <button type="submit" className="btn btn-primary slip-correct-save" disabled={busy}>
        <Check size={17}/>{busy?'กำลังดำเนินการ…':'บันทึกรายการนี้'}
      </button>
      <div className="pending-slip-secondary">
        <button type="button" className="btn btn-secondary" onClick={()=>void keep()} disabled={busy}>
          <Save size={16}/> บันทึกไว้แก้ภายหลัง
        </button>
        <button type="button" className="btn btn-ghost bordered" onClick={()=>void discard()} disabled={busy}>
          <ArchiveX size={16}/> {draft.kind==='wallet_topup'?'ไม่นับรายการ':'ลบจากรอตรวจ'}
        </button>
      </div>
      <p className="pending-slip-note">รายการนี้จะรวมในยอดรายรับ–รายจ่ายต่อเมื่อบันทึกสำเร็จเท่านั้น</p>
    </form>}
  </article>;
}
export default function PendingSlipsInbox({items,onSave,onKeep,onDiscard,onAdd}:Props){
  return <section className="surface pending-inbox" aria-label="รายการสลิปที่รอตรวจ">
    <div className="pending-inbox-head">
      <div><h3>รอตรวจ {items.length>0?'('+items.length+')':''}</h3>{items.length>0&&<p>รายการเหล่านี้ยังไม่รวมในยอดเงิน</p>}
      </div>
    </div>
    {items.length===0?<div className="pending-inbox-empty">
      <CheckCircle2 size={32}/>
      <strong>ไม่มีสลิปค้างตรวจ</strong>
      
      <button className="btn btn-primary" onClick={onAdd}><Wallet size={16}/> เพิ่มสลิป</button>
    </div>:<div className="pending-inbox-list">{items.map(item=>
      <PendingCard key={item.id} item={item} onSave={onSave} onKeep={onKeep} onDiscard={onDiscard}/>
    )}</div>}
    {items.length>0&&<p className="pending-privacy"><AlertTriangle size={15}/> รายการรอตรวจอยู่ในเครื่องนี้ ไม่เก็บภาพสลิป กรุณาเก็บรูปต้นฉบับไว้ เพราะข้อมูลอาจหายเมื่อล้างข้อมูลเบราว์เซอร์</p>}
  </section>;
}

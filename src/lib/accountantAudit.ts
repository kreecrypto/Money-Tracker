import type {Transaction} from './finance';

export type AuditBucket={amountSatang:number;count:number};
export type AccountantAudit={
  income:AuditBucket;
  outflow:AuditBucket;
  debtPayments:AuditBucket;
  walletTopups:AuditBucket;
  needsClassification:AuditBucket;
  otherCategorized:AuditBucket;
  possibleDuplicatePairs:number;
};

export type AccountantBucketKey='debtPayments'|'walletTopups'|'needsClassification'|'otherCategorized';
export const ACCOUNTANT_BUCKET_LABELS:Record<AccountantBucketKey,string>={
  debtPayments:'ชำระหนี้ / บัตรเครดิต',
  walletTopups:'เติมเงิน Wallet',
  needsClassification:'ยังจำแนกไม่ชัดเจน',
  otherCategorized:'รายการที่จัดหมวดแล้ว'
};

/** Same classifier for audit totals and drill-down; unknown purpose stays unknown. */
export function accountantBucketFor(item:Transaction):AccountantBucketKey|null{
  if(item.type!=='expense')return null;
  if(item.category==='ผ่อนชำระ/หนี้')return 'debtPayments';
  if(/^เติมเงิน K PLUS \(Gmail\)|หมวดย่อย:\s*เติมเงิน e-Wallet/i.test(item.note))return 'walletTopups';
  if(item.category==='อื่น ๆ'&&!/หมวดย่อย:\s*(?:ค่าปรับ|ประกันชีวิต|บริการส่วนบุคคล\/ตัดผม)/.test(item.note))
    return 'needsClassification';
  return 'otherCategorized';
}

/** Read-only cash-out review. This is NOT a bank reconciliation or profit/loss statement. */
export function accountantAudit(items:readonly Transaction[]):AccountantAudit{
  const income={amountSatang:0,count:0};
  const outflow={amountSatang:0,count:0};
  const debtPayments={amountSatang:0,count:0};
  const walletTopups={amountSatang:0,count:0};
  const needsClassification={amountSatang:0,count:0};
  const otherCategorized={amountSatang:0,count:0};
  const possibleRepeat=new Map<string,{minute:number;id:string}[]>();
  for(const item of items){
    if(item.type==='income'){
      income.amountSatang+=item.amountSatang;income.count++;
      continue;
    }
    outflow.amountSatang+=item.amountSatang;outflow.count++;
    const key=accountantBucketFor(item)!;
    const buckets={debtPayments,walletTopups,needsClassification,otherCategorized};
    buckets[key].amountSatang+=item.amountSatang;buckets[key].count++;
    // Names are used only locally. Matching payments are review suggestions, not duplicates.
    const name=item.recipient?.trim().replace(/\s+/g,' ').toLocaleLowerCase('th-TH');
    if(!name||!item.time||!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))continue;
    const key=[item.date,item.amountSatang,name].join('|');
    const minute=Number(item.time.slice(0,2))*60+Number(item.time.slice(3));
    const groupRows=possibleRepeat.get(key)||[];
    groupRows.push({minute,id:item.id});possibleRepeat.set(key,groupRows);
  }
  let possibleDuplicatePairs=0;
  for(const rows of possibleRepeat.values()){
    rows.sort((a,b)=>a.minute-b.minute);
    for(let i=0;i<rows.length;i++){
      for(let j=i+1;j<rows.length&&rows[j].minute-rows[i].minute<=2;j++){
        if(rows[i].id!==rows[j].id)possibleDuplicatePairs++;
      }
    }
  }
  return {income,outflow,debtPayments,walletTopups,needsClassification,otherCategorized,possibleDuplicatePairs};
}

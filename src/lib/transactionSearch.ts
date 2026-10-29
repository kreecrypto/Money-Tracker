import {METHODS,transactionDisplayName,type Transaction} from './finance';

/** Search both the displayed counterparty and original OCR identities without mutating the slip. */
export function matchesTransactionSearch(transaction:Transaction,query:string):boolean {
  const needle=query.trim().toLocaleLowerCase('th-TH');
  if(!needle)return true;
  const fields=[
    transactionDisplayName(transaction),transaction.category,transaction.note,
    transaction.sender,transaction.recipient,transaction.time,
    transaction.receipt?.receiptId,
    ...(transaction.receipt?.items||[]).map(item=>item.name),
    METHODS[transaction.method]
  ];
  return fields.filter(Boolean).join(' ').toLocaleLowerCase('th-TH').includes(needle);
}

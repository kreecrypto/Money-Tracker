import {METHODS,transactionDisplayName,type Transaction} from './finance';

/** Match what people see in the transaction row, including incoming sender names. */
export function matchesTransactionSearch(transaction:Transaction,query:string):boolean {
  const needle=query.trim().toLocaleLowerCase('th-TH');
  if(!needle)return true;
  const searchable=[
    transactionDisplayName(transaction),
    transaction.category,
    transaction.note,
    transaction.sender||'',
    transaction.recipient||'',
    transaction.time||'',
    transaction.receipt?.receiptId||'',
    ...(transaction.receipt?.items||[]).map(item=>item.name),
    METHODS[transaction.method],
  ].join(' ').toLocaleLowerCase('th-TH');
  return searchable.includes(needle);
}

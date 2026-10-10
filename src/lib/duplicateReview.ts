import type {EntryType,Method,Transaction} from './finance';

/** Advisory only: identical amounts on one day can be distinct real transfers.
 * Never silently discard or merge financial records based on this heuristic.
 */
export function potentialCrossChannelDuplicates(input:{
  type:EntryType|null;amountSatang:number|null;date:string|null;method:Method;
},existing:readonly Transaction[],incomingChannel:'iphone'|'line'):Transaction[]{
  if(!input.type||!input.date||!input.amountSatang||input.amountSatang<=0)return [];
  const prefix=incomingChannel==='iphone'?'line-':'iphone-';
  return existing.filter(t=>t.id.startsWith(prefix)&&
    t.type===input.type&&t.date===input.date&&t.amountSatang===input.amountSatang&&
    t.method===input.method);
}

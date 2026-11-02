import {EXPENSE_CATEGORIES} from './finance';

export const QUICK_EXPENSES=[
  {label:'อาหาร',category:'อาหารและเครื่องดื่ม',icon:'🍚'},
  {label:'กาแฟ',category:'อาหารและเครื่องดื่ม',icon:'☕'},
  {label:'ขนม',category:'อาหารและเครื่องดื่ม',icon:'🍪'},
  {label:'เติมน้ำมัน',category:'เดินทาง',icon:'⛽'},
  {label:'รถไฟฟ้า',category:'เดินทาง',icon:'🚆'},
  {label:'ช้อปปิ้ง',category:'ช้อปปิ้ง',icon:'🛍️'},
  {label:'ค่าไฟ',category:'บ้านและค่าน้ำไฟ',icon:'💡'},
  {label:'ค่ายา',category:'สุขภาพ',icon:'💊'},
] as const satisfies ReadonlyArray<{label:string;category:(typeof EXPENSE_CATEGORIES)[number];icon:string}>;

export function readQuickExpense(category:string,note:string):{quick:string;note:string}{
  const prefix=/^หมวดย่อย: ([^\n]+)(?:\n|$)/u.exec(note);
  const choice=prefix&&QUICK_EXPENSES.find(item=>item.label===prefix[1]&&item.category===category);
  return choice&&prefix
    ?{quick:choice.label,note:note.slice(prefix[0].length)}
    :{quick:'',note};
}

export function writeQuickExpense(quick:string,note:string):string{
  const details=note.trim();
  const valid=QUICK_EXPENSES.some(item=>item.label===quick);
  return valid?`หมวดย่อย: ${quick}${details?'\n'+details:''}`:details;
}

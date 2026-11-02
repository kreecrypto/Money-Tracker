import {todayLocal,type Transaction,type EntryType,type Method} from './finance';

/** Synthetic review-only fixture. Never write these records to IndexedDB or remote APIs. */
const examples: readonly [number,EntryType,number,string,string,Method,string?,string?][]=[
  [0,'income',3850000,'เงินเดือน','เงินเดือนตัวอย่าง', 'bank','บริษัทตัวอย่าง','บัญชีผู้รับตัวอย่าง'],
  [0,'expense',18500,'อาหารและเครื่องดื่ม','อาหารกลางวันตัวอย่าง','wallet',undefined,'ร้านอาหารตัวอย่าง'],
  [0,'expense',4800,'เดินทาง','ค่าเดินทาง','bank',undefined,'รถไฟฟ้าตัวอย่าง'],
  [0,'expense',129000,'ช้อปปิ้ง','ของใช้ในบ้าน','card',undefined,'ร้านสินค้าออนไลน์ตัวอย่าง'],
  [0,'income',245000,'งานเสริม','งานออกแบบตัวอย่าง','bank','ลูกค้าตัวอย่าง','บัญชีผู้รับตัวอย่าง'],
  [1,'expense',6900,'อาหารและเครื่องดื่ม','กาแฟและขนม','cash',undefined,'คาเฟ่ตัวอย่าง'],
  [1,'expense',59000,'บ้านและค่าน้ำไฟ','อินเทอร์เน็ตบ้าน','bank',undefined,'ผู้ให้บริการตัวอย่าง'],
  [1,'expense',35000,'อื่น ๆ','รอตรวจประเภทค่าใช้จ่าย','bank',undefined,'ผู้รับตัวอย่าง'],
  [4,'expense',75000,'สุขภาพ','ค่ายาและเวชภัณฑ์','card',undefined,'ร้านขายยาตัวอย่าง'],
  [7,'expense',300000,'ผ่อนชำระ/หนี้','ชำระบัตรเครดิต','bank',undefined,'บัญชีบัตรตัวอย่าง'],
  [9,'expense',150000,'อื่น ๆ','เติมเงิน Wallet','wallet',undefined,'Wallet ตัวอย่าง'],
  [12,'expense',22000,'บันเทิง','ดูภาพยนตร์','card',undefined,'โรงภาพยนตร์ตัวอย่าง'],
  [18,'income',820000,'งานเสริม','รับจ้างโปรเจกต์','bank','ลูกค้าทดลอง','บัญชีผู้รับตัวอย่าง'],
  [30,'expense',42000,'อาหารและเครื่องดื่ม','ซื้อของเข้าบ้าน','cash',undefined,'ตลาดตัวอย่าง'],
  [35,'expense',75000,'การศึกษา','หนังสือเรียน','card',undefined,'ร้านหนังสือตัวอย่าง'],
  [40,'income',3650000,'เงินเดือน','เงินเดือนเดือนก่อน','bank','บริษัทตัวอย่าง','บัญชีผู้รับตัวอย่าง'],
  [60,'expense',210000,'ผ่อนชำระ/หนี้','งวดรถ','bank',undefined,'สัญญาตัวอย่าง'],
  [65,'income',3620000,'เงินเดือน','เงินเดือนตัวอย่าง','bank','บริษัทตัวอย่าง','บัญชีผู้รับตัวอย่าง'],
  [90,'income',3560000,'เงินเดือน','เงินเดือนตัวอย่าง','bank','บริษัทตัวอย่าง','บัญชีผู้รับตัวอย่าง']
];

export function previewTransactions(now=new Date()):Transaction[]{
  const base=new Date(todayLocal(now)+'T12:00:00');
  return examples.map(([daysAgo,type,amountSatang,category,note,method,sender,recipient],index)=>{
    const day=new Date(base);
    day.setDate(day.getDate()-daysAgo);
    return {
      id:`demo-${index+1}`,type,amountSatang,category,note,method,sender,recipient,
      date:todayLocal(day),time:`${String(8+index%12).padStart(2,'0')}:${String((index*7)%60).padStart(2,'0')}`,
      createdAt:now.getTime()-daysAgo*86_400_000-index*60_000,
    };
  });
}

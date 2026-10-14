import type {SlipFields} from './slip';

/**
 * A transfer receipt is not inherently an expense: the same slip may be held
 * by the sender or recipient. Match both printed parties to locally configured
 * *full-name aliases*, never infer ownership from their position on the image.
 */
export function normalizedAccountHolderName(value:string|null|undefined):string {
  if(!value)return '';
  return value.normalize('NFKC')
    .replace(/\u0e4d\s*\u0e32/gu,'ำ')
    .toLocaleLowerCase('en-US')
    .replace(/^(?:(?:นางสาว|นาง|นาย|คุณ|น\.?ส\.?|mr\.?|mrs\.?|ms\.?)\s*)/iu,'')
    .replace(/[^\p{L}\p{N}]/gu,'');
}

export function parseAccountHolderNames(value:string):string[] {
  const names=value.split(/\r?\n/u).map(x=>x.trim()).filter(Boolean);
  if(names.length>10||names.some(x=>x.length>100||normalizedAccountHolderName(x).length<3))
    throw new Error('ใส่ชื่อบัญชีได้ไม่เกิน 10 ชื่อ ชื่อละ 3–100 ตัวอักษร');
  const seen=new Set<string>();
  return names.filter(name=>{
    const key=normalizedAccountHolderName(name);
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}

export type SlipOwnershipResult={slip:SlipFields;selfTransfer:boolean};

/** Use this only for bank transfers. Do not override retail/paid-bill receipts. */
export function classifySlipByOwner(slip:SlipFields,ownerNames:readonly string[]):SlipOwnershipResult {
  if(slip.source||slip.directionReason.includes('เติมเงินเข้า e-Wallet'))return {slip,selfTransfer:false};
  const header=slip.rawText.split(/\r?\n/u).slice(0,8).join(' ');
  const bankTransfer=/(?:โอน\s*(?:เงิน|สำเร็จ)|รับ\s*(?:เงิน|โอน)\s*สำเร็จ|เงิน\s*เข้าบัญชี|transfer|prompt\s*pay|พร้อมเพย์)/iu.test(header);
  const paidBill=/(?:จ่าย\s*บิล|ชำระ\s*บิล|bill\s*pay(?:ment)?)/iu.test(header);
  if(!bankTransfer||paidBill)return {slip,selfTransfer:false};

  const own=new Set(ownerNames.map(normalizedAccountHolderName).filter(x=>x.length>=3));
  const sender=normalizedAccountHolderName(slip.sender);
  const recipient=normalizedAccountHolderName(slip.recipient);
  if(!own.size){
    return {slip:{...slip,direction:null,
      directionReason:'ตั้งค่าชื่อบัญชีของฉันก่อน เพื่อแยกรายรับและรายจ่ายจากชื่อผู้โอนและผู้รับ'},selfTransfer:false};
  }
  // Both parties are needed to avoid treating an incomplete self-transfer as income.
  if(!sender||!recipient){
    return {slip:{...slip,direction:null,
      directionReason:'อ่านชื่อผู้ส่งหรือผู้รับไม่ครบ จึงยังเทียบกับชื่อบัญชีของฉันไม่ได้'},selfTransfer:false};
  }
  const fromMe=own.has(sender),toMe=own.has(recipient);
  if(fromMe&&toMe)return {slip:{...slip,direction:null,
    directionReason:'โอนเงินระหว่างบัญชีของตัวเอง — ไม่นับเป็นรายรับหรือรายจ่าย'},selfTransfer:true};
  if(fromMe)return {slip:{...slip,direction:'expense',
    directionReason:'ชื่อผู้ส่งตรงกับชื่อบัญชีของฉัน และชื่อผู้รับเป็นบุคคลอื่น'},selfTransfer:false};
  if(toMe)return {slip:{...slip,direction:'income',
    directionReason:'ชื่อผู้รับตรงกับชื่อบัญชีของฉัน และชื่อผู้ส่งเป็นบุคคลอื่น'},selfTransfer:false};
  return {slip:{...slip,direction:null,
    directionReason:'ชื่อผู้ส่งและผู้รับไม่ตรงกับชื่อบัญชีที่ตั้งไว้ กรุณาตรวจประเภทรายการ'},selfTransfer:false};
}

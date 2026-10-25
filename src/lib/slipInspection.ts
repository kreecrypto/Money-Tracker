/** A labelled OCR report is evidence of readable text, never bank-side verification. */
export type SlipInspection = {
  senderBank:string|null;
  recipientBank:string|null;
  reference:string|null;
  timeWithSeconds:string|null;
  reportedStatus:string|null;
  warnings:string[];
};

export function readSlipInspection(lines:readonly string[]):SlipInspection {
  const warnings:string[]=[];
  const read=(label:string,pattern:RegExp):string|null=>{
    const values=[...new Set(lines.flatMap(line=>{
      const match=line.match(pattern);
      return match?.[1]?[match[1].replace(/\s+/gu,' ').trim()]:[];
    }).filter(Boolean))];
    if(values.length>1){
      warnings.push('OCR พบ'+label+'ขัดแย้งกัน กรุณาตรวจจากสลิป');
      return null;
    }
    return values[0]||null;
  };
  const senderBank=read('ธนาคารต้นทาง',/^โอนจาก\s*[:：]\s*(.{3,160})$/iu);
  const recipientBank=read('ธนาคารปลายทาง',/^โอนถึง\s*[:：]\s*(.{3,160})$/iu);
  const reportedStatus=read('ข้อความสถานะ',/^สถานะ\s*[:：]\s*(.{2,80})$/iu);
  const reference=read('เลขอ้างอิง',/^(?:เลข(?:ที่)?\s*อ้างอิง|รหัส\s*อ้างอิง|reference|ref)\s*[:：]\s*([A-Z0-9]{12,48})$/iu);
  const rawTime=read('เวลาที่มีวินาที',/^เวลา\s*[:：]\s*((?:[01]?\d|2[0-3]):[0-5]\d:[0-5]\d)$/u);
  const timeWithSeconds=rawTime&&/^\d:/u.test(rawTime)?'0'+rawTime:rawTime;
  return {senderBank,recipientBank,reference:reference?.toUpperCase()||null,timeWithSeconds,reportedStatus,warnings};
}

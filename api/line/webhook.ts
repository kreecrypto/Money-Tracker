import {parseLineExpense} from '../../server/line/parser';
import {parseBankNotice,type BankNotice} from '../../server/line/bank';
import {readLineBankImage} from '../../server/line/ocr';
import {insertLineRow,reviewLineRow,fingerprint,type LineRow} from '../../server/line/storage';
import {issuePairCode,revokeLineSession} from '../../server/line/link';

export const maxDuration=120;
type LineEvent={
  type?:string;webhookEventId?:string;replyToken?:string;
  source?:{type?:string;userId?:string};
  message?:{type?:string;id?:string;text?:string};
  postback?:{data?:string};
};
type LineMessage={type:'text';text:string;quickReply?:{items:Array<{
  type:'action';action:{type:'postback';label:string;data:string;displayText:string}
}>}};
function todayBangkok(){
  const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const at=(k:string)=>p.find(x=>x.type===k)?.value||'';
  return at('year')+'-'+at('month')+'-'+at('day');
}
export async function verifyLineSignature(raw:string,sig:string,secret:string){
  if(!sig||sig.length>200)return false;
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(raw)));
  const expected=btoa(String.fromCharCode(...signed));
  let mismatch=expected.length^sig.length;
  for(let i=0;i<Math.max(expected.length,sig.length);i++)
    mismatch|=(expected.charCodeAt(i)||0)^(sig.charCodeAt(i)||0);
  return mismatch===0;
}
async function reply(replyToken:string,text:string,token:string,quickReply?:LineMessage['quickReply']){
  const message:LineMessage={type:'text',text:text.slice(0,4800)};
  if(quickReply)message.quickReply=quickReply;
  const r=await fetch('https://api.line.me/v2/bot/message/reply',{
    method:'POST',
    headers:{'content-type':'application/json',authorization:'Bearer '+token},
    body:JSON.stringify({replyToken,messages:[message]})
  });
  if(!r.ok)throw new Error('LINE_REPLY_FAILED_'+r.status);
}
const fmt=(n:number)=>new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100);
function reviewActions(id:string):LineMessage['quickReply']{
  const action=(label:string,choice:string)=>({
    type:'action' as const,
    action:{type:'postback' as const,label,data:'review|'+id+'|'+choice,displayText:label}
  });
  return {items:[action('บันทึกเป็นรายจ่าย','expense'),action('บันทึกเป็นรายรับ','income'),action('ไม่บันทึก','cancelled')]};
}
async function draftBank(notice:BankNotice,eventId:string,userId:string,source:'bank_text'|'bank_image'){
  if(!notice.date)throw new Error('BANK_DATE_UNRECOGNIZED');
  const hashed=notice.fingerprintSource?await fingerprint(notice.fingerprintSource):null;
  const row:LineRow={
    line_event_id:eventId,line_user_id:userId,type:notice.type,
    amount_satang:notice.amountSatang,category:'อื่น ๆ',
    note:(notice.bank==='kbank'?'KBank':'แจ้งเตือนธนาคาร')+' • '+(notice.type==='income'?'เงินเข้า':'โอน/ถอน'),
    method:'bank',transaction_date:notice.date,source_kind:source,
    fingerprint:hashed,status:'pending'
  };
  return await insertLineRow(row);
}
async function handle(event:LineEvent,token:string){
  const userId=event.source?.userId||'';
  const replyToken=event.replyToken||'';
  if(!userId||!replyToken)return;
  if(event.type==='postback'){
    const d=event.postback?.data||'';
    const m=d.match(/^review\|([A-Za-z0-9._-]{1,150})\|(income|expense|cancelled)$/);
    if(!m)return;
    try{
      const status=await reviewLineRow(m[1],userId,m[2] as 'income'|'expense'|'cancelled');
      const msg=status==='confirmed'?'ยืนยันบันทึกรายการแล้ว ✅ เปิด Money Tracker และกดซิงก์เพื่อดูรายการ'
        :status==='cancelled'?'ยกเลิกรายการแล้ว ไม่บันทึกยอดเงินนี้'
        :status==='already'?'รายการนี้จัดการไปแล้ว ไม่บันทึกซ้ำ'
        :'ไม่พบรายการที่รอตรวจสอบ';
      await reply(replyToken,msg,token);
    }catch(e){
      if(e instanceof Error&&e.message==='DUPLICATE_FINANCIAL_NOTICE'){
        await reply(replyToken,'รายการนี้ตรงกับธุรกรรมที่เคยบันทึกแล้ว ระบบไม่เพิ่มรายการซ้ำ',token);
        return;
      }
      throw e;
    }
    return;
  }
  if(event.type!=='message')return;
  const id=event.webhookEventId||event.message?.id||'';
  if(!/^[A-Za-z0-9._-]{1,150}$/.test(id))return;
  if(event.message?.type==='image'){
    try{
      const text=await readLineBankImage(event.message.id||'',token);
      const bank=parseBankNotice(text);
      if(!bank||!bank.date){
        await reply(replyToken,'อ่านวันที่หรือจำนวนเงินจากภาพไม่ชัดเจน จึงยังไม่บันทึก\nกรุณาส่งภาพใหม่ที่เห็นหัวข้อรายการ วันที่ และจำนวนเงินครบถ้วน',token);
        return;
      }
      const inserted=await draftBank(bank,id,userId,'bank_image');
      if(!inserted){
        await reply(replyToken,'ได้รับภาพรายการนี้แล้ว ไม่สร้างรายการซ้ำ',token);
        return;
      }
      await reply(replyToken,
        'ตรวจสอบรายการจากภาพธนาคาร\n'+(bank.bank==='kbank'?'KBank\n':'')+
        'ยอดเงิน: ฿'+fmt(bank.amountSatang)+'\nวันที่: '+bank.date+
        '\nระบบจะไม่ใช้ยอดเงินคงเหลือในภาพ\nเลือกประเภทรายการก่อนบันทึก',token,reviewActions(id));
    }catch(e){
      if(e instanceof Error&&e.message==='DUPLICATE_FINANCIAL_NOTICE'){
        await reply(replyToken,'ธุรกรรมนี้อาจเคยบันทึกแล้ว ไม่เพิ่มรายการซ้ำ',token);
      }else if(e instanceof Error&&['IMAGE_TOO_LARGE','IMAGE_TYPE_NOT_SUPPORTED','LINE_MEDIA_UNAVAILABLE','BANK_DATE_UNRECOGNIZED'].includes(e.message)){
        await reply(replyToken,'ไม่สามารถอ่านภาพนี้ได้ กรุณาส่งภาพสลิปหรือแจ้งเตือนธนาคารแบบ JPEG/PNG ที่เห็นวันที่และยอดเงินชัดเจน',token);
      }else throw e;
    }
    return;
  }
  if(event.message?.type!=='text'){
    await reply(replyToken,'รองรับข้อความค่าใช้จ่าย และรูปแจ้งเตือนธุรกรรมธนาคารแบบ JPEG/PNG',token);
    return;
  }
  const body=(event.message.text||'').trim();
  if(body==='/เชื่อม'||body==='เชื่อม Money Tracker'){
    const code=await issuePairCode(userId);
    await reply(replyToken,'รหัสเชื่อม Money Tracker (ใช้ได้ 5 นาที):\n'+code+
      '\nเปิด Money Tracker > ตั้งค่า > เชื่อม LINE แล้ววางรหัสนี้\nอย่าส่งรหัสให้บุคคลอื่น',token);
    return;
  }
  if(body==='/ยกเลิกเชื่อม'){
    await revokeLineSession(userId);
    await reply(replyToken,'ยกเลิกการเชื่อมอุปกรณ์แล้ว กรุณาลบรหัสเชื่อมในแอปด้วย',token);
    return;
  }
  const bank=parseBankNotice(body);
  if(bank){
    if(!bank.date){
      await reply(replyToken,'กรุณาส่งข้อความที่มีวันที่ทำรายการชัดเจน ยังไม่ได้บันทึก',token);
      return;
    }
    try{
      const inserted=await draftBank(bank,id,userId,'bank_text');
      await reply(replyToken,inserted?
        'ตรวจรายการที่ส่งต่อ\nยอด ฿'+fmt(bank.amountSatang)+' วันที่ '+bank.date+
        '\nเลือกประเภทรายการก่อนบันทึก':'ข้อความนี้เคยส่งแล้ว ไม่เพิ่มซ้ำ',
        token,inserted?reviewActions(id):undefined);
    }catch(e){
      if(e instanceof Error&&e.message==='DUPLICATE_FINANCIAL_NOTICE'){
        await reply(replyToken,'ธุรกรรมนี้เคยบันทึกแล้ว ไม่เพิ่มรายการซ้ำ',token);
      }else throw e;
    }
    return;
  }
  const parsed=parseLineExpense(body);
  if(!parsed.ok){
    await reply(replyToken,'ยังไม่บันทึก กรุณาใส่ยอดเดียวให้ชัดเจน เช่น\nกาแฟ 65\nจ่าย 120 ค่าแท็กซี่\nรับ 5000 งานเสริม\nหรือส่งต่อภาพแจ้งเตือนธนาคาร',token);
    return;
  }
  const row:LineRow={
    line_event_id:id,line_user_id:userId,status:'confirmed',source_kind:'text',fingerprint:null,
    type:parsed.value.type,amount_satang:parsed.value.amountSatang,
    category:parsed.value.category,note:parsed.value.note,method:parsed.value.method,
    transaction_date:todayBangkok()
  };
  const inserted=await insertLineRow(row);
  await reply(replyToken,inserted?
    'บันทึก'+(row.type==='income'?'รายรับ':'รายจ่าย')+'แล้ว ✅\n฿'+fmt(row.amount_satang)+
    '\nหมวด: '+row.category+'\nเปิด Money Tracker เพื่อซิงก์ข้อมูล'
    :'รายการนี้เคยบันทึกแล้ว ไม่เพิ่มซ้ำ',token);
}
export async function POST(request:Request):Promise<Response>{
  const secret=process.env.LINE_CHANNEL_SECRET;
  if(!secret)return new Response('Not configured',{status:503});
  if(Number(request.headers.get('content-length')||0)>256000)return new Response('Too large',{status:413});
  const raw=await request.text();
  if(raw.length>256000)return new Response('Too large',{status:413});
  if(!await verifyLineSignature(raw,request.headers.get('x-line-signature')||'',secret))
    return new Response('Forbidden',{status:403});
  let data:{events?:LineEvent[]};
  try{data=JSON.parse(raw) as {events?:LineEvent[]};}
  catch{return new Response('Invalid JSON',{status:400});}
  if(!Array.isArray(data.events)||data.events.length>50)return new Response('Invalid webhook',{status:400});
  if(data.events.length===0)return new Response('OK',{status:200});
  const token=process.env.LINE_CHANNEL_ACCESS_TOKEN||'';
  const allow=new Set((process.env.LINE_ALLOWED_USER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean));
  if(!token||!allow.size||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return new Response('Not configured',{status:503});
  try{
    for(const ev of data.events){
      if(ev.source?.type!=='user'||!ev.source.userId||!allow.has(ev.source.userId))continue;
      await handle(ev,token);
    }
    return new Response('OK',{status:200});
  }catch{
    // LINE redelivery is safe because every event has an idempotent event ID.
    return new Response('Temporarily unavailable',{status:503});
  }
}
export function GET(){return new Response('Method not allowed',{status:405});}

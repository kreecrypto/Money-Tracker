import { parseLineExpense } from './_parser';

type LineEvent = {
  type?: string;
  webhookEventId?: string;
  replyToken?: string;
  source?: {type?:string; userId?:string};
  message?: {type?:string; id?:string; text?:string};
};

function bangkokDate() {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const lookup=(k:string)=>parts.find(x=>x.type===k)?.value||'';
  return lookup('year')+'-'+lookup('month')+'-'+lookup('day');
}
async function validSignature(raw:string, received:string, secret:string):Promise<boolean>{
  if(!received || received.length>200) return false;
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),'HMAC',false,['sign']);
  const digest=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(raw)));
  const expected=btoa(String.fromCharCode(...digest));
  let mismatch=received.length^expected.length;
  for(let i=0;i<Math.max(expected.length,received.length);i++){
    mismatch |= (received.charCodeAt(i)||0)^(expected.charCodeAt(i)||0);
  }
  return mismatch===0;
}
async function lineReply(replyToken:string, text:string,accessToken:string) {
  const r=await fetch('https://api.line.me/v2/bot/message/reply',{
    method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+accessToken},
    body:JSON.stringify({replyToken,messages:[{type:'text',text:text.slice(0,4800)}]})
  });
  if(!r.ok)throw new Error('LINE_REPLY_FAILED_'+r.status);
}
function formatMoney(satang:number){
  return new Intl.NumberFormat('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2}).format(satang/100);
}

async function saveLineRecord(entry:ReturnType<typeof parseLineExpense> & {ok:true}, id:string,userId:string, date:string){
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key)throw new Error('STORAGE_NOT_CONFIGURED');
  const endpoint=new URL('/rest/v1/money_tracker_line_transactions',url);
  endpoint.searchParams.set('on_conflict','line_event_id');
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{
      apikey:key,
      authorization:'Bearer '+key,
      'content-type':'application/json',
      prefer:'resolution=ignore-duplicates,return=representation',
    },
    body:JSON.stringify({
      line_event_id:id,line_user_id:userId,type:entry.value.type,
      amount_satang:entry.value.amountSatang,category:entry.value.category,
      note:entry.value.note,method:entry.value.method,transaction_date:date
    })
  });
  if(!response.ok)throw new Error('STORAGE_WRITE_FAILED_'+response.status);
  const data=await response.json() as Array<{id:string}>;
  return data.length>0;
}

export async function POST(request:Request):Promise<Response>{
  const secret=process.env.LINE_CHANNEL_SECRET;
  if(!secret)return new Response('Not configured',{status:503});
  const size=Number(request.headers.get('content-length')||0);
  if(size>256000)return new Response('Payload too large',{status:413});
  const raw=await request.text();
  if(raw.length>256000)return new Response('Payload too large',{status:413});
  if(!await validSignature(raw,request.headers.get('x-line-signature')||'',secret))
    return new Response('Forbidden',{status:403});
  let body:{events?:LineEvent[]};
  try{body=JSON.parse(raw) as {events?:LineEvent[]};}
  catch{return new Response('Invalid JSON',{status:400});}
  if(!Array.isArray(body.events))return new Response('Invalid webhook',{status:400});
  if(!body.events.length)return new Response('OK',{status:200});
  const token=process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const allow=(process.env.LINE_ALLOWED_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!token || !allow.length || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return new Response('Not configured',{status:503});
  try{
    for(const event of body.events){
      if(event.type!=='message'||event.source?.type!=='user'||!event.source.userId || !allow.includes(event.source.userId)) continue;
      if(!event.replyToken)continue;
      if(event.message?.type!=='text'){
        await lineReply(event.replyToken,'ตอนนี้บันทึกจากข้อความได้แล้ว เช่น "กาแฟ 65" หรือ "รับ 2000 งานเสริม"\nการอ่านรูปสลิปอัตโนมัติยังไม่เปิดใช้งาน',token);
        continue;
      }
      const parsed=parseLineExpense(event.message.text||'');
      if(!parsed.ok){
        await lineReply(event.replyToken,
          'ยังไม่ได้บันทึกรายการ กรุณาส่งข้อความที่มีจำนวนเงินชัดเจน 1 ยอด เช่น\nกาแฟ 65\nจ่าย 120 ค่าแท็กซี่\nรับ 5000 งานเสริม\n(การโอนเงินเข้าระบุ "รับ" หรือ "เงินเข้า")',token);
        continue;
      }
      const eventId=event.webhookEventId||event.message.id;
      if(!eventId)continue;
      const added=await saveLineRecord(parsed,eventId,event.source.userId,bangkokDate());
      const title=parsed.value.type==='income'?'รายรับ':'รายจ่าย';
      await lineReply(event.replyToken,added
        ? 'บันทึก '+title+' จาก LINE แล้ว ✅\n฿'+formatMoney(parsed.value.amountSatang)+'\nหมวด: '+parsed.value.category+'\n'+parsed.value.note+'\nหมายเหตุ: รายการนี้เก็บใน Cloud Inbox และต้องเชื่อมบัญชีใน Money Tracker เพื่อแสดงในแอป'
        : 'ข้อความนี้เคยบันทึกแล้ว ไม่เพิ่มรายการซ้ำ ✅',token);
    }
    return new Response('OK',{status:200});
  }catch{
    // LINE may redeliver. The unique event ID prevents duplicate financial records.
    return new Response('Temporarily unavailable',{status:503});
  }
}
export function GET(){return new Response('Method not allowed',{status:405});}

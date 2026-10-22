/**
 * Gmail -> Money Tracker, single-owner K PLUS integration.
 * Script Properties (never put secrets in source):
 * MT_API_URL = https://your-backend.example/api/gmail/import
 * MT_API_TOKEN = same 64-hex GMAIL_IMPORT_TOKEN configured on Vercel
 * Run setupMoneyTrackerGmail() once. Starts now, never imports historic email.
 */
function setupMoneyTrackerGmail() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('MT_API_URL') || '';
  var token = props.getProperty('MT_API_TOKEN') || '';
  if (!/^https:\/\/[^/]+\/api\/gmail\/import$/.test(url) || !/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error('Set MT_API_URL and MT_API_TOKEN in Script Properties first');
  }
  if (!props.getProperty('MT_IMPORT_CURSOR_MS')) {
    props.setProperty('MT_IMPORT_CURSOR_MS', String(Date.now()));
  }
  var found = ScriptApp.getProjectTriggers().some(function(t) {
    return t.getHandlerFunction() === 'importKplusEmailNotices';
  });
  if (!found) ScriptApp.newTrigger('importKplusEmailNotices').timeBased().everyMinutes(5).create();
  Logger.log('Money Tracker Gmail importer configured; only future mail will be imported.');
}
function moneyTrackerSafeText(body) {
  var keep = /^(?:วันที่ทำรายการ|Transaction Date|เลขที่รายการ|Transaction Number|จำนวนเงิน\s*\(บาท\)|Amount\s*\(THB\)|ชื่อ(?:ผู้รับ(?:เงิน)?|ผู้โอน|ผู้ส่ง|ร้านค้า)?(?:\s|:|：)|Received Name|Company Name|Sender Name|From Name|เงินเข้าบัญชี|รับโอนเงิน|ได้รับเงินโอน|เครดิตเข้าบัญชี|funds received|incoming transfer|credited to account|โอนเงินจากบัญชี|ชำระเงินจากบัญชี|โอนเงินออกจากบัญชี|From Account|Paid From Account)/i;
  var privateAccount = /^(?:โอนเงินจากบัญชี|ชำระเงินจากบัญชี|โอนเงินออกจากบัญชี|From Account|Paid From Account)/i;
  return String(body).split(/\r?\n/).map(function(raw) {
    var line = raw.trim();
    if (!keep.test(line)) return '';
    // Keep only the direction marker, never send source account numbers.
    if (privateAccount.test(line)) return line.match(privateAccount)[0];
    return line.slice(0, 240);
  }).filter(Boolean).slice(0, 40).join('\n').slice(0, 12000);
}
function importKplusEmailNotices() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var url = props.getProperty('MT_API_URL') || '';
    var token = props.getProperty('MT_API_TOKEN') || '';
    var cursor = Number(props.getProperty('MT_IMPORT_CURSOR_MS'));
    if (!/^https:\/\/[^/]+\/api\/gmail\/import$/.test(url) || !/^[a-f0-9]{64}$/i.test(token) ||
        !Number.isSafeInteger(cursor) || cursor<=0) throw new Error('Run setupMoneyTrackerGmail first');
    var threshold = cursor - 10 * 60 * 1000;
    var searchDate = Utilities.formatDate(new Date(threshold), 'Asia/Bangkok', 'yyyy/MM/dd');
    var query = 'from:kplus@kasikornbank.com after:' + searchDate;
    var messages = [];
    var full = false;
    for (var offset=0; offset<500; offset+=100) {
      var threads = GmailApp.search(query, offset, 100);
      threads.forEach(function(thread) {
        thread.getMessages().forEach(function(msg) {
          if (msg.getDate().getTime()>=threshold) messages.push(msg);
        });
      });
      if (threads.length<100) break;
      if (offset===400) full=true;
    }
    messages.sort(function(a,b) {return a.getDate().getTime()-b.getDate().getTime();});
    var ok=0, skipped=0, failures=0;
    messages.forEach(function(msg) {
      var from=msg.getFrom();
      var addr=(from.match(/(?:^|[\s<])([^\s<>]+@[^\s<>]+)>?\s*$/)||[])[1] || '';
      if (addr.trim().toLowerCase()!=='kplus@kasikornbank.com') {skipped++;return;}
      var payload={
        messageId:msg.getId(),
        from:'kplus@kasikornbank.com',
        subject:msg.getSubject(),
        text:moneyTrackerSafeText(msg.getPlainBody())
      };
      if (payload.text.length<12) {skipped++;return;}
      try {
        var response=UrlFetchApp.fetch(url,{
          method:'post',contentType:'application/json',
          headers:{Authorization:'Bearer '+token},
          payload:JSON.stringify(payload),muteHttpExceptions:true
        });
        var code=response.getResponseCode();
        var parsed=JSON.parse(response.getContentText());
        if (code>=200&&code<300&&['saved','pending','duplicate','skipped'].indexOf(parsed.status)>=0) ok++;
        else failures++;
      } catch (e) {failures++;}
    });
    if (failures===0&&!full) props.setProperty('MT_IMPORT_CURSOR_MS',String(Date.now()));
    Logger.log('Gmail import: processed='+ok+', ignored='+skipped+', errors='+failures+', truncated='+full);
  } finally {lock.releaseLock();}
}

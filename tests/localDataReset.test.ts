import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  clear:vi.fn(),
  load:vi.fn(),
  save:vi.fn()
}));
vi.mock('../src/lib/storage',()=>({
  clearLocalData:mocks.clear,
  loadTransactions:mocks.load,
  saveTransaction:mocks.save,
}));
import {LOCAL_DATA_KEYS,eraseLocalMoneyTrackerData} from '../src/lib/localDataReset';
import {iphoneSync,resetIphoneImportHistory} from '../src/lib/iphoneSync';

const mem=new Map<string,string>();
const local={
  getItem:(key:string)=>mem.get(key)??null,
  setItem:(key:string,value:string)=>{mem.set(key,String(value));},
  removeItem:(key:string)=>{mem.delete(key);},
};
const remote={
  id:'iphone-00000000-0000-4000-8000-000000000001',
  type:'expense',
  amountSatang:19900,
  date:'2026-10-15',
  category:'อื่น ๆ',
  note:'K PLUS · Shortcut Auto Import',
  method:'bank',
  createdAt:Date.parse('2026-10-15T09:01:00Z')
};
beforeEach(()=>{
  mem.clear();
  vi.stubGlobal('localStorage',local);
  vi.stubGlobal('window',{location:{protocol:'https:',hostname:'money-tracker-beta-teal.vercel.app',origin:'https://money-tracker-beta-teal.vercel.app'}});
  mocks.clear.mockReset().mockResolvedValue(undefined);
  mocks.load.mockReset().mockResolvedValue([]);
  mocks.save.mockReset().mockResolvedValue(undefined);
});
describe('local-only data reset',()=>{
  it('clears the local database and only app-owned preferences/pairing keys',async()=>{
    for(const key of LOCAL_DATA_KEYS)mem.set(key,'configured');
    mem.set('unrelated-app-session','must remain');
    await eraseLocalMoneyTrackerData();
    expect(mocks.clear).toHaveBeenCalledOnce();
    for(const key of LOCAL_DATA_KEYS)expect(local.getItem(key)).toBeNull();
    expect(local.getItem('unrelated-app-session')).toBe('must remain');
  });
  it('never clears pairing keys if IndexedDB erase fails',async()=>{
    local.setItem('money-tracker-iphone-review-token-v1','A'.repeat(64));
    mocks.clear.mockRejectedValueOnce(new Error('IndexedDB failed'));
    await expect(eraseLocalMoneyTrackerData()).rejects.toThrow('IndexedDB failed');
    expect(local.getItem('money-tracker-iphone-review-token-v1')).toBe('A'.repeat(64));
  });
  it('repair resets the iPhone cursor but keeps the Review Token',()=>{
    local.setItem('money-tracker-iphone-seen-v1','["iphone-id"]');
    local.setItem('money-tracker-iphone-review-token-v1','A'.repeat(64));
    resetIphoneImportHistory();
    expect(local.getItem('money-tracker-iphone-seen-v1')).toBeNull();
    expect(local.getItem('money-tracker-iphone-review-token-v1')).toBe('A'.repeat(64));
  });
  it('repairs a missing transaction only after the user resets import history',async()=>{
    local.setItem('money-tracker-iphone-review-token-v1','A'.repeat(64));
    local.setItem('money-tracker-iphone-seen-v1',JSON.stringify([remote.id]));
    resetIphoneImportHistory();
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({transactions:[remote]}),{status:200})));
    const result=await iphoneSync();
    expect(result).toEqual({imported:1,received:1,invalid:0});
    expect(mocks.save).toHaveBeenCalledWith(remote);
  });
  it('keeps an intentionally deleted cloud import hidden until explicit repair',async()=>{
    local.setItem('money-tracker-iphone-review-token-v1','A'.repeat(64));
    local.setItem('money-tracker-iphone-seen-v1',JSON.stringify([remote.id]));
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({transactions:[remote]}),{status:200})));
    expect(await iphoneSync()).toEqual({imported:0,received:1,invalid:0});
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('repairs only stale THAILAND payees from authoritative cloud without changing financial fields',async()=>{
    local.setItem('money-tracker-iphone-review-token-v1','A'.repeat(64));
    const wrong={...remote,recipient:'THAILAND'};
    mocks.load.mockResolvedValue([wrong]);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({transactions:[remote]}),{status:200})));
    expect(await iphoneSync()).toEqual({imported:0,repaired:1,received:1,invalid:0});
    expect(mocks.save).toHaveBeenCalledWith(remote);
    expect(mocks.save.mock.calls[0][0].amountSatang).toBe(19900);
  });
  it('never replaces a recipient the user already corrected on-device',async()=>{
    local.setItem('money-tracker-iphone-review-token-v1','A'.repeat(64));
    const corrected={...remote,recipient:'ร้านค้าตัวอย่าง'};
    mocks.load.mockResolvedValue([corrected]);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({transactions:[remote]}),{status:200})));
    expect(await iphoneSync()).toEqual({imported:0,received:1,invalid:0});
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('does not duplicate a transaction that still exists locally',async()=>{
    local.setItem('money-tracker-iphone-review-token-v1','A'.repeat(64));
    mocks.load.mockResolvedValue([remote]);
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({transactions:[remote]}),{status:200})));
    expect(await iphoneSync()).toEqual({imported:0,received:1,invalid:0});
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

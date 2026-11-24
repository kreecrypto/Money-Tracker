import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {iphoneConnect,iphoneConnected,iphoneDrafts,iphoneSync} from '../src/lib/iphoneSync';
import type {Transaction} from '../src/lib/finance';

const store=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}));
vi.mock('../src/lib/storage',()=>({loadTransactions:store.load,saveTransaction:store.save}));
const token='A'.repeat(64);
const remote:Transaction={id:'iphone-11111111-1111-4111-8111-111111111111',type:'expense',amountSatang:1250,date:'2026-11-01',time:'08:36',category:'อื่น ๆ',note:'synthetic test',method:'bank',createdAt:1};
const local:Transaction={...remote,id:'local-synthetic',amountSatang:3000};
let saved:Transaction[];
let fetcher:ReturnType<typeof vi.fn>;
beforeEach(()=>{
  const map=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>map.set(key,value),removeItem:(key:string)=>map.delete(key)});
  vi.stubEnv('VITE_IPHONE_BRIDGE_URL','https://fixture.example');
  fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  saved=[{...local}];store.load.mockReset().mockImplementation(async()=>saved.map(x=>({...x})));
  store.save.mockReset().mockImplementation(async(x:Transaction)=>{saved=saved.filter(y=>y.id!==x.id).concat({...x});});
  iphoneConnect(token);
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('Cloud sync safety',()=>{
  it('retains pairing after a Vercel-like HTML 401',async()=>{
    fetcher.mockResolvedValue(new Response('<html>Authentication required</html>',{status:401}));
    await expect(iphoneSync()).rejects.toThrow('401');
    expect(iphoneConnected()).toBe(true);expect(saved).toEqual([local]);
  });
  it('disconnects only on explicit application unauthorized response',async()=>{
    fetcher.mockResolvedValue(Response.json({error:'UNAUTHORIZED'},{status:401}));
    await expect(iphoneSync()).rejects.toThrow('Review Token');
    expect(iphoneConnected()).toBe(false);expect(saved).toEqual([local]);
  });
  it('does not confuse a malformed pending response with an empty inbox',async()=>{
    fetcher.mockResolvedValue(Response.json({status:'ok'}));
    await expect(iphoneDrafts()).rejects.toThrow('Cloud');
    expect(saved).toEqual([local]);
  });
  it('appends confirmed rows once, preserving local records and deliberate deletions',async()=>{
    fetcher.mockImplementation(async()=>Response.json({transactions:[remote]}));
    expect(await iphoneSync()).toMatchObject({imported:1,received:1,invalid:0});
    expect(saved).toEqual([local,remote]);
    expect(await iphoneSync()).toMatchObject({imported:0});
    saved=saved.filter(x=>x.id!==remote.id);
    expect(await iphoneSync()).toMatchObject({imported:0});
    expect(saved).toEqual([local]);expect(store.save).toHaveBeenCalledTimes(1);
  });
  it('keeps existing rows when a ledger response is invalid',async()=>{
    fetcher.mockResolvedValue(Response.json({transactions:[{...remote,amountSatang:-1}]}));
    expect(await iphoneSync()).toMatchObject({imported:0,invalid:1});
    expect(saved).toEqual([local]);expect(store.save).not.toHaveBeenCalled();
  });
});

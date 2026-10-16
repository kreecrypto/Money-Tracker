import {afterEach,describe,expect,it,vi} from 'vitest';
import {GET} from '../api/iphone/health';

afterEach(()=>{
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('split Vercel project storage readiness',()=>{
  it('uses the configured API project and reports ready only on real health OK',async()=>{
    vi.stubEnv('VITE_IPHONE_BRIDGE_URL','https://money-tracker-api-blush.vercel.app');
    const upstream=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'ok',storage:'ready'}),{
      status:200,headers:{'content-type':'application/json'}
    }));
    vi.stubGlobal('fetch',upstream);
    const response=await GET(new Request('https://money-tracker-beta-teal.vercel.app/api/iphone/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({status:'ok',storage:'ready',backend:'remote'});
    expect(upstream).toHaveBeenCalledOnce();
    expect(String(upstream.mock.calls[0][0])).toBe('https://money-tracker-api-blush.vercel.app/api/iphone/health');
  });

  it('fails closed when the configured backend is unhealthy',async()=>{
    vi.stubEnv('VITE_IPHONE_BRIDGE_URL','https://money-tracker-api-blush.vercel.app');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status:'unavailable',storage:'unavailable'
    }),{status:503})));
    const response=await GET(new Request('https://money-tracker-beta-teal.vercel.app/api/iphone/health'));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('BRIDGE_UNAVAILABLE');
  });

  it('blocks self-proxy loops',async()=>{
    vi.stubEnv('VITE_IPHONE_BRIDGE_URL','https://money-tracker-beta-teal.vercel.app');
    const response=await GET(new Request('https://money-tracker-beta-teal.vercel.app/api/iphone/health'));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('BRIDGE_URL_INVALID');
  });
});

import {describe,it,expect,vi,afterEach} from 'vitest';

const mock=vi.hoisted(()=>({check:vi.fn()}));
vi.mock('../server/iphone/bridge',async importOriginal=>{
  const real=await importOriginal<typeof import('../server/iphone/bridge')>();
  return {...real,storageHealth:mock.check};
});
import {GET,POST} from '../api/iphone/health';

afterEach(()=>{vi.restoreAllMocks();mock.check.mockReset();});

describe('Production storage readiness endpoint',()=>{
  it('returns 200 only after the zero-row Supabase REST check succeeds',async()=>{
    mock.check.mockResolvedValue(undefined);
    const response=await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({status:'ok',storage:'ready'});
    expect(mock.check).toHaveBeenCalledOnce();
  });
  it('gives a safe configuration code without leaking exception text',async()=>{
    vi.spyOn(console,'error').mockImplementation(()=>{});
    mock.check.mockRejectedValue(new Error('STORAGE_NOT_CONFIGURED secret value'));
    const response=await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status:'unavailable',storage:'unavailable',code:'STORAGE_CONFIGURATION'
    });
  });
  it('identifies denied service-role requests without returning any credentials',async()=>{
    vi.spyOn(console,'error').mockImplementation(()=>{});
    mock.check.mockRejectedValue(new Error('DATABASE_ERROR_401 token secret'));
    const response=await GET();
    expect(response.status).toBe(503);
    const body=JSON.stringify(await response.json());
    expect(body).toContain('STORAGE_AUTH');
    expect(body).not.toContain('secret');
  });
  it('does not support write requests',()=>{
    expect(POST().status).toBe(405);
  });
});

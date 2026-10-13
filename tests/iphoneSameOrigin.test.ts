import {afterEach,describe,expect,it,vi} from 'vitest';
import {appCors,auth,options} from '../server/iphone/bridge';

const request=(origin?:string)=>new Request('https://money-tracker-beta-teal.vercel.app/api/iphone/ledger',{
  headers:origin?{origin}:{}
});

afterEach(()=>vi.unstubAllEnvs());

describe('Unified Vercel same-origin iPhone API',()=>{
  it('allows same-origin GET requests that omit the Origin header',()=>{
    vi.stubEnv('IPHONE_ALLOWED_APP_ORIGIN','');
    const headers=appCors(request());
    expect(headers).toMatchObject({'cache-control':'no-store'});
    expect(headers).not.toHaveProperty('access-control-allow-origin');
  });

  it('allows same-origin requests without a separate CORS configuration',()=>{
    vi.stubEnv('IPHONE_ALLOWED_APP_ORIGIN','');
    const headers=appCors(request('https://money-tracker-beta-teal.vercel.app'));
    expect(headers?.['access-control-allow-origin']).toBe('https://money-tracker-beta-teal.vercel.app');
  });

  it('preserves the explicit legacy-app CORS allowlist',()=>{
    vi.stubEnv('IPHONE_ALLOWED_APP_ORIGIN','https://old-money-tracker.example');
    const headers=appCors(request('https://old-money-tracker.example'));
    expect(headers?.['access-control-allow-origin']).toBe('https://old-money-tracker.example');
  });

  it('does not allow unlisted cross-origin browser requests',()=>{
    vi.stubEnv('IPHONE_ALLOWED_APP_ORIGIN','https://old-money-tracker.example');
    expect(appCors(request('https://attacker.example'))).toBeNull();
    expect(options(request('https://attacker.example')).status).toBe(403);
  });

  it('still requires the review token after passing the origin check',()=>{
    vi.stubEnv('IPHONE_REVIEW_TOKEN','f'.repeat(64));
    const req=request('https://money-tracker-beta-teal.vercel.app');
    expect(appCors(req)).not.toBeNull();
    expect(auth(req,'review')).toBe('unauthorized');
  });
});

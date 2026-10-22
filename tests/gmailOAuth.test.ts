import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {
  clearSessionCookie,createLogin,oauthConfig,parseCookies,randomToken,
  sameAppOrigin,seal,unseal,validateState
} from '../server/gmail/oauth';
import {GET as begin} from '../api/gmail/oauth/start';
import {GET as status,POST as disconnect} from '../api/gmail/connection';

beforeEach(()=>{
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID','test-client.apps.googleusercontent.com');
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET','synthetic-secret');
  vi.stubEnv('GMAIL_APP_ORIGIN','https://money-tracker.example');
  vi.stubEnv('GMAIL_TOKEN_ENCRYPTION_KEY','a'.repeat(64));
});
afterEach(()=>vi.unstubAllEnvs());

describe('Gmail OAuth connection security',()=>{
  it('requires every server config value and a safe fixed origin',()=>{
    expect(oauthConfig()).not.toBeNull();
    vi.stubEnv('GMAIL_TOKEN_ENCRYPTION_KEY','');
    expect(oauthConfig()).toBeNull();
    vi.stubEnv('GMAIL_TOKEN_ENCRYPTION_KEY','a'.repeat(64));
    vi.stubEnv('GMAIL_APP_ORIGIN','https://money-tracker.example/other');
    expect(oauthConfig()).toBeNull();
  });
  it('creates a PKCE S256 authorization request and one-time state cookie',()=>{
    const cfg=oauthConfig()!;
    const login=createLogin(cfg);
    const url=new URL(login.url);
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('gmail.readonly');
    expect(url.searchParams.get('redirect_uri')).toBe('https://money-tracker.example/api/gmail/oauth/callback');
    expect(login.cookie).toContain('HttpOnly');
    expect(login.cookie).toContain('SameSite=Lax');
    expect(login.cookie).toContain('Secure');
    const req=new Request('https://money-tracker.example/api/gmail/oauth/callback',
      {headers:{cookie:login.cookie.split(';')[0]}});
    expect(validateState(cfg,req,url.searchParams.get('state'))).toMatch(/^[\w-]{40,64}$/);
    expect(validateState(cfg,req,randomToken())).toBeNull();
  });
  it('rejects modified encrypted state and keeps tokens out of visible cookie values',()=>{
    const cfg=oauthConfig()!;
    const secret='example-private-refresh-token';
    const encrypted=seal(cfg,'refresh-v1',secret);
    expect(encrypted).not.toContain(secret);
    expect(unseal(cfg,'refresh-v1',encrypted)).toBe(secret);
    expect(unseal(cfg,'oauth-state-v1',encrypted)).toBeNull();
    expect(unseal(cfg,'refresh-v1',encrypted.slice(0,-2)+'Aa')).toBeNull();
    expect(clearSessionCookie(cfg)).toContain('Max-Age=0');
  });
  it('does not allow redirect through an arbitrary preview origin',()=>{
    const cfg=oauthConfig()!;
    expect(sameAppOrigin(new Request('https://money-tracker.example/api/gmail/oauth/start'),cfg)).toBe(true);
    expect(sameAppOrigin(new Request('https://preview.example/api/gmail/oauth/start'),cfg)).toBe(false);
  });
  it('does not return an authorization URL when the backend is unconfigured',async()=>{
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET','');
    expect((await begin(new Request('https://money-tracker.example/api/gmail/oauth/start'))).status).toBe(503);
    expect(await (await status(new Request('https://money-tracker.example/api/gmail/connection'))).json())
      .toMatchObject({available:false,connected:false});
  });
  it('rejects cross-origin sign-in and cross-site disconnect',async()=>{
    expect((await begin(new Request('https://untrusted.example/api/gmail/oauth/start'))).status).toBe(403);
    const request=new Request('https://money-tracker.example/api/gmail/connection',{
      method:'POST',headers:{origin:'https://other.example','content-type':'application/json'},
      body:JSON.stringify({action:'disconnect'})
    });
    expect((await disconnect(request)).status).toBe(403);
  });
  it('does not disconnect via a non-JSON form submission',async()=>{
    const request=new Request('https://money-tracker.example/api/gmail/connection',{
      method:'POST',headers:{origin:'https://money-tracker.example','content-type':'application/x-www-form-urlencoded'},
      body:'action=disconnect'
    });
    expect((await disconnect(request)).status).toBe(415);
  });
  it('only parses OAuth cookie names, never a raw token from a URL',()=>{
    const r=new Request('https://money-tracker.example/?token=foo',{headers:{cookie:'x=1; mt_gmail_session=abc; mt_gmail_oauth_state=def'}});
    expect(parseCookies(r)).toMatchObject({mt_gmail_session:'abc',mt_gmail_oauth_state:'def'});
  });
});

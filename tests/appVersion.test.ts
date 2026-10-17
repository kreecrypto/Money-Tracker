import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {APP_BUILD_SHA,APP_DISPLAY_VERSION,APP_VERSION,releaseVersionLabel,bundleFromHtml,hasNewBundle} from '../src/lib/appVersion';

describe('release version and PWA update safety',()=>{
  it('shows an app version and injected build identifier',()=>{
    const {version}=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')) as {version:string};
    expect(APP_VERSION).toBe(version);
    expect(APP_DISPLAY_VERSION).toBe(`${version}+${APP_BUILD_SHA}`);
    expect(releaseVersionLabel('0.6.1','abc12345')).toBe('0.6.1+abc12345');
    expect(APP_BUILD_SHA.length).toBeGreaterThan(0);
  });
  it('parses the current Vite bundle safely',()=>{
    expect(bundleFromHtml('<script type="module" crossorigin src="/assets/index-AbC123.js"></script>')).toBe('/assets/index-AbC123.js');
    expect(bundleFromHtml('<script src="https://other.example/unsafe.js"></script>')).toBeNull();
  });
  it('prompts only if a newer deployed JS bundle really exists',()=>{
    const current='/assets/index-OLD.js';
    expect(hasNewBundle('<script src="/assets/index-NEW.js"></script>',current)).toBe(true);
    expect(hasNewBundle('<script src="/assets/index-OLD.js"></script>',current)).toBe(false);
    expect(hasNewBundle('<html>Offline</html>',current)).toBe(false);
    expect(hasNewBundle('<script src="/assets/index-NEW.js"></script>','')).toBe(false);
  });
});

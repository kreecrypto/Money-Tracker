/** Vite replaces the constants during each deployment build. */
declare const __MONEY_BUILD_SHA__:string;
declare const __MONEY_BUILT_AT__:string;

export const APP_VERSION='0.6.0';
export const APP_BUILD_SHA=__MONEY_BUILD_SHA__;
export const APP_BUILT_AT=__MONEY_BUILT_AT__;

export function bundleFromHtml(html:string):string|null {
  return html.match(/<script\b[^>]*\bsrc=["'](\/assets\/index-[^"'?#]+\.js)["']/i)?.[1]??null;
}

/** Detect another deployed JS bundle without interrupting a running upload. */
export function hasNewBundle(html:string,currentScriptSrc:string):boolean {
  const incoming=bundleFromHtml(html);
  const current=currentScriptSrc.match(/\/assets\/index-[^"'?#]+\.js/i)?.[0]??null;
  return !!incoming&&!!current&&incoming!==current;
}

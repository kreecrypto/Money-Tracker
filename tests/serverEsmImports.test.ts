import {describe,it,expect} from 'vitest';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import {dirname,join,resolve,relative} from 'node:path';

/** Vercel Node.js ESM executes emitted .js modules, not extensionless TS specifiers. */
function walk(dir:string):string[]{
  return readdirSync(dir).flatMap(name=>{
    const file=join(dir,name);
    return statSync(file).isDirectory()?walk(file):file.endsWith('.ts')?[file]:[];
  });
}
const root=process.cwd();
const runtimeFiles=[
  ...walk(resolve(root,'api')),
  ...walk(resolve(root,'server')),
  resolve(root,'src/lib/slip.ts'),
];

describe('Vercel production ESM import graph',()=>{
  it.each(runtimeFiles)('uses resolvable .js specifiers in %s',file=>{
    const content=readFileSync(file,'utf8');
    const references=content.matchAll(/\b(?:from\s*|import\s*\(\s*)['"]((?:\.\.\/|\.\/)[^'"]+)['"]/g);
    for(const match of references){
      const specifier=match[1];
      const from=relative(root,file);
      expect(specifier.endsWith('.js'),from+': '+specifier+' must end in .js for Node ESM').toBe(true);
      const emitted=resolve(dirname(file),specifier);
      const source=emitted.replace(/\.js$/,'.ts');
      expect(
        existsSync(emitted)||existsSync(source)||existsSync(source+'x'),
        from+': '+specifier+' target source is missing'
      ).toBe(true);
    }
  });
});

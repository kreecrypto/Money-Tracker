/** Local-only, visual accessibility setting. Never transmitted with money data. */
export const READING_SIZE_KEY='ngoentoday-reading-size-v1';
export type ReadingSize='standard'|'large';

export function getReadingSize():ReadingSize {
  try { return localStorage.getItem(READING_SIZE_KEY)==='large'?'large':'standard'; }
  catch { return 'standard'; }
}

export function setReadingSize(size:ReadingSize):void {
  document.documentElement.dataset.readingSize=size;
  try { localStorage.setItem(READING_SIZE_KEY,size); } catch { /* Private browsing may disable storage. */ }
}

export function installReadingSize():void {
  document.documentElement.dataset.readingSize=getReadingSize();
}

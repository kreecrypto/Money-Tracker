import {afterEach,describe,expect,it,vi} from 'vitest';
import {withOcrDeadline,OcrDeadlineError,OCR_MODEL_TIMEOUT_MS,OCR_PASS_TIMEOUT_MS} from '../src/lib/ocrDeadline';

afterEach(()=>vi.useRealTimers());

describe('mobile OCR deadlines',()=>{
  it('caps model startup and per-image recognition at finite durations',()=>{
    expect(OCR_MODEL_TIMEOUT_MS).toBeGreaterThan(OCR_PASS_TIMEOUT_MS);
    expect(OCR_PASS_TIMEOUT_MS).toBeGreaterThan(10_000);
  });

  it('returns successful recognition without waiting for the watchdog timer',async()=>{
    vi.useFakeTimers();
    await expect(withOcrDeadline(Promise.resolve('ข้อความ'),100,'อ่านสลิป ')).resolves.toBe('ข้อความ');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shows a recoverable Thai error when a worker is stalled',async()=>{
    vi.useFakeTimers();
    const blocked=new Promise<string>(()=>{});
    const result=withOcrDeadline(blocked,100,'อ่านสลิปรอบแรก ');
    const rejected=expect(result).rejects.toBeInstanceOf(OcrDeadlineError);
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not leave timers active when Tesseract itself fails',async()=>{
    vi.useFakeTimers();
    await expect(withOcrDeadline(Promise.reject(new Error('wasm failed')),100,'โหลดระบบ '))
      .rejects.toThrow('wasm failed');
    expect(vi.getTimerCount()).toBe(0);
  });
});

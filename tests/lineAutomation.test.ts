import {describe,it,expect} from 'vitest';
import {parseLineExpense} from '../api/line/_parser';

describe('LINE automatic financial entry parser',()=>{
  it('records a daily expense from natural Thai text',()=>{
    expect(parseLineExpense('กาแฟ 65')).toEqual({ok:true,value:{
      type:'expense',amountSatang:6500,category:'อาหารและเครื่องดื่ม',
      note:'กาแฟ',method:'cash'
    }});
  });
  it('handles Thai digits and bank-transfer hints',()=>{
    const r=parseLineExpense('จ่าย ๑๒๐ ค่าแท็กซี่ โอน');
    expect(r.ok).toBe(true);
    if(r.ok)expect(r.value).toMatchObject({
      amountSatang:12000,type:'expense',category:'เดินทาง',method:'bank'
    });
  });
  it('handles explicitly named incoming money',()=>{
    const r=parseLineExpense('รับ 5,000.50 งานเสริม พร้อมเพย์');
    expect(r.ok).toBe(true);
    if(r.ok)expect(r.value).toMatchObject({
      type:'income',amountSatang:500050,category:'งานเสริม',method:'bank'
    });
  });
  it('recognizes salary as income without an explicit prefix',()=>{
    const r=parseLineExpense('เงินเดือน 55,000');
    expect(r.ok).toBe(true);
    if(r.ok)expect(r.value).toMatchObject({
      type:'income',amountSatang:5500000,category:'เงินเดือน'
    });
  });
  it('does not invent missing amounts',()=>{
    expect(parseLineExpense('กาแฟ')).toMatchObject({ok:false,reason:'no_amount'});
  });
  it('rejects more than one amount instead of guessing',()=>{
    expect(parseLineExpense('กาแฟ 65 ขนม 50')).toEqual({ok:false,reason:'multiple_amounts'});
  });
  it('rejects ambiguous income and expense classification',()=>{
    expect(parseLineExpense('รับ จ่าย 1000')).toMatchObject({ok:false,reason:'ambiguous_direction'});
  });
  it('rejects zero or malformed monetary amounts',()=>{
    expect(parseLineExpense('กาแฟ 0')).toMatchObject({ok:false,reason:'invalid_amount'});
  });
});

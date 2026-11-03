import {describe,expect,it} from 'vitest';
import {QUICK_EXPENSES,readQuickExpense,writeQuickExpense} from '../src/lib/expenseQuickCategories';
import {EXPENSE_CATEGORIES} from '../src/lib/finance';

describe('manual expense quick picks',()=>{
  it('maps quick picks into existing categories',()=>{
    expect(QUICK_EXPENSES.every(choice=>EXPENSE_CATEGORIES.some(category=>category===choice.category))).toBe(true);
    expect(QUICK_EXPENSES.find(choice=>choice.label==='เติมน้ำมัน')?.category).toBe('เดินทาง');
    expect(QUICK_EXPENSES.find(choice=>choice.label==='กาแฟ')?.category).toBe('อาหารและเครื่องดื่ม');
  });
  it('round-trips subtype and descriptive note',()=>{
    const stored=writeQuickExpense('กาแฟ','ลาเต้ไม่หวาน');
    expect(stored).toBe('หมวดย่อย: กาแฟ\nลาเต้ไม่หวาน');
    expect(readQuickExpense('อาหารและเครื่องดื่ม',stored)).toEqual({quick:'กาแฟ',note:'ลาเต้ไม่หวาน'});
  });
  it('preserves unsupported and mismatched notes unchanged',()=>{
    const legacy='หมวดย่อย: ค่าห้อง\nเลขอ้างอิง: A1';
    expect(readQuickExpense('บ้านและค่าน้ำไฟ',legacy)).toEqual({quick:'',note:legacy});
    const unmatched='หมวดย่อย: กาแฟ\nรายละเอียดอื่น';
    expect(readQuickExpense('เดินทาง',unmatched)).toEqual({quick:'',note:unmatched});
  });
  it('keeps plain notes when no subtype was selected',()=>{
    expect(writeQuickExpense('','รายละเอียดเดิม')).toBe('รายละเอียดเดิม');
  });
});

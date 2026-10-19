import {ChevronRight,CloudDownload,ShieldCheck,Type,UserRound,Wallet,Info,Plug} from 'lucide-react';
import {baht} from './lib/finance';

type Section={id:string;title:string;detail:string;icon:typeof UserRound};
export default function ReferenceSettingsIndex({ownerNames,budgetSatang}:{
  ownerNames:string[];budgetSatang:number;
}){
  const sections:Section[]=[
    {id:'settings-owner',title:'ชื่อของฉันบนสลิป',detail:ownerNames.length?ownerNames[0]:'เพิ่มชื่อเพื่อแยกเงินเข้า–ออก',icon:UserRound},
    {id:'settings-budget',title:'งบประมาณรายเดือน',detail:budgetSatang>0?'฿'+baht(budgetSatang):'ยังไม่ตั้งงบ',icon:Wallet},
    {id:'settings-reading',title:'ขนาดตัวอักษร',detail:'เลือกขนาดที่อ่านสบายตา',icon:Type},
    {id:'settings-data',title:'จัดการข้อมูล',detail:'สำรอง / นำเข้า / ส่งออก',icon:CloudDownload},
    {id:'settings-privacy',title:'ข้อมูลและความเป็นส่วนตัว',detail:'วิธีจัดเก็บข้อมูลบนอุปกรณ์',icon:ShieldCheck},
    {id:'settings-connections',title:'การเชื่อมต่อเพิ่มเติม',detail:'iPhone และ LINE',icon:Plug},
    {id:'settings-about',title:'เกี่ยวกับแอป',detail:'เวอร์ชันและข้อมูลระบบ',icon:Info},
  ];
  return <nav className="reference-settings-index" aria-label="หัวข้อการตั้งค่า">
    {sections.map(({id,title,detail,icon:Icon})=><a key={id} href={'#'+id} className="reference-settings-link">
      <span className="reference-settings-symbol" aria-hidden="true"><Icon size={22} strokeWidth={1.9}/></span>
      <span className="reference-settings-label"><strong>{title}</strong><small>{detail}</small></span>
      <ChevronRight size={18} strokeWidth={2} aria-hidden="true"/>
    </a>)}
  </nav>;
}

# เงินวันนี้ — Money Tracker

แอปบันทึกรายรับ–รายจ่ายประจำวัน (Thai-language, offline-first web app)

## MVP
- บันทึก แก้ไข ลบ รายรับและรายจ่าย
- รายงานสรุปรายเดือน / หมวดหมู่
- งบประมาณรายเดือนและสถานะการใช้เงิน
- ค้นหา กรอง และส่งออก JSON/CSV
- ใช้งานบนมือถือ และรองรับ PWA

**Privacy:** จัดเก็บข้อมูลในเบราว์เซอร์ของอุปกรณ์ผ่าน IndexedDB เท่านั้น ยังไม่เชื่อมบัญชีธนาคารหรือซิงก์ข้ามเครื่อง ข้อมูลอาจสูญหายหากล้างข้อมูลเว็บไซต์ จึงควรสำรองไฟล์ JSON เป็นประจำ

Stack: React · TypeScript · Vite

## Running locally

```bash
npm install
npm run dev
npm test
npm run build
```

> Work in progress — see docs and CI results before production use.

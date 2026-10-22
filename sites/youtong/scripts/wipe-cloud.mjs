// 管理員：示範前清空雲端資料（events、needs、owners、proof、last）。不是網頁按鈕；需要服務帳戶權限（繞過規則）。
// 用法：GOOGLE_APPLICATION_CREDENTIALS=服務帳戶.json DB_URL=https://<專案>-default-rtdb.asia-southeast1.firebasedatabase.app node scripts/wipe-cloud.mjs --yes
// 模擬器：FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000 DB_URL='http://127.0.0.1:9000?ns=demo-youtong-default-rtdb' node scripts/wipe-cloud.mjs --yes
import admin from 'firebase-admin';
const url=process.env.DB_URL;if(!url||!process.argv.includes('--yes')){console.error('需要 DB_URL 和 --yes');process.exit(2)}
admin.initializeApp({databaseURL:url,...(process.env.FIREBASE_DATABASE_EMULATOR_HOST?{projectId:'demo-youtong'}:{credential:admin.credential.applicationDefault()})});
const db=admin.database(),N=['events','needs','owners','proof','last'];
const cnt=async n=>(await db.ref(n).get()).numChildren();
console.log('清空前',Object.fromEntries(await Promise.all(N.map(async n=>[n,await cnt(n)]))));
await db.ref().update({...Object.fromEntries(N.map(n=>[n,null])),'meta/epoch':admin.database.ServerValue.TIMESTAMP}); // epoch 改變 → 各頁自動清掉本機資料與待上傳佇列
console.log('已清空',N.join('、'));process.exit(0);

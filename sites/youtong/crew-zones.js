// 清潔隊路線分區（A/B/C）：示範區桶位依地理位置做「容量平衡 k-means」（每區最多 ceil(n/3)+3 桶，避免為了平均把相鄰桶拆開），結果確定性（同資料同分區）。
// 分區名稱依區中心由南到北排 A→B→C。只用來分工，不代表派工或垃圾量。
function crewZones(P,K=3){if(!P.length)return{};const la0=P.reduce((s,b)=>s+b.la,0)/P.length,kx=111320*Math.cos(la0*Math.PI/180),ky=110540;
  const X=P.map(b=>[b.lo*kx,b.la*ky]),d2=(a,c)=>(a[0]-c[0])**2+(a[1]-c[1])**2,cap=Math.ceil(P.length/K)+3;
  let C=[X.reduce((m,x)=>x[1]<m[1]?x:m)];while(C.length<K){let bi=0,bd=-1;X.forEach((x,i)=>{const d=Math.min(...C.map(c=>d2(x,c)));if(d>bd){bd=d;bi=i}});C.push(X[bi])}
  let as=[];for(let it=0;it<30;it++){const pr=[];X.forEach((x,i)=>C.forEach((c,k)=>pr.push([d2(x,c),i,k])));pr.sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2]);
    const a=new Array(X.length).fill(-1),n=new Array(K).fill(0);for(const[,i,k]of pr)if(a[i]<0&&n[k]<cap){a[i]=k;n[k]++}
    const C2=C.map((c,k)=>{const m=X.filter((_,i)=>a[i]===k);return m.length?[m.reduce((s,x)=>s+x[0],0)/m.length,m.reduce((s,x)=>s+x[1],0)/m.length]:c});
    const same=as.length&&a.every((v,i)=>v===as[i]);as=a;C=C2;if(same)break}
  const ord=C.map((c,k)=>[c[1],k]).sort((x,y)=>x[0]-y[0]).map(x=>x[1]),name={};ord.forEach((k,j)=>name[k]='ABC'[j]);
  const out={};P.forEach((b,i)=>out[b.id]=name[as[i]]);return out}
if(typeof module!=='undefined')module.exports={crewZones};

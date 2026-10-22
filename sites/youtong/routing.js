// ===== 有桶・離線路網路徑（OSM 預先下載，前端 Dijkstra；展示時不呼叫任何路徑 API）=====
// 依賴：hav（common.js）。RT.load('walk'|'drive') → Promise；RT.dist / RT.from / RT.path
const RT={g:{},WALK_M_PER_MIN:75,SNAP_MAX_M:150};
RT.load=kind=>RT.g[kind]?Promise.resolve(RT.g[kind]):fetch(`roads_${kind}.json`).then(r=>r.json()).then(j=>{
  let nodes=j.nodes,E=null;
  if(j.fmt==='delta1e5'){nodes=[];let la=0,lo=0;for(let i=0;i<j.n.length;i+=2){la+=j.n[i];lo+=j.n[i+1];nodes.push([la/1e5,lo/1e5])}
    const m=j.e.length/3,A=new Int32Array(m),B=new Int32Array(m),Lr=new Float32Array(m);let a=0;
    for(let k=0;k<m;k++){a+=j.e[3*k];A[k]=a;B[k]=a+j.e[3*k+1];Lr[k]=j.e[3*k+2]}E={A,B,L:Lr,m}}
  const n=nodes.length,adj=Array.from({length:n},()=>[]);
  if(E)for(let k=0;k<E.m;k++){adj[E.A[k]].push(E.B[k],E.L[k]);adj[E.B[k]].push(E.A[k],E.L[k])}
  else j.adj.forEach((es,a)=>es.forEach(([b,l])=>{adj[a].push(b,l);if(j.undirected)adj[b].push(a,l)}));
  const grid=new Map(),cell=0.002,key=(la,lo)=>Math.floor(la/cell)+','+Math.floor(lo/cell);
  nodes.forEach(([la,lo],i)=>{const k=key(la,lo);(grid.get(k)||grid.set(k,[]).get(k)).push(i)});
  // 邊格網（步行路網：點投影到最近路段，而非最近路口）
  let egrid=null;if(E){egrid=new Map();for(let k=0;k<E.m;k++){const p=nodes[E.A[k]],q=nodes[E.B[k]];
    for(let ci=Math.floor(Math.min(p[0],q[0])/cell);ci<=Math.floor(Math.max(p[0],q[0])/cell);ci++)for(let cj=Math.floor(Math.min(p[1],q[1])/cell);cj<=Math.floor(Math.max(p[1],q[1])/cell);cj++){const kk=ci+','+cj;(egrid.get(kk)||egrid.set(kk,[]).get(kk)).push(k)}}}
  const g={kind,nodes,adj,E,egrid,geom:j.geom||{},grid,cell,key,bbox:j.bbox,date:j.date,cache:new Map(),snapC:new Map(),esnapC:new Map(),fields:new WeakMap()};return RT.g[kind]=g});
// 點→最近路段投影：{k 邊, a, b, ta 沿邊到 a 的距離, L, off 垂直偏移 m}；超過 SNAP_MAX_M → null
RT.snapE=(g,la,lo)=>{if(!g.E)return null;const ck=la.toFixed(6)+','+lo.toFixed(6);if(g.esnapC.has(ck))return g.esnapC.get(ck);
  const ci=Math.floor(la/g.cell),cj=Math.floor(lo/g.cell),kx=111320*Math.cos(la*Math.PI/180),ky=110574;let best=null,bd=1e9;const seen=new Set();
  for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++)for(const k of g.egrid.get((ci+di)+','+(cj+dj))||[]){if(seen.has(k))continue;seen.add(k);
    const p=g.nodes[g.E.A[k]],q=g.nodes[g.E.B[k]],px=(p[1]-lo)*kx,py=(p[0]-la)*ky,qx=(q[1]-lo)*kx,qy=(q[0]-la)*ky,dx=qx-px,dy=qy-py,l2=dx*dx+dy*dy;
    let t=l2?-(px*dx+py*dy)/l2:0;t=Math.max(0,Math.min(1,t));const x=px+t*dx,y=py+t*dy,d=Math.hypot(x,y);if(d<bd){bd=d;best={k,a:g.E.A[k],b:g.E.B[k],t,L:g.E.L[k]}}}
  const r=best&&bd<=RT.SNAP_MAX_M?{...best,ta:best.t*best.L,off:bd}:null;g.esnapC.set(ck,r);return r};
// 多源 Dijkstra：每個路網節點到最近一個 bin 的步行距離與是哪個 bin（依 bins 陣列快取）
RT.field=(g,bins)=>{if(g.fields.has(bins))return g.fields.get(bins);const n=g.nodes.length,dist=new Float64Array(n).fill(Infinity),lab=new Int32Array(n).fill(-1),H=[],onEdge=new Map();
  const push=x=>{H.push(x);let i=H.length-1;while(i){const p=(i-1)>>1;if(H[p][0]<=H[i][0])break;[H[p],H[i]]=[H[i],H[p]];i=p}};
  const pop=()=>{const t=H[0],l=H.pop();if(H.length){H[0]=l;let i=0;for(;;){const a=2*i+1,b=a+1;let m=i;if(a<H.length&&H[a][0]<H[m][0])m=a;if(b<H.length&&H[b][0]<H[m][0])m=b;if(m===i)break;[H[m],H[i]]=[H[i],H[m]];i=m}}return t};
  const seed=(v,d,i)=>{if(d<dist[v]){dist[v]=d;lab[v]=i;push([d,v])}};
  bins.forEach((b,i)=>{const s=RT.snapE(g,b.la,b.lo);if(!s)return;(onEdge.get(s.k)||onEdge.set(s.k,[]).get(s.k)).push([i,s]);seed(s.a,s.off+s.ta,i);seed(s.b,s.off+s.L-s.ta,i)});
  while(H.length){const[d,u]=pop();if(d>dist[u])continue;const A=g.adj[u];for(let k=0;k<A.length;k+=2){const v=A[k],nd=d+A[k+1];if(nd<dist[v]){dist[v]=nd;lab[v]=lab[u];push([nd,v])}}}
  const r={dist,lab,onEdge};g.fields.set(bins,r);return r};
// 點到 bins 中最近者的步行距離 → [m, bin] 或 null（點無法對應路網）
RT.nearestWalk=(g,p,bins)=>{const s=RT.snapE(g,p.la,p.lo);if(!s)return null;const F=RT.field(g,bins);let m=Infinity,bi=-1;
  const c=(d,i)=>{if(i>=0&&d<m){m=d;bi=i}};c(F.dist[s.a]+s.ta,F.lab[s.a]);c(F.dist[s.b]+s.L-s.ta,F.lab[s.b]);
  for(const[i,t]of F.onEdge.get(s.k)||[])c(Math.abs(t.ta-s.ta)+t.off,i);return bi<0?null:[m+s.off,bins[bi]]};
// 最近節點（格網搜尋）→ [node, 直線偏移 m]；超過 SNAP_MAX_M 或在路網範圍外 → null
RT.snap=(g,la,lo)=>{const ck=la.toFixed(6)+','+lo.toFixed(6);if(g.snapC.has(ck))return g.snapC.get(ck);let best=null,bd=1e9;
  const[w,s,e,n]=g.bbox;if(lo>=w&&lo<=e&&la>=s&&la<=n){const ci=Math.floor(la/g.cell),cj=Math.floor(lo/g.cell);
    for(let di=-1;di<=1;di++)for(let dj=-1;dj<=1;dj++)for(const i of g.grid.get((ci+di)+','+(cj+dj))||[]){const d=hav(la,lo,g.nodes[i][0],g.nodes[i][1]);if(d<bd){bd=d;best=i}}}
  const r=best!=null&&bd<=RT.SNAP_MAX_M?[best,bd]:null;g.snapC.set(ck,r);return r};
// 單源 Dijkstra（二元堆積），結果快取；limit=最大搜尋距離 m
RT.from=(g,src,limit=1e9)=>{const ck=src+'|'+limit;if(g.cache.has(ck))return g.cache.get(ck);
  const n=g.nodes.length,dist=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),H=[];dist[src]=0;H.push([0,src]);
  const push=x=>{H.push(x);let i=H.length-1;while(i){const p=(i-1)>>1;if(H[p][0]<=H[i][0])break;[H[p],H[i]]=[H[i],H[p]];i=p}};
  const pop=()=>{const t=H[0],l=H.pop();if(H.length){H[0]=l;let i=0;for(;;){const a=2*i+1,b=a+1;let m=i;if(a<H.length&&H[a][0]<H[m][0])m=a;if(b<H.length&&H[b][0]<H[m][0])m=b;if(m===i)break;[H[m],H[i]]=[H[i],H[m]];i=m}}return t};
  while(H.length){const[d,u]=pop();if(d>dist[u])continue;if(d>limit)break;const A=g.adj[u];for(let k=0;k<A.length;k+=2){const v=A[k],nd=d+A[k+1];if(nd<dist[v]){dist[v]=nd;prev[v]=u;push([nd,v])}}}
  const r={dist,prev};g.cache.set(ck,r);return r};
// 兩點路網距離（含兩端直線接駁）；任一端不在路網 → null
RT.dist=(g,a,b,limit=1e9)=>{if(g.E){const sa=RT.snapE(g,a[0],a[1]),sb=RT.snapE(g,b[0],b[1]);if(!sa||!sb)return null;
    const ck='p'+sa.k+','+sa.ta.toFixed(1)+'|'+limit;let D=g.cache.get(ck);
    if(!D){const n=g.nodes.length;D=new Float64Array(n).fill(Infinity);const H=[];
      const push=x=>{H.push(x);let i=H.length-1;while(i){const p=(i-1)>>1;if(H[p][0]<=H[i][0])break;[H[p],H[i]]=[H[i],H[p]];i=p}};
      const pop=()=>{const t=H[0],l=H.pop();if(H.length){H[0]=l;let i=0;for(;;){const x=2*i+1,y=x+1;let m=i;if(x<H.length&&H[x][0]<H[m][0])m=x;if(y<H.length&&H[y][0]<H[m][0])m=y;if(m===i)break;[H[m],H[i]]=[H[i],H[m]];i=m}}return t};
      D[sa.a]=sa.ta;push([sa.ta,sa.a]);if(sa.L-sa.ta<D[sa.b]){D[sa.b]=sa.L-sa.ta;push([D[sa.b],sa.b])}
      while(H.length){const[d,u]=pop();if(d>D[u])continue;if(d>limit)break;const A=g.adj[u];for(let k=0;k<A.length;k+=2){const v=A[k],nd=d+A[k+1];if(nd<D[v]){D[v]=nd;push([nd,v])}}}
      if(g.cache.size>50)g.cache.clear();g.cache.set(ck,D)}
    let d=Math.min(D[sb.a]+sb.ta,D[sb.b]+sb.L-sb.ta);if(sa.k===sb.k)d=Math.min(d,Math.abs(sa.ta-sb.ta));return isFinite(d)?d+sa.off+sb.off:null}
  const sa=RT.snap(g,a[0],a[1]),sb=RT.snap(g,b[0],b[1]);if(!sa||!sb)return null;const d=RT.from(g,sa[0],limit).dist[sb[0]];return isFinite(d)?d+sa[1]+sb[1]:null};
// 路徑座標（含路段幾何）
RT.path=(g,a,b)=>{const sa=RT.snap(g,a[0],a[1]),sb=RT.snap(g,b[0],b[1]);if(!sa||!sb)return[a,b];const{prev,dist}=RT.from(g,sa[0]);if(!isFinite(dist[sb[0]]))return[a,b];
  const ns=[];for(let v=sb[0];v!==-1;v=prev[v])ns.push(v);ns.reverse();const out=[a];
  ns.forEach((v,i)=>{if(i){const gm=g.geom[ns[i-1]+','+v];if(gm)out.push(...gm)}out.push(g.nodes[v])});out.push(b);return out};
// 路徑座標（與 RT.dist 同一套「投影到最近路段」）：起點＝a（使用者位置）→ 投影點 → 節點序列 → 目標的投影點 → b（目標）
// 回傳 {pts,d} 或 null（任一端無法對應路網）；pts[0] 必為 a、最後一點必為 b
RT.pathE=(g,a,b)=>{if(!g.E){const p=RT.path(g,a,b);return p.length>2?{pts:p,d:null}:null}
  const sa=RT.snapE(g,a[0],a[1]),sb=RT.snapE(g,b[0],b[1]);if(!sa||!sb)return null;
  const N=g.nodes,proj=s=>{const p=N[s.a],q=N[s.b];return[p[0]+(q[0]-p[0])*s.t,p[1]+(q[1]-p[1])*s.t]},pa=proj(sa),pb=proj(sb);
  let best=Infinity,end=null;if(sa.k===sb.k){best=Math.abs(sa.ta-sb.ta);end='same'}
  const n=N.length,D=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),H=[];
  const push=x=>{H.push(x);let i=H.length-1;while(i){const p=(i-1)>>1;if(H[p][0]<=H[i][0])break;[H[p],H[i]]=[H[i],H[p]];i=p}};
  const pop=()=>{const t=H[0],l=H.pop();if(H.length){H[0]=l;let i=0;for(;;){const x=2*i+1,y=x+1;let m=i;if(x<H.length&&H[x][0]<H[m][0])m=x;if(y<H.length&&H[y][0]<H[m][0])m=y;if(m===i)break;[H[m],H[i]]=[H[i],H[m]];i=m}}return t};
  D[sa.a]=sa.ta;push([sa.ta,sa.a]);if(sa.L-sa.ta<D[sa.b]){D[sa.b]=sa.L-sa.ta;push([D[sa.b],sa.b])}
  while(H.length){const[d,u]=pop();if(d>D[u])continue;if(d>best)break;const A=g.adj[u];for(let k=0;k<A.length;k+=2){const v=A[k],nd=d+A[k+1];if(nd<D[v]){D[v]=nd;prev[v]=u;push([nd,v])}}}
  const ca=D[sb.a]+sb.ta,cb=D[sb.b]+sb.L-sb.ta;if(ca<best){best=ca;end=sb.a}if(cb<best){best=cb;end=sb.b}
  if(!isFinite(best))return null;const pts=[a,pa];
  if(end!=='same'){const ns=[];for(let v=end;v!==-1;v=prev[v])ns.push(v);ns.reverse();for(const v of ns)pts.push(N[v])} // prev 從起點邊的兩端開始，重建時順序＝使用者 → 目標
  pts.push(pb,b);return{pts,d:best+sa.off+sb.off}};
RT.walkMin=m=>Math.max(1,Math.round(m/RT.WALK_M_PER_MIN));

// ===== 有桶・垃圾桶標記：單一垃圾桶（無外框、平面幾何；正面桶身＋桶蓋＋地面陰影）=====
// 依賴：rampColor（ui.js）
// 滿度＝桶身內水位（tokens 色階），任何縮放都顯示；空的部分＝淺中性灰；桶蓋＝中性。
// state：'reported'（行人回報滿了、尚未清運）→ 整個桶實心紅；'overflow' 不是地圖狀態：只用於收運量「溢出」按鈕（滿桶＋桶蓋溢出點）。
// 4 色：綠/黃/深橘/紅。桶身全填色：水位＝實色、上方空的部分＝同色淺 tint（約 40%）、桶蓋＝同色深 shade；回報＝整桶實心紅。
const BIN_TONES={'#8cc9a8':{tint:'#d1e9dc',shade:'#628d76'},'#e8b931':{tint:'#f6e3ad',shade:'#a78523'},'#d9731f':{tint:'#f0c7a5',shade:'#9c5316'},'#e2574c':{tint:'#f3bcb7',shade:'#a33f37'}};
const BIN_REPORTED=REPORTED,BIN_OVER=RAMP.high;
const BIN_BODY='M2 8.5H20L18.6 27Q18.4 29 16.4 29H5.6Q3.6 29 3.4 27Z';
const BIN_POP='filter:drop-shadow(0 0 .8px #fff) drop-shadow(0 0 .8px #fff) drop-shadow(0 0 .6px #fff)'; // 白色分離邊（無外框線）
let _binUid=0;
function binGlyph(fill,state){ // 局部座標 22×29
  if(state==='overflow')fill=100;
  const rep=state==='reported',c=rep?BIN_REPORTED:rampColor(fill),t=BIN_TONES[c]||{tint:'#eee',shade:c};
  let body;
  if(rep)body=`<path d="${BIN_BODY}" fill="${c}"/><rect x="7" y="13.4" width="8" height="2.4" rx="1.2" fill="#ffffffcc"/>`;
  else{const f=Math.max(0,Math.min(100,fill)),id='bc'+(++_binUid),h=(20.5*Math.max(8,f)/100).toFixed(1);
    body=`<path d="${BIN_BODY}" fill="${t.tint}"/><clipPath id="${id}"><path d="${BIN_BODY}"/></clipPath><rect x="0" y="${(29-h).toFixed(1)}" width="22" height="${h}" fill="${c}" clip-path="url(#${id})"/>`}
  const lid=rep?t.shade:t.shade;
  return `<rect x="8" y="0.6" width="6" height="3.6" rx="1.6" fill="${lid}"/><rect x="0" y="3" width="22" height="5.2" rx="2.4" fill="${lid}"/>${body}`+(state==='overflow'?`<circle cx="4.5" cy="2" r="2.4" fill="${RAMP.high}"/><circle cx="17.6" cy="1.5" r="1.8" fill="${RAMP.high}"/>`:'');
}
// 回傳 {html,w,h}；28×34，錨點＝陰影中心 (14,31.4)
function binIconSVG(fill=0,state){const w=28;
  return{w,h:34,html:`<svg width="${w}" height="34" viewBox="0 0 ${w} 34" aria-hidden="true" style="overflow:visible"><ellipse cx="14" cy="31.4" rx="10" ry="2.3" fill="#000" opacity=".13"/><g transform="translate(3 1.8)" style="${BIN_POP}">${binGlyph(fill,state)}</g></svg>`}}
// Leaflet divIcon。near＝最近的桶：放大＋淡光圈；small＝低縮放時縮小以減少雜亂
function binDivIcon(fill,near,state,small){const{w,h,html}=binIconSVG(fill,state),k=near?1.2:small?.78:1;
  return L.divIcon({className:'binmk'+(near?' near':''),iconSize:[w*k,h*k],iconAnchor:[w*k/2,31.4*k],
    html:`<div class="w" style="width:${w}px;transform:scale(${k});transform-origin:0 0">${near?'<span class="halo"></span>':''}${html}</div>`})}
// 行人回報滿了且之後沒有清運 → 'reported'
function binState(id,ev){let s=null;for(const e of (typeof binEvents==='function'?binEvents(id,ev):ev.filter(e=>e.bin===id))){if(e.kind==='full')s='reported';else if(e.kind==='clear')s=null}return s} // 清運後，比清運早的回報不算（common.js binEvents）
const _sm=h=>h.replace('width="28" height="34"','width="14" height="17"');
const BIN_LEGEND=()=>[{html:_sm(binIconSVG(40).html),t:STATE_LABEL.low},{html:_sm(binIconSVG(85).html),t:STATE_LABEL.mid},{html:_sm(binIconSVG(100).html),t:STATE_LABEL.high+'（估計）'},{html:_sm(binIconSVG(0,'reported').html),t:STATE_LABEL.reported+'（有人回報、尚未清運）'}];

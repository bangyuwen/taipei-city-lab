export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function format(value) {
  if (typeof value !== 'number') return escapeHTML(value);
  return Number.isFinite(value) ? new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(value) : '無法估算';
}
const colors=['#2e8060','#c69c52','#759cae','#a96455','#7d70a2'];
const finite = v => typeof v === 'number' && Number.isFinite(v);
const isSelected = p => p.selected===true||['selected','new','recommended','recommend','chosen'].includes(p.kind);
export function mapSVG(map, bbox) {
  const points=(map.points||[]).filter(p=>p&&finite(p.x)&&finite(p.y));
  const validLines=(map.lines||[]).map(l=>({...l,points:(l.points||[]).filter(p=>p&&finite(p.x)&&finite(p.y))}));
  const all=points.concat(validLines.flatMap(l=>l.points));
  let bounds=Array.isArray(bbox)&&bbox.length===4&&bbox.every(finite)&&bbox[0]<bbox[2]&&bbox[1]<bbox[3]?bbox:null;
  if(!bounds) {
    bounds=all.length?[Math.min(...all.map(p=>p.x)),Math.min(...all.map(p=>p.y)),Math.max(...all.map(p=>p.x)),Math.max(...all.map(p=>p.y))]:[0,0,1,1];
  }
  const [xmin,ymin,xmax,ymax]=bounds;
  const sx=x=>45+(x-xmin)/Math.max(xmax-xmin,0.00001)*670;
  const sy=y=>440-(y-ymin)/Math.max(ymax-ymin,0.00001)*390;
  const shown=points.filter((p,i)=>i%Math.max(1,Math.ceil(points.length/900))===0||isSelected(p)).sort((a,b)=>Number(isSelected(a))-Number(isSelected(b)));
  const grid=Array.from({length:6},(_,i)=>{const x=45+i*134,y=50+i*78;return `<path d="M${x} 50V440 M45 ${y}H715"/><text x="${x}" y="464">${(xmin+(xmax-xmin)*i/5).toFixed(3)}°</text><text x="12" y="${y+4}">${(ymax-(ymax-ymin)*i/5).toFixed(3)}</text>`;}).join('');
  const lines=validLines.map((l,i)=>`<polyline fill="none" stroke="${escapeHTML(l.color||colors[i%colors.length])}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" points="${l.points.map(p=>`${sx(p.x)},${sy(p.y)}`).join(' ')}"><title>${escapeHTML(l.label)}</title></polyline>`).join('');
  const dots=shown.map(p=>{const selected=isSelected(p),demand=p.kind==='demand',candidate=p.kind==='candidate';const r=selected?7.5:demand?3:candidate?4:2.8;const color=selected?'#e8ab4a':demand?'#99a9b2':candidate?'#eef2e9':'#39835f';return `<circle cx="${sx(p.x).toFixed(2)}" cy="${sy(p.y).toFixed(2)}" r="${r}" fill="${color}" opacity="${selected||candidate?1:.58}" ${selected?'stroke="#fff" stroke-width="2"':candidate?'stroke="#39835f" stroke-width="1.5"':''} data-point-id="${escapeHTML(p.id)}" tabindex="0" role="button" aria-label="${escapeHTML(p.label||p.id)}"><title>${escapeHTML(p.label||p.id)}${p.value!==undefined?' · '+escapeHTML(p.value):''}</title></circle>`;}).join('');
  const count=shown.length<points.length?`圖上顯示 ${shown.length} / ${points.length} 點；計算使用完整情境資料。`:'';
  return `<div class="map-toolbar"><span><i class="legend-dot green"></i>既有點位</span><span><i class="legend-dot" style="background:#99a9b2"></i>合成需求</span><span><i class="legend-dot" style="border:1.5px solid #39835f;background:#eef2e9"></i>合成候選</span><span><i class="legend-dot gold"></i>本方案優先位置</span><span>北 ↑</span></div><svg class="geo-map" viewBox="0 0 760 485" role="img" aria-label="配置座標圖"><rect x="0" y="0" width="760" height="485" fill="#eef2e9"/><g class="map-grid">${grid}</g>${lines}${dots}<text x="700" y="25" class="north">N ↑</text></svg><div class="point-tooltip" role="status" hidden></div><div class="map-caption">${escapeHTML(map.caption||'座標圖以經緯度定位；網格為座標參考，未代表道路。')} ${escapeHTML(count)}</div>`;
}
export function chartSVG(chart,viewWidth=760) {
  const labels=chart.labels||[];
  const series=(chart.series||[]).map(s=>({...s,values:(s.values||[]).map(v=>finite(v)?v:null)}));
  const values=series.flatMap(s=>s.values).filter(v=>v!==null);
  if(!values.length)return '<div class="empty-state">這個情境沒有可繪製的資料。</div>';
  const max=Math.max(...values,1),min=Math.min(...values,0),span=max-min||1;
  const bars=chart.type==='bar',n=Math.max(labels.length,...series.map(s=>s.values.length),bars?1:2);
  const canvasWidth=finite(viewWidth)?Math.max(240,Math.min(760,Math.round(viewWidth))):760;
  const tickValues=Array.from({length:5},(_,i)=>min+span*i/4);
  const labelMargin=label=>Array.from(String(label||'')).reduce((sum,c)=>sum+(c.codePointAt(0)>=0x2e80?14:8),0)/2+8;
  const left=Math.max(52,...tickValues.map(v=>format(v).length*8+12),bars?0:labelMargin(labels[0]));
  const right=bars?24:Math.max(24,labelMargin(labels.at(-1))),plotWidth=canvasWidth-left-right;
  const sx=i=>left+(bars?(i+.5)/n:i/(n-1))*plotWidth,sy=v=>240-(v-min)/span*208;
  const ticks=tickValues.map(v=>{const y=sy(v);return `<line x1="${left}" x2="${canvasWidth-right}" y1="${y}" y2="${y}"/><text x="${left-10}" y="${y+5}" text-anchor="end">${format(v)}</text>`;}).join('');
  const labelCount=Math.max(2,Math.min(7,Math.floor(plotWidth/68)));
  const lineLabels=new Set(Array.from({length:labelCount},(_,i)=>Math.round(i*(labels.length-1)/(labelCount-1))));
  const xlabels=labels.map((label,i)=>{
    if(!bars&&!lineLabels.has(i))return '';
    const text=String(label),chars=Array.from(text),limit=bars?Math.max(2,Math.floor(plotWidth/n/14)):chars.length||1;
    const rows=[];for(let start=0;start<chars.length;start+=limit)rows.push(chars.slice(start,start+limit).join(''));
    const visible=rows.slice(0,3);if(rows.length>3)visible[2]+='…';
    return `<text x="${sx(i)}" y="262" text-anchor="middle"><title>${escapeHTML(text)}</title>${visible.map((row,j)=>`<tspan x="${sx(i)}" dy="${j?17:0}">${escapeHTML(row)}</tspan>`).join('')}</text>`;
  }).join('');
  const lines=series.map((s,i)=>{const color=s.color||colors[i%colors.length];let path='',open=false;for(let j=0;j<s.values.length;j++){const v=s.values[j];if(v===null){open=false;continue;}path+=`${open?'L':'M'}${sx(j).toFixed(1)},${sy(v).toFixed(1)} `;open=true;}return `<path d="${path}" stroke="${escapeHTML(color)}" fill="none" stroke-width="3" stroke-linejoin="round"/><g>${s.values.map((v,j)=>v===null?'':`<circle cx="${sx(j)}" cy="${sy(v)}" r="3" fill="${escapeHTML(color)}"><title>${escapeHTML(s.label)} · ${escapeHTML(labels[j]||j)}：${v}${escapeHTML(chart.unit||'')}</title></circle>`).join('')}</g>`;}).join('');
  const width=Math.min(42,plotWidth/n*.7/Math.max(series.length,1));
  const rectangles=bars?series.map((s,i)=>s.values.map((v,j)=>v===null?'':`<rect x="${sx(j)+(i-series.length/2)*width+1}" y="${Math.min(sy(v),sy(0))}" width="${Math.max(1,width-2)}" height="${Math.abs(sy(v)-sy(0))}" fill="${escapeHTML(s.color||colors[i%colors.length])}"><title>${escapeHTML(s.label)} · ${escapeHTML(labels[j]||j)}：${v}${escapeHTML(chart.unit||'')}</title></rect>`).join('')).join(''):'';
  return `<div class="chart-legend">${series.map((s,i)=>`<span><i style="background:${escapeHTML(s.color||colors[i%colors.length])}"></i>${escapeHTML(s.label)}</span>`).join('')}<span class="chart-unit">${escapeHTML(chart.unit||'')}</span></div><svg class="chart-svg" viewBox="0 0 ${canvasWidth} 300" role="img" aria-label="${escapeHTML(series.map(s=>s.label).join('、'))}"><g class="chart-grid">${ticks}${xlabels}</g>${bars?rectangles:lines}</svg><p class="chart-caption">${escapeHTML(chart.caption||'相同參數下的基準與方案比較。')}</p>`;
}
export function tableHTML(table) {
  if(!table?.rows?.length)return '<div class="empty-state">目前沒有符合條件的項目。調整方案或檢查資料範圍。</div>';
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="資料明細（可捲動）"><table><thead><tr>${table.columns.map(c=>`<th scope="col">${escapeHTML(c.label)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((r,i)=>`<tr data-row="${i}">${table.columns.map(c=>`<td>${format(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// Absolute bins stay fixed across filters; null means no matched observation.
export function activityStyle(events,zoom=12) {
  // Small overview marks separate nearby stations; street views allow easier targeting.
  const maxRadius=Math.min(6,Math.max(2,2+(zoom-11)*.75));
  if(events===null)return {radius:Math.max(1.25,maxRadius/2),color:'#435b66',fillColor:'#ffffff',fillOpacity:1,weight:.7};
  return {radius:Math.max(1,maxRadius*Math.sqrt(Math.min(events,100000)/100000)),color:'#663711',
    fillColor:events>=30000?'#963b13':events>=10000?'#ca792e':'#e9bb65',fillOpacity:.75,weight:.4};
}
export function selectActivityStations(stations,{area='',query=''}={}) {
  const term=query.trim().toLocaleLowerCase('zh-TW');
  return stations.filter(s=>(!area||s.area===area)&&(!term||[s.name,s.address,s.id].some(v=>v.toLocaleLowerCase('zh-TW').includes(term))))
    .sort((a,b)=>(b.events??-1)-(a.events??-1)||a.id.localeCompare(b.id));
}
export function activitySummary(stations) {
  return {count:stations.length,observed:stations.filter(s=>s.events!==null).length,
    unknown:stations.filter(s=>s.events===null).length,events:stations.reduce((sum,s)=>sum+(s.events??0),0)};
}

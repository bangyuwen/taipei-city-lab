import {sceneSpec} from './scene-data.js';
export function mapSpec(payload){
  if(payload.result.map){
    const scene=sceneSpec(payload),convert=p=>({...p,lat:p.latitude,lng:p.longitude,
      provenance:p.kind==='existing'?'真實觀測快照':'合成情境；未現勘'});
    const existing=scene.existing.map(convert),demand=scene.demand.map(convert),points=scene.points.map(convert);
    const selected=points.filter(p=>p.selected);
    return {id:payload.id,bbox:scene.project.bbox,kind:'spatial',existing,demand,candidates:points.filter(p=>!p.selected),selected,
      focus:selected.concat(points.filter(p=>!p.selected)),radius:scene.radius/scene.project.scale,newRadius:scene.newRadius/scene.project.scale,
      note:['shade','bins'].includes(payload.id)
        ? scene.note+' 既有點位是真實快照；需求與候選均為合成，地圖上的圓不是步行等時圈。'
        : '底圖是真實街道，但所有街廓／社區點位、指數與安排都是合成情境，不代表這些真實地址的鼠患或建物安全。'};
  }
  if(['traffic','bus'].includes(payload.id))return {id:payload.id,kind:'reference',bbox:[121.55,25.035,121.62,25.10],existing:[],demand:[],candidates:[],selected:[],focus:[],
    radius:0,newRadius:0,note:'內湖地理位置參考。下方交通／接駁動畫使用合成瓶頸與站址，尚未對應實際路段、路線或 OD；此地圖不顯示虛構車流。'};
  return null;
}
export function mapPointIndex(spec){return new Map([...spec.existing,...spec.demand,...spec.candidates,...spec.selected].map(p=>[String(p.id),p]));}

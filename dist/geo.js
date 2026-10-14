export const EARTH_RADIUS=6378137;
export const GROUND_EARTH_RADIUS=6371000;
export const TILE_PROVIDER={id:'osm',name:'OpenStreetMap',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:'© OpenStreetMap contributors',copyright:'https://www.openstreetmap.org/copyright',maxZoom:19};
const rad=Math.PI/180,halfWorld=Math.PI*EARTH_RADIUS;
export function mercator(longitude,latitude){
  const lat=Math.max(-85.05112878,Math.min(85.05112878,latitude));
  return {x:EARTH_RADIUS*longitude*rad,y:EARTH_RADIUS*Math.log(Math.tan(Math.PI/4+lat*rad/2))};
}
export function unproject(x,y){return {longitude:x/EARTH_RADIUS/rad,latitude:(2*Math.atan(Math.exp(y/EARTH_RADIUS))-Math.PI/2)/rad};}
export function projection(bbox){
  const [west,south,east,north]=bbox,sw=mercator(west,south),ne=mercator(east,north);
  const cx=(sw.x+ne.x)/2,cy=(sw.y+ne.y)/2,center=unproject(cx,cy);
  const mercatorScale=180/Math.max(ne.x-sw.x,ne.y-sw.y),cos=Math.cos(center.latitude*rad);
  return {bbox:[...bbox],crs:'EPSG:3857',width:(ne.x-sw.x)*mercatorScale,depth:(ne.y-sw.y)*mercatorScale,
    scale:mercatorScale*(EARTH_RADIUS/GROUND_EARTH_RADIUS)/cos,mercatorScale,centerMercatorX:cx,centerMercatorY:cy,
    centerX:center.longitude,centerY:center.latitude,metresX:GROUND_EARTH_RADIUS*rad*cos,metresZ:GROUND_EARTH_RADIUS*rad};
}
export function worldPoint(point,project){
  const p=mercator(point.x,point.y);
  return {x:point.x===project.centerX?0:(p.x-project.centerMercatorX)*project.mercatorScale,
    z:point.y===project.centerY?-0:-(p.y-project.centerMercatorY)*project.mercatorScale};
}
export function tileURL(tile,provider=TILE_PROVIDER){return provider.url.replace('{z}',String(tile.z)).replace('{x}',String(tile.x)).replace('{y}',String(tile.y));}
export function tilePlan(bbox,zoom=14,maxTiles=24){
  const project=projection(bbox),sw=mercator(bbox[0],bbox[1]),ne=mercator(bbox[2],bbox[3]);
  let z=Math.max(0,Math.min(19,Math.floor(zoom))),range;
  do{const n=2**z,size=2*halfWorld/n;
    range={size,minX:Math.floor((sw.x+halfWorld)/size),maxX:Math.floor((ne.x+halfWorld-1e-7)/size),
      minY:Math.floor((halfWorld-ne.y)/size),maxY:Math.floor((halfWorld-sw.y-1e-7)/size)};
    if((range.maxX-range.minX+1)*(range.maxY-range.minY+1)<=maxTiles||z===0)break;z--;
  }while(true);
  const tiles=[];
  for(let y=range.minY;y<=range.maxY;y++)for(let x=range.minX;x<=range.maxX;x++){
    const west=x*range.size-halfWorld,east=west+range.size,north=halfWorld-y*range.size,south=north-range.size;
    const left=Math.max(sw.x,west),right=Math.min(ne.x,east),bottom=Math.max(sw.y,south),top=Math.min(ne.y,north);
    if(right<=left||top<=bottom)continue;
    const world={left:(left-project.centerMercatorX)*project.mercatorScale,right:(right-project.centerMercatorX)*project.mercatorScale,
      north:-(top-project.centerMercatorY)*project.mercatorScale,south:-(bottom-project.centerMercatorY)*project.mercatorScale};
    tiles.push({x,y,z,world,uv:{left:(left-west)/range.size,right:(right-west)/range.size,bottom:(bottom-south)/range.size,top:(top-south)/range.size}});
  }
  return {project,tiles,zoom:z};
}

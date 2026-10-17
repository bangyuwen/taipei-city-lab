import assert from 'node:assert/strict';
import test from 'node:test';
import {initializeSitingExperience} from '../dist/siting-ui.js';

function fixture(t) {
  const listeners=new Map(),scrolls=[],messages=[];
  const frame={dataset:{src:'siting-overlay.html'},style:{height:'900px'},contentWindow:{postMessage:(...args)=>messages.push(args)},getBoundingClientRect:()=>({top:80})};
  const status={hidden:false,textContent:''},retry={hidden:false};
  let pending;
  const globals={
    document:{getElementById:id=>({'siting-frame':frame,'siting-status':status,'siting-retry':retry})[id],querySelector:()=>({getBoundingClientRect:()=>({height:70})})},
    location:{origin:'https://example.test'},
    window:{innerWidth:960,scrollY:100,addEventListener:(name,handler)=>listeners.set(name,handler),scrollTo:value=>scrolls.push(value)},
    requestAnimationFrame:callback=>callback(),
    setTimeout:(callback,delay)=>{pending={callback,delay};return 1},
    clearTimeout:()=>{pending=null}
  };
  for(const [key,value] of Object.entries(globals)){
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
    t.after(()=>descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key]);
  }
  const experience=initializeSitingExperience();
  const send=(data,extra={})=>listeners.get('message')({origin:location.origin,source:frame.contentWindow,data,...extra});
  return {frame,status,retry,scrolls,messages,experience,send,pending:()=>pending};
}

test('siting accepts only finite bounded sizes from its same-origin frame',t=>{
  const f=fixture(t);
  assert.equal(f.frame.src,'siting-overlay.html');
  assert.equal(f.pending().delay,15000);
  for(const extra of [{origin:'https://other.test'},{source:{}}])f.send({type:'taipei-siting-size',height:800},extra);
  assert.equal(f.frame.style.height,'900px');
  for(const height of [null,'800',NaN,Infinity,399,12001]){
    f.send({type:'taipei-siting-size',height});
    assert.equal(f.frame.style.height,'900px');
  }
  for(const height of [400,401,11999,12000]){
    f.send({type:'taipei-siting-size',height});
    assert.equal(f.frame.style.height,`${height}px`);
  }
  assert.equal(f.status.hidden,true);
  assert.equal(f.retry.hidden,true);
  assert.equal(f.pending(),null);
  f.experience.reload();
  f.pending().callback();
  assert.equal(f.status.hidden,false);
  assert.equal(f.retry.hidden,false);
});

test('siting focus respects route activity, numeric bounds and the mobile header',t=>{
  const f=fixture(t);
  for(const top of [-1,12001,NaN,Infinity,'10'])f.send({type:'taipei-siting-focus',top});
  assert.equal(f.scrolls.length,0);
  for(const top of [0,1,12000]){
    f.send({type:'taipei-siting-focus',top});
    assert.equal(f.scrolls.at(-1).top,164+top);
  }
  window.innerWidth=959;
  f.send({type:'taipei-siting-focus',top:0});
  assert.equal(f.scrolls.at(-1).top,98);
  f.experience.setActive(false);
  const count=f.scrolls.length;
  f.send({type:'taipei-siting-focus',top:100});
  assert.equal(f.scrolls.length,count);
  f.experience.setActive(true);
  assert.deepEqual(f.messages.at(-1),[{type:'taipei-siting-measure'},location.origin]);
});

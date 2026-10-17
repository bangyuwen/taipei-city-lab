export function initializeSitingExperience() {
  const frame=document.getElementById('siting-frame');
  const status=document.getElementById('siting-status');
  const retry=document.getElementById('siting-retry');
  let active=true, timeout;

  function reload() {
    clearTimeout(timeout);
    status.hidden=false;
    status.textContent='正在載入候選街段與歷史點位…';
    retry.hidden=true;
    frame.src=frame.dataset.src;
    timeout=setTimeout(()=>{
      status.textContent='疊圖仍未完成載入。可重新載入，或使用「完整頁面開啟」。';
      retry.hidden=false;
    },15000);
  }

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
    const message=event.data;
    if(!message||typeof message!=='object')return;
    if(message.type==='taipei-siting-size'&&Number.isFinite(message.height)&&message.height>=400&&message.height<=12000){
      frame.style.height=Math.ceil(message.height)+'px';
      status.hidden=true;
      retry.hidden=true;
      clearTimeout(timeout);
    }
    if(message.type==='taipei-siting-focus'&&active&&Number.isFinite(message.top)&&message.top>=0&&message.top<=12000){
      const header=document.querySelector('.site-header');
      const offset=window.innerWidth<960?header.getBoundingClientRect().height+12:16;
      window.scrollTo({top:Math.max(0,window.scrollY+frame.getBoundingClientRect().top+message.top-offset),behavior:'instant'});
    }
  });

  reload();
  return {
    reload,
    setActive(value) {
      active=value;
      if(active)requestAnimationFrame(()=>frame.contentWindow?.postMessage({type:'taipei-siting-measure'},location.origin));
    }
  };
}

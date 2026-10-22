// Assigned inventory and observed reports are independent of forecast priority.
window.CrewList=(()=>{
  const clock=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'});
  const dateKey=ts=>clock.format(new Date(ts));
  const amounts=new Set(['empty','half','full','overflow']);
  function entries(assigned,forecasts){
    const byId=new Map(forecasts.map(entry=>[entry.b.id,entry]));
    return assigned.map(bin=>({...byId.get(bin.id),b:bin}));
  }
  function reports(assigned,events,now=Date.now()){
    const ids=new Set(assigned.map(bin=>bin.id)),today=dateKey(now),latest=new Map();
    for(const event of events){
      if(!ids.has(event.bin)||event.kind!=='clear'||event.by!=='清潔隊'||!amounts.has(event.amount)||!Number.isFinite(event.ts)||event.ts>now||!Number.isFinite(new Date(event.ts).getTime())||dateKey(event.ts)!==today)continue;
      if(!latest.has(event.bin)||latest.get(event.bin).ts<=event.ts)latest.set(event.bin,event);
    }
    return latest;
  }
  return {entries,reports,dateKey};
})();

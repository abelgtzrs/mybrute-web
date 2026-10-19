(function(){
  document.addEventListener('DOMContentLoaded',()=>{if(document.body.dataset.page)return;document.body.style.maxWidth='1400px';document.body.style.margin='0 auto';});
  const key='brute-party-v2';
  window.BruteApp={
    load(){return JSON.parse(localStorage.getItem(key)||'{"brutes":[],"fights":0,"day":""}')},
    save(s){localStorage.setItem(key,JSON.stringify(s))},
    today(){return new Date().toISOString().slice(0,10)},
    reset(s){if(s.day!==this.today()){s.day=this.today();s.fights=0;this.save(s)}return s},
    gfx(){return [Math.floor(Math.random()*2),0,...Array.from({length:14},()=>Math.floor(Math.random()*100))].join(';')},
    need(level){return level<50?1+(level-1)*2:level<100?99+(level-50):109+Math.floor((level-100)/10)*10},
    parts(g){const p=String(g||'').split(';').map(x=>Math.max(0,parseInt(x,10)||0));while(p.length<16)p.push(0);return p.slice(0,16)},
    hash(p){let h=1;for(const x of p)h=((h*11)^x)%2097151;return h},
    preview(host,g){try{const r=RufflePlayer.newest(),p=r.createPlayer();p.style.width='100%';p.style.height='100%';host.replaceChildren(p);p.load({url:'perso.swf',parameters:{data:this.parts(g).join(';'),chk:this.hash(this.parts(g)),stop:'1'},base:'.',allowScriptAccess:false,letterbox:'on',logLevel:'warn'})}catch(e){host.textContent='Preview unavailable'}}
  };
})();

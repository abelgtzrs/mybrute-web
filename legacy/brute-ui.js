(() => {
  const A = BruteApp, state = A.reset(A.load());
  const el = (tag, cls, text) => { const node = document.createElement(tag); if(cls) node.className=cls; if(text!==undefined) node.textContent=text; return node; };
  const link = (text, href, cls='button') => { const a=el('a',cls,text); a.href=href; return a; };
  function stats(b){const d=GladAPI.describe(b.id,b.level-1,b.choices||[]).fin, box=el('div','stats');[['Strength',d.force],['Agility',d.agility],['Speed',d.speed],['Health',d.life]].forEach(([name,value])=>{const s=el('div','stat');s.append(el('span','',name),el('strong','',value));box.append(s)});return box;}
  function xp(b){const box=el('div','xp'), label=el('div','xp-label'),p=el('progress'); label.append(el('span','',b.xp>=A.need(b.level)?'Level up available':'Next level'),el('span','',`${b.xp} / ${A.need(b.level)} XP`));p.max=A.need(b.level);p.value=b.xp;p.setAttribute('aria-label','Experience toward next level');box.append(label,p);return box;}
  function portrait(b){const col=el('div','portrait-column'),host=el('div','portrait');col.append(host);A.preview(host,b.gfx);return col;}
  function inventory(b){const panel=el('section','inventory-panel');panel.append(el('div','eyebrow','Equipment & abilities'),el('h2','','Inventory'));const det=el('details','invd');det.open=true;det.append(el('summary','','Inventory'),el('div','inv'));panel.append(det);Inventory.mount({el:panel,g:{id:b.id,lvl:b.level-1,choices:b.choices||[]}});det.addEventListener('toggle',()=>{if(!det.open)det.open=true});return panel;}
  function identity(b){const box=el('div','identity');box.append(el('span','badge',`LEVEL ${b.level}`),el('h3','',b.name),el('p','muted',`Brute #${b.id}`),xp(b),stats(b));return box;}
  function metric(name,value){const m=el('div','metric');m.append(el('small','',name),el('strong','',value));return m;}
  const root=document.getElementById('content');
  if(document.body.dataset.page==='party'){
    const metrics=el('div','metrics');metrics.append(metric('Party members',state.brutes.length),metric('Fights remaining',Math.max(0,10-state.fights)),metric('Total victories',state.brutes.reduce((n,b)=>n+(b.stats?.wins||0),0)));root.append(metrics);
    const roster=el('div','roster');root.append(roster);
    state.brutes.forEach(b=>{const card=el('article','roster-card'),info=identity(b);info.append(link('Enter cell →','brute.html?id='+b.id,'button primary'));card.append(portrait(b),info,inventory(b));roster.append(card)});
    if(!state.brutes.length){const empty=el('section','panel empty');empty.append(el('h2','','Your first champion awaits'),el('p','muted','Create a brute to start building your party.'),link('Create a brute','brute-create.html','button primary'));roster.append(empty)}
  }else{
    const b=state.brutes.find(b=>b.id===Number(new URLSearchParams(location.search).get('id')));
    if(!b){root.append(el('section','panel empty','Brute not found. Return to your party to select a brute.'));return;}
    document.getElementById('title').textContent=b.name;document.title=b.name+' · Brute Cell';document.getElementById('subtitle').textContent=`Brute #${b.id} · Level ${b.level}`;
    const layout=el('div','cell-layout'),main=el('div','cell-main'),overview=el('section','panel cell-overview'),info=identity(b);info.append(link('Fight / train →','brute-opponents.html?id='+b.id,'button primary'));overview.append(portrait(b),info);main.append(overview);
    const levelPanel=el('section','panel section-panel');levelPanel.append(el('div','eyebrow','Progression'),el('h2','','Raise your level'));
    if(b.xp>=A.need(b.level)){
      const next=GladAPI.describe(b.id,b.level,(b.choices||[]).slice(0,b.level-1).concat(0)).levels[b.level-1];
      levelPanel.append(el('p','muted','Choose your next upgrade, then confirm to reach level '+(b.level+1)+'.'));
      const options=el('div','choice-list'),confirm=el('button','button primary','Level up');confirm.disabled=true;let selected;
      next.opts.forEach((option,bit)=>{const label=el('label','choice'),input=el('input');input.type='radio';input.name='upgrade';input.value=bit;input.onchange=()=>{selected=bit;confirm.disabled=false};label.append(input,el('span','',option.text));options.append(label)});
      confirm.onclick=()=>{if(selected===undefined||b.xp<A.need(b.level))return;b.choices=(b.choices||[]).slice(0,b.level-1);b.choices.push(selected);b.xp-=A.need(b.level);b.level++;A.save(state);location.reload()};levelPanel.append(options,confirm);
    }else levelPanel.append(el('p','muted',`Earn ${A.need(b.level)-b.xp} more XP in the arena to unlock your next upgrade.`));main.append(levelPanel);
    const lifetime=el('section','panel section-panel');lifetime.append(el('div','eyebrow','Arena record'),el('h2','','Lifetime statistics'));const record=el('div','stats');[['Wins',b.stats?.wins||0],['Losses',b.stats?.losses||0],['Damage dealt',b.stats?.damage||0],['Weapons knocked',b.stats?.weaponsKnocked||0],['Weapons drawn',b.stats?.weaponsDrawn||0]].forEach(([name,value])=>{const item=el('div','stat');item.append(el('span','',name),el('strong','',value));record.append(item)});lifetime.append(record);main.append(lifetime);
    const history=el('section','panel section-panel');history.append(el('h2','','Fight history'));if(!b.history?.length)history.append(el('p','muted','Your arena story starts with your first fight.'));else b.history.slice().reverse().forEach((h,i)=>{const row=el('div','history-row');row.append(link('Fight '+(b.history.length-i),'brute-fight.html?replay='+encodeURIComponent(h.payload),''),el('span','muted',`${h.win?'Victory':'Defeat'} · +${h.xp} XP`));history.append(row)});main.append(history);layout.append(main,inventory(b));root.append(layout);
  }
})();

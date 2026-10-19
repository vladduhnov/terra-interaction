/* A scripted AI demo: one property context drives chat, map, monitoring, and projections. */
(() => {
  'use strict';
  const KEY = 'geolava-story-v1';
  const onboardingRequested=new URLSearchParams(location.search).has('onboarding');
  const ONBOARDING_KEY='geolava-welcome-complete-v1';
  let onboardingTimer;
  const properties = [
    {id:'market',address:'101 Market Street',name:'Market Street Offices',type:'Office',lng:-122.3950,lat:37.7932,score:82,area:'32,400 sq ft',assessed:'Oct 14',roof:'Modified bitumen',status:'Fair'},
    {id:'howard',address:'580 Howard Street',name:'Howard Residences',type:'Residential',lng:-122.3976,lat:37.7878,score:78,area:'18,200 sq ft',assessed:'Oct 13',roof:'Built-up membrane',status:'Fair'},
    {id:'mission',address:'245 Mission Street',name:'Mission Exchange',type:'Office',lng:-122.3960,lat:37.7901,score:91,area:'41,600 sq ft',assessed:'Oct 12',roof:'Single-ply membrane',status:'Good'},
    {id:'spear',address:'400 Spear Street',name:'Rincon Landing',type:'Residential',lng:-122.3895,lat:37.7890,score:87,area:'24,800 sq ft',assessed:'Oct 11',roof:'Modified bitumen',status:'Good'},
    {id:'folsom',address:'680 Folsom Street',name:'Folsom Works',type:'Industrial',lng:-122.3988,lat:37.7848,score:74,area:'28,100 sq ft',assessed:'Oct 10',roof:'Built-up membrane',status:'Fair'}
  ];
  const portfolioBuildings=Array.from({length:100},(_,i)=>{
    const streets=['Bay Street','Francisco Street','Lombard Street','Green Street','Union Street','Broadway','Pacific Avenue','Jackson Street','Washington Street','Clay Street'];
    const score=i<12?68+i:84+i%14;
    return {id:'portfolio-'+(i+1),groupId:'city-portfolio',address:`${1000+(i%10)*20} ${streets[Math.floor(i/10)]}`,name:`Portfolio building ${String(i+1).padStart(3,'0')}`,type:i%3===0?'Residential':'Office',lng:-122.418+(i%10)*.0019,lat:37.777+Math.floor(i/10)*.0016,score,area:(12000+i*240).toLocaleString('en-US')+' sq ft',assessed:'Oct 19',roof:'Modified bitumen',status:score<80?'Fair':'Good'};
  });
  let groupQuery='',groupStatus='all',groupPage=1;
  const GROUP_PAGE_SIZE=10;
  const monitoringUpdates = {
    market: [
      {id:'market-drain',title:'Drainage change detected',detail:'New pooling is visible near the southeast roof drain. Review it before the next period of rainfall.',time:'18 min ago',severity:'attention'},
      {id:'market-seam',title:'Membrane seam needs a look',detail:'A small change in the roof membrane seam was flagged against the previous assessment.',time:'2 hr ago',severity:'attention'}
    ],
    howard: [
      {id:'howard-roof',title:'Roof wear increased',detail:'The latest sample check found additional surface wear along the roof edge.',time:'12 min ago',severity:'attention'},
      {id:'howard-drain',title:'Drainage needs attention',detail:'A drainage zone shows a visible change. A ground inspection would help confirm its condition.',time:'46 min ago',severity:'attention'},
      {id:'howard-score',title:'Condition score dropped 5 points',detail:'The roof condition score moved from 83 to 78 in the latest sample monitoring run.',time:'1 hr ago',severity:'attention'}
    ],
    spear: [], mission: [], folsom: []
  };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch {}
  const validIds = new Set([...properties,...portfolioBuildings].map(p=>p.id));
  const state = {
    page:'home', active:null, session:null,
    monitored:new Set(Array.isArray(saved.monitored)?saved.monitored.filter(id=>validIds.has(id)):['howard','spear']),
    history:Array.isArray(saved.history)?saved.history.filter(s=>s&&Array.isArray(s.messages)&&validIds.has(s.propertyId)).slice(0,20):[],
    reviewed:new Set(Array.isArray(saved.reviewed)?saved.reviewed:[]), selectedUpdate:null,
    monitoring:saved.monitoring&&typeof saved.monitoring==='object'?saved.monitoring:{}, settingsOpen:false,
    simulation:null, area:[], suggestionIndex:-1, suggestions:[]
  };
  const $ = (selector,root=document) => root.querySelector(selector);
  const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const property = id => properties.find(p=>p.id===id)||portfolioBuildings.find(p=>p.id===id);
  const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const paths = {cursor:'M5 3l14 10-7 1-3 7-4-18z',scan:'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 12h8M12 8v8',draw:'M4 20l2-6L17 3l4 4-11 11-6 2zM14 6l4 4',pin:'M12 21s7-6 7-12A7 7 0 0 0 5 9c0 6 7 12 7 12zM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6',arrow:'M5 12h14M13 6l6 6-6 6',check:'M5 12l4 4L19 6',rain:'M7 14l-1 4M12 14l-1 4M17 14l-1 4M5 11a4 4 0 1 1 1-8 5 5 0 0 1 9 0 4 4 0 1 1 3 8z',spark:'M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3z',back:'M19 12H5M11 6l-6 6 6 6',monitor:'M3 12h4l3-6 4 12 3-6h4'};
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
  const button = (label,action,cls='',attrs='') => `<button type="button" class="story-btn ${cls}" data-story-action="${action}" ${attrs}>${label}</button>`;
  const promptCard = (title,description,symbol,prompt) => `<button class="property-prompt-card" data-story-action="prompt" data-prompt="${esc(prompt)}"><span class="property-prompt-icon">${icon(symbol)}</span><strong>${title}</strong><small>${description}</small></button>`;
  const suggestions = (p,includeInfo=true) => `<div class="property-prompt-grid" aria-label="Suggested questions">${includeInfo?promptCard('Tell me more','Get the story behind this building.','spark','Give me more information about this building'):''}${promptCard('Look five years ahead','Explore how the roof could change.','rain','What will happen to the roof of this building in five years?')}${promptCard('Assess the roof','Take a closer look at its condition.','monitor','Assess the current roof condition of this building')}</div>`;


  function edgeFade(classes) {
    return `<div class="content-edge-fade ${classes}" aria-hidden="true">${[.5,1,2,4,8,12].map((blur,i)=>`<span style="--edge-blur:${blur}px;--edge-start:${i*13}%;--edge-end:${Math.min(100,24+i*13)}%"></span>`).join('')}</div>`;
  }
  document.body.classList.add('story-prototype');
  $('.home-panel').insertAdjacentHTML('beforeend','<main class="story-screen" id="story-screen" aria-label="Geolava assistant workspace"></main>');
  $('.home-panel').insertAdjacentHTML('beforeend','<div class="story-header-slot" id="story-header-slot"></div>');
  $('.home-chat-wrap').insertAdjacentHTML('afterbegin','<div class="story-context" id="story-context"></div>');
  $('.home-chat-wrap').insertAdjacentHTML('afterbegin', `<div class="story-actions"><button class="story-action" data-story-action="pick"><span class="story-shortcut-icon">${icon('cursor')}</span><span>Pick a spot</span></button><button class="story-action ask" data-story-action="ask"><span class="story-shortcut-icon">${icon('scan')}</span><span>Scan anything</span></button><button class="story-action" data-story-action="draw"><span class="story-shortcut-icon">${icon('draw')}</span><span>Draw an area</span></button></div>`);
  document.body.insertAdjacentHTML('beforeend','<aside class="story-map" id="story-map" aria-label="Connected property map"></aside><div id="story-status" role="status" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)"></div>');
  document.body.insertAdjacentHTML('beforeend',`<button type="button" class="glass-btn story-map-recenter" id="story-map-recenter" data-story-action="refocus" title="Recenter on selected property" aria-label="Recenter" hidden>${icon('pin')}</button>`);
  $('.home-chat-wrap').insertAdjacentHTML('afterbegin',edgeFade('composer-edge-fade'));
  const composerField=document.createElement('div');
  composerField.className='story-composer-field';
  homeInput.before(composerField);composerField.append(homeInput);
  homeInput.setAttribute('aria-label','Search for an address or ask about a property');
  composerField.insertAdjacentHTML('beforeend',`<div class="story-composer-hints" aria-hidden="true">${['Search for an address','Ask a question about a property','Evaluate roof condition','Predict environmental effects'].map((text,i)=>`<span style="--hint-index:${i}">${text}</span>`).join('')}</div>`);
  const screen = $('#story-screen');
  const markerMap = new Map();
  const composerObserver = new ResizeObserver(entries => {
    screen.style.bottom = '20px';
    screen.style.paddingBottom = (['home','assessment','group'].includes(state.page)?32:entries[0].target.getBoundingClientRect().height + 28) + 'px';
  });
  composerObserver.observe($('.home-chat-wrap'));
  let simulationTimers = [], toastTimer, screenFrame, hovered = null;
  const footprints = new Map();
  const buildingHeights = new Map();
  const roofHighlightCache = new Map();
  const surroundingsCache = new Map();
  function announce(text) { $('#story-status').textContent=text; }
  function toast(text) { $('.story-toast')?.remove();const el=document.createElement('div');el.className='story-toast';el.role='status';el.textContent=text;document.body.append(el);clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.remove(),3500); }
  function persist() {
    try { localStorage.setItem(KEY,JSON.stringify({monitored:[...state.monitored],reviewed:[...state.reviewed],monitoring:state.monitoring,history:state.history.slice(0,20).map(s=>({...s,messages:s.messages.map(m=>m.type==='pending'?{type:'note',id:m.id,text:'The simulation was interrupted. Run it again to see the projection.'}:m)}))})); } catch { /* Keep the demo usable when storage is unavailable. */ }
  }
  function row(p,sub='') {return `<button class="story-property ${state.active===p.id?'active':''}" data-story-property="${p.id}"><img src="geolava-assets/roof-current.svg" alt=""><span class="story-property-main"><span class="story-property-name">${esc(p.address)}</span><small>${esc(sub||`${p.type} · San Francisco`)}</small></span>${state.monitored.has(p.id)?'<span class="story-pill purple"><span class="dot"></span>Monitoring</span>':`<span class="story-pill ${p.score<85?'amber':''}">${p.score} / 100</span>`}${state.monitored.has(p.id)?'':icon('arrow')}</button>`;}
  const updatesFor = id => {const p=property(id);return monitoringUpdates[id]||(p?.groupId&&p.score<80?[{id:p.id+'-drain',title:'Drainage needs attention',detail:'The latest check flagged pooling around a roof drain. Arrange a closer inspection before the next rain.',severity:'attention',time:'Latest check'}]:[]);};
  const unreadFor = id => updatesFor(id).filter(update=>!state.reviewed.has(update.id));
  function nextCheck(p) {
    const frequency=state.monitoring[p.id]?.frequency||(p.groupId?'Weekly':'Monthly');
    return {frequency,date:frequency==='Weekly'?'Oct 22':frequency==='Quarterly'?'Jan 15':'Nov 15'};
  }
  function monitoringCard(p) {
    const schedule=nextCheck(p);
    const healthy=[
      {title:`Roof condition is ${p.status.toLowerCase()}`,stable:true},
      {title:'Drainage is good',stable:true},
      {title:'Exterior condition is good',stable:true}
    ];
    const latest=[...updatesFor(p.id),...healthy].slice(0,3);
    const warning='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7.5v5M12 16.5h.01"/></svg>';
    return `<article class="monitor-card" data-story-preview="${p.id}" aria-label="${esc(p.address)} monitoring"><button class="monitor-card-property" data-story-property="${p.id}"><div class="monitor-card-heading"><h3>${esc(p.address)}</h3><p>${esc(p.type)} · San Francisco</p></div></button><div class="monitor-card-schedule"><span>${schedule.frequency} checks</span><span>Next run ${schedule.date}</span></div><div class="monitor-notifications">${latest.map(update=>`<button class="monitor-notification" ${update.id?`data-story-notification="${update.id}" data-property-id="${p.id}"`:`data-story-property="${p.id}"`} aria-label="${esc(update.title)}, ${esc(p.address)}"><span class="monitor-status-icon ${update.stable?'good':'issue'}">${update.stable?icon('check'):warning}</span><span class="monitor-notification-copy"><strong>${esc(update.title)}</strong></span></button>`).join('')}</div></article>`;
  }

  function portfolioCard() {
    return `<article class="monitor-card monitor-group-card" aria-label="City portfolio, 100 monitored buildings"><button class="monitor-card-property" data-story-action="monitor-group"><div class="monitor-card-heading"><h3>City portfolio</h3><p>100 buildings · San Francisco</p></div></button><div class="monitor-card-schedule"><span>Weekly checks</span><span>Next run Oct 22</span></div><div class="monitor-notifications">${[['12 buildings need a closer look','issue'],['88 buildings holding steady','good'],['100 buildings checked today','good']].map(([text,status])=>`<button class="monitor-notification" data-story-action="monitor-group"><span class="monitor-status-icon ${status}">${icon(status==='issue'?'monitor':'check')}</span><span class="monitor-notification-copy"><strong>${text}</strong></span></button>`).join('')}</div></article>`;
  }
  function filteredPortfolio() {
    const query=groupQuery.toLowerCase().trim();
    return portfolioBuildings.filter(p=>(p.address+' '+p.name+' '+p.type).toLowerCase().includes(query)&&(groupStatus==='all'||(groupStatus==='attention'?p.score<80:p.score>=80)));
  }
  function portfolioRows() {
    const buildings=filteredPortfolio(),pages=Math.ceil(buildings.length/GROUP_PAGE_SIZE);
    groupPage=Math.max(1,Math.min(groupPage,pages||1));
    const start=(groupPage-1)*GROUP_PAGE_SIZE,visible=buildings.slice(start,start+GROUP_PAGE_SIZE);
    const pagination=pages>1?`<nav class="portfolio-pagination" aria-label="Building list pages"><button type="button" data-story-action="portfolio-page" data-page="${groupPage-1}" aria-label="Previous page" ${groupPage===1?'disabled':''}>${icon('back')}</button>${Array.from({length:pages},(_,i)=>`<button type="button" data-story-action="portfolio-page" data-page="${i+1}" aria-label="Page ${i+1}" ${groupPage===i+1?'aria-current="page"':''}>${i+1}</button>`).join('')}<button type="button" data-story-action="portfolio-page" data-page="${groupPage+1}" aria-label="Next page" ${groupPage===pages?'disabled':''}>${icon('arrow')}</button></nav>`:'';
    return `<p class="portfolio-results-count" role="status" tabindex="-1">${buildings.length?`${start+1}–${start+visible.length} of ${buildings.length} buildings`:'0 buildings'}</p>${visible.map(p=>`<button class="story-property portfolio-building" data-story-property="${p.id}"><span class="portfolio-building-index">${p.name.split(' ').pop()}</span><span class="story-property-main"><span class="story-property-name">${p.address}</span><small>${p.type} · Weekly checks · Next run Oct 22</small></span><span class="portfolio-building-condition ${p.score<80?'attention':''}"><i></i>${p.score<80?'Needs a look':'Stable'}</span><span class="portfolio-building-score">${p.score}<small>/100</small></span></button>`).join('')||'<p class="story-empty">No buildings match your search.</p>'}${pagination}`;
  }
  function renderPortfolio() {
    screen.innerHTML=`<div class="story-topline">${button('Back to home','home','quiet')}<span class="story-eyebrow">Monitoring group</span></div><div class="property-brief"><img class="property-summary-avatar" src="geolava-assets/Geolava-assistant.png" alt="Geolava assistant"><h1>City portfolio</h1><p class="portfolio-summary">88 buildings are holding steady. Drainage changes at 12 buildings need a closer look.</p></div><div class="portfolio-metrics"><div><strong>100</strong><small>Monitored buildings</small></div><div><strong>12</strong><small>Need attention</small></div><div><strong>88</strong><small>Holding steady</small></div></div><section class="story-section"><div class="story-section-head"><h2>Buildings</h2><small>Weekly checks · Next run Oct 22</small></div><div class="portfolio-filters"><label class="assessment-search-field">${icon('scan')}<input type="search" id="portfolio-search" placeholder="Find a building" aria-label="Find a building" value="${esc(groupQuery)}"></label><label class="portfolio-filter-label">Condition<select id="portfolio-status" aria-label="Filter buildings by condition"><option value="all" ${groupStatus==='all'?'selected':''}>All buildings</option><option value="attention" ${groupStatus==='attention'?'selected':''}>Needs a look</option><option value="stable" ${groupStatus==='stable'?'selected':''}>Stable</option></select></label></div><div id="portfolio-buildings">${portfolioRows()}</div></section>`;
  }
  function openPortfolio() {
    navigate('group');
    const bounds=new mapboxgl.LngLatBounds();portfolioBuildings.forEach(p=>bounds.extend([p.lng,p.lat]));
    map.fitBounds(bounds,{padding:70,maxZoom:15,pitch:0,bearing:0,duration:1000});
  }
  function updatePortfolioMap() {
    updateSource('story-portfolio-buildings',turf.featureCollection(state.page==='group'?filteredPortfolio().map(p=>turf.point([p.lng,p.lat],{id:p.id,address:p.address,attention:p.score<80})):[]));
  }
  function propertyUpdates(p) {
    const monitored=state.monitored.has(p.id)||!!p.groupId,updates=monitored?updatesFor(p.id):[];
    const baseline=[
      {id:p.id+'-condition',title:`Roof condition remains ${p.status.toLowerCase()}`,detail:`The latest roof condition score is ${p.score}/100. Keep membrane seams and drainage in view.`,time:'Latest check',stable:true},
      {id:p.id+'-exterior',title:'No new exterior changes',detail:'No additional changes were flagged outside the roof in the latest check.',time:'Latest check',stable:true},
      {id:p.id+'-schedule',title:'Monitoring is on schedule',detail:`${nextCheck(p).frequency} checks are active. The next run is ${nextCheck(p).date}.`,time:'Up to date',stable:true}
    ];
    const top=[...updates,...baseline].slice(0,3);
    const summary=updates.length?`${p.address} ${p.id==='howard'?'needs a closer look at roof wear and drainage after a five-point condition drop.':'has drainage and membrane seam changes that need a closer look.'}`:monitored?`${p.address} is holding steady, with no new changes and a roof condition score of ${p.score}/100.`:`${p.address} is ${/^[aeiou]/i.test(p.type)?'an':'a'} ${p.type.toLowerCase()} property with a roof condition score of ${p.score}/100.`;
    return `<section class="property-brief"><img class="property-summary-avatar" src="geolava-assets/Geolava-assistant.png" alt="Geolava assistant"><p>${esc(summary)}</p></section>${monitored?`<section class="story-section" id="property-monitoring-updates"><div class="property-highlights">${top.map((update,i)=>`<article id="update-${update.id}" class="property-highlight ${state.selectedUpdate===update.id?'selected':''}"><span class="property-highlight-number ${update.stable?'stable':''}">${String(i+1).padStart(2,'0')}</span><div><div class="story-flex" style="justify-content:space-between"><h3>${esc(update.title)}</h3><small>${esc(update.time)}</small></div><p>${esc(update.detail)}</p>${!update.stable?button('<img src="geolava-assets/Geolava-assistant.png" alt="">What can I do?','issue-chat','issue-chat-button',`data-issue-id="${esc(update.id)}" aria-label="What can I do about ${esc(update.title)}?"`):''}</div></article>`).join('')}</div></section>`:''}`;
  }
  function updateCarouselControls() {
    const rail=$('#monitor-carousel');if(!rail)return;
    const previous=$('[data-story-action="monitor-previous"]'),next=$('[data-story-action="monitor-next"]');
    rail.parentElement.classList.toggle('can-scroll-left',rail.scrollLeft>1);
    rail.parentElement.classList.toggle('can-scroll-right',rail.scrollLeft+rail.clientWidth<rail.scrollWidth-2);
    if(previous)previous.disabled=rail.scrollLeft<=1;
    if(next)next.disabled=rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-2;
  }

  function renderHome() {
    const monitored=properties.filter(p=>state.monitored.has(p.id)),hasMonitoring=true;
    screen.innerHTML=`<div class="story-home-intro"><img src="geolava-assets/Geolava-assistant.png" alt="Geolava assistant"><h1 class="portfolio-summary">Most monitored properties look good, with changes at two in Fisherman’s Wharf.</h1></div><section class="story-section"><div class="story-section-head"><h2>Monitoring</h2>${hasMonitoring?`<div class="monitor-carousel-controls">${button(icon('back'),'monitor-previous','','aria-label="Previous monitored properties" aria-controls="monitor-carousel"')}${button(icon('arrow'),'monitor-next','','aria-label="Next monitored properties" aria-controls="monitor-carousel"')}</div>`:''}</div>${hasMonitoring?`<div class="monitor-carousel-shell"><div class="monitor-grid" id="monitor-carousel" role="region" aria-roledescription="carousel" aria-label="Monitoring" tabindex="0">${portfolioCard()}${monitored.map(monitoringCard).join('')}</div>${edgeFade('carousel-edge-left')}${edgeFade('carousel-edge-right')}</div>`:'<div class="story-empty">No monitored properties yet. Ask Geolava to monitor a building.</div>'}</section><section class="story-section assessment-search-section" aria-labelledby="assessment-search-title"><h2 id="assessment-search-title">Assess the property</h2><p class="assessment-intro">Start with an address to explore the building and everything around it.</p><div class="assessment-search-box"><label class="assessment-search-field">${icon('pin')}<input id="assessment-address" type="search" placeholder="Search for an address" aria-label="Search for an address" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="assessment-address-results" autocomplete="off"></label><div id="assessment-address-results" class="assessment-address-results" role="listbox" aria-label="Suggested addresses" hidden></div></div>${$('.home-chat-wrap .story-actions').outerHTML}</section>`;
  }
  function sessionLabel(session) {
    const questions=session.messages.filter(m=>m.type==='user');
    const first=questions.find(m=>!/^(tell me about |\d)/i.test(m.text))||questions[0];
    return first?.text?.slice(0,70)||'Property conversation';
  }
  function chatRow(session,{recent=false}={}) {
    const count=session.messages.filter(m=>m.type==='user').length;
    return `<button class="story-property${recent?' recent-chat':''}" data-story-session="${session.id}"><span class="story-chat-dot">${icon('spark')}</span><span class="story-property-main"><span class="story-property-name">${esc(sessionLabel(session))}</span><small>${recent?esc(property(session.propertyId)?.address)+' · ':''}${count} question${count===1?'':'s'}${recent?'':' · Saved conversation'}</small></span></button>`;
  }
  function renderCollection(page) {
    const watch=page==='watchlist';
    const groups=properties.map(p=>({property:p,chats:state.history.filter(s=>s.propertyId===p.id)})).filter(g=>g.chats.length);
    screen.innerHTML=`<div class="story-topline"><span class="story-eyebrow">Your workspace</span>${button('Back home','home','quiet')}</div><h1>${watch?'Monitoring':'Property conversations'}</h1><p style="color:#939391;margin:12px 0 26px">${watch?'Every check, connected to a building and its story.':'Each property keeps its conversations together.'}</p>${watch?properties.filter(p=>state.monitored.has(p.id)).map(p=>row(p,`${state.monitoring[p.id]?.frequency||'Monthly'} condition checks · Alerts enabled`)).join('')||'<div class="story-empty">Ask to add a property to monitoring to see it here.</div>':groups.map(g=>`<section class="story-section"><div class="story-section-head"><button class="story-group-link" data-story-property="${g.property.id}">${esc(g.property.address)}</button><small>${g.chats.length} chats</small></div>${g.chats.map(chat=>chatRow(chat)).join('')}</section>`).join('')||'<div class="story-empty">Your property conversations will appear here.</div>'}`;
  }

  const assetCard = p => `<div class="story-asset-card"><img class="story-asset-image" src="geolava-assets/roof-current.svg" alt="Illustrative roof layout"><div class="story-asset-info"><div class="story-flex" style="justify-content:space-between"><h3>${esc(p.address)}</h3><span class="story-pill ${p.score<85?'amber':''}">${p.status}</span></div><p>${p.name} · ${p.type} · San Francisco, CA</p><div class="story-facts"><div class="story-fact"><small>Condition</small><strong>${p.score}<span style="font-size:11px;color:#939391"> / 100</span></strong></div><div class="story-fact"><small>Building area</small><strong style="font-size:14px">${p.area}</strong></div><div class="story-fact"><small>Roof type</small><strong style="font-size:14px">${p.roof}</strong></div></div></div></div>`;
  const timelineCategories={
    roof:{label:'Roof & drainage',shape:'circle',color:'#c65d56'},
    development:{label:'Development',shape:'square',color:'#5685c9'},
    greenery:{label:'Greenery',shape:'diamond',color:'#78946b'},
    access:{label:'Sidewalk & parking',shape:'triangle',color:'#d0ad43'}
  };
  const timelineEvents=[
    {id:'storm',confidence:86,year:2027.25,category:'roof',title:'Storm stress at the roof seams',detail:'In this sample April storm scenario, heavy rain and wind could widen the existing membrane seam and increase the chance of water entering near the roof drain.',next:'Inspect the flagged seams and drainage before the simulated storm.'},
    {id:'shopping',confidence:68,year:2028+8/12,category:'development',title:'Shopping center construction nearby',detail:'A fictional nearby retail project could bring construction dust, delivery traffic, and temporary changes to building access.',next:'Plan access routes and check nearby surfaces during construction.'},
    {id:'canopy',confidence:81,year:2029+5/12,category:'greenery',title:'Tree canopy reaches the roof edge',detail:'In this scenario, growing branches extend over the roof and increase leaf accumulation around gutters and drains.',next:'Review branch clearance and schedule seasonal gutter checks.'},
    {id:'sidewalk',confidence:74,year:2030+1/12,category:'access',title:'Sidewalk repairs affect parking access',detail:'A sample sidewalk repair phase temporarily closes the closest parking entrance and narrows the accessible route to the property.',next:'Plan an alternate entrance and clearly sign the temporary route.'},
    {id:'leak',confidence:63,year:2030+10/12,category:'roof',title:'Potential roof leak develops',detail:'If the existing seam and drainage findings remain unresolved in this scenario, repeated wet weather could lead to a local roof leak.',next:'Compare the latest roof inspection with the original finding and prioritize the affected area.'}
  ];
  const confidenceMarkup = event => `<span class="prediction-confidence" title="Sample confidence score for this prototype" aria-label="Sample prediction confidence: ${event.confidence} percent"><span>Confidence</span><strong>${event.confidence}%</strong></span>`;
  let pinnedTimelineEvent=null,timelineHoverTimer;
  const timelineDate=year=>{const month=Math.round((year-2026)*12);return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month%12]+' '+(2026+Math.floor(month/12));};
  function timelineMarkup(sim){
    const end=2026+sim.horizon,events=timelineEvents.filter(event=>event.year<=end);
    return `<div class="story-map-dock timeline-dock"><div class="timeline-header"><output data-timeline-date>${timelineDate(sim.year)}</output></div><div class="timeline-event-popover" id="timeline-event-popover" role="region" aria-label="Potential event details" hidden></div><div class="timeline-track"><div class="timeline-events">${events.map(event=>{const category=timelineCategories[event.category];return `<button type="button" class="timeline-event ${category.shape}" style="--event-color:${category.color};left:${100*(event.year-2026)/sim.horizon}%" data-story-action="timeline-event" data-event-id="${event.id}" aria-label="${timelineDate(event.year)}: ${esc(event.title)}" aria-expanded="false" aria-controls="timeline-event-popover"><span></span></button>`;}).join('')}</div><input type="range" min="2026" max="${end}" step="${1/12}" value="${sim.year}" data-story-year="${sim.resultId}" aria-label="Projection date on map"><div class="timeline-years">${Array.from({length:sim.horizon+1},(_,i)=>`<span>${2026+i}</span>`).join('')}</div></div></div>`;
  }
  function showTimelineEvent(id,pin=false){
    const event=timelineEvents.find(event=>event.id===id),popover=$('#timeline-event-popover');if(!event||!popover)return;
    if(pin)pinnedTimelineEvent=id;
    const category=timelineCategories[event.category];
    popover.style.setProperty('--event-position',100*(event.year-2026)/(state.simulation?.horizon||5)+'%');
    popover.innerHTML=`<div class="timeline-popover-head"><span style="color:${category.color}">${category.label} · ${timelineDate(event.year)}</span>${button('×','timeline-close','quiet','aria-label="Close event details"')}</div><h3>${esc(event.title)}</h3><p>${esc(event.detail)}</p>${confidenceMarkup(event)}<p class="timeline-next-step">${esc(event.next)}</p><small>Sample scenario · Not a forecast or announced project</small>`;
    popover.hidden=false;
    if(map.getLayer('story-context-impact-line'))map.setPaintProperty('story-context-impact-line','line-width',['case',['==',['get','eventId'],event.id],3,1.5]);
    document.querySelectorAll('.timeline-event').forEach(el=>{const selected=el.dataset.eventId===id;el.classList.toggle('selected',selected);el.setAttribute('aria-expanded',String(selected));});
  }
  function closeTimelineEvent(){
    if(map.getLayer('story-context-impact-line'))map.setPaintProperty('story-context-impact-line','line-width',1.5);
    pinnedTimelineEvent=null;const popover=$('#timeline-event-popover');if(popover)popover.hidden=true;
    document.querySelectorAll('.timeline-event').forEach(el=>{el.classList.remove('selected');el.setAttribute('aria-expanded','false');});
  }
  function impactSummary(m){
    const events=timelineEvents.filter(event=>event.year<=2026+m.horizon);
    return `<section class="story-section simulation-impacts"><h2>Potential changes</h2>${Object.entries(timelineCategories).map(([key,category])=>{const items=events.filter(event=>event.category===key);if(!items.length)return '';return `<div class="simulation-impact-group"><h3><i class="${category.shape}" style="--event-color:${category.color}"></i>${category.label}</h3>${items.map(event=>`<div class="simulation-impact-item"><button type="button" data-story-action="timeline-event" data-event-id="${event.id}" data-result-id="${m.id}"><span>${esc(event.title)}</span><small>${timelineDate(event.year)}</small></button><p>${esc(event.detail)}</p>${confidenceMarkup(event)}</div>`).join('')}</div>`;}).join('')}</section>`;
  }
  function satelliteRoofContent(p,projected){
    const roof=turf.feature(buildingGeometry(p)),bbox=turf.bbox(roof);
    const southwest=mapboxgl.MercatorCoordinate.fromLngLat([bbox[0],bbox[1]]),northeast=mapboxgl.MercatorCoordinate.fromLngLat([bbox[2],bbox[3]]);
    const cx=(southwest.x+northeast.x)/2,cy=(southwest.y+northeast.y)/2;
    let width=(northeast.x-southwest.x)*1.45,height=(southwest.y-northeast.y)*1.45;
    if(width/height<640/440)width=height*640/440;else height=width*440/640;
    const left=cx-width/2,top=cy-height/2;
    const unproject=(x,y)=>new mapboxgl.MercatorCoordinate(x,y).toLngLat();
    const sw=unproject(left,top+height),ne=unproject(left+width,top);
    const bounds=[sw.lng,sw.lat,ne.lng,ne.lat].map(value=>+value.toFixed(8));
    const src=`https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/[${bounds.join(',')}]/640x440@2x?padding=0&access_token=${encodeURIComponent(mapboxgl.accessToken)}`;
    const path=geometry=>{const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];return polygons.map(polygon=>polygon.map(ring=>ring.map((coord,index)=>{const point=mapboxgl.MercatorCoordinate.fromLngLat(coord);return (index?'L':'M')+((point.x-left)/width*640).toFixed(2)+' '+((point.y-top)/height*440).toFixed(2);}).join(' ')+' Z').join(' ')).join(' ');};
    let impacts='';
    if(projected){const w=bbox[2]-bbox[0],h=bbox[3]-bbox[1];impacts=[[.08,.1,.43,.36],[.55,.53,.96,.92],[.12,.7,.48,.98]].map((box,i)=>{const [u0,v0,u1,v1]=box;const rect=turf.bboxPolygon([bbox[0]+w*u0,bbox[1]+h*v0,bbox[0]+w*u1,bbox[1]+h*v1]);const clipped=turf.intersect(turf.featureCollection([roof,rect]));return clipped?`<path d="${path(clipped.geometry)}" fill="${i===1?'#c65d56':'#d7a65c'}" fill-opacity=".48" stroke="${i===1?'#c65d56':'#d7a65c'}" stroke-width="1.5" fill-rule="evenodd"/>`:'';}).join('');}
    return `<img src="${esc(src)}" width="640" height="440" alt="${projected?'Satellite roof imagery with illustrative future affected areas':'Satellite imagery of the selected roof'}" decoding="async"><svg viewBox="0 0 640 440" aria-hidden="true">${impacts}<path d="${path(roof.geometry)}" fill="none" stroke="#8587ed" stroke-width="2"/></svg><span class="satellite-image-status">Loading satellite imagery…</span>`;
  }
  const satelliteRoof=(p,projected)=>`<span class="satellite-roof" data-roof-property="${p.id}" data-roof-projected="${projected}">${satelliteRoofContent(p,projected)}</span>`;
  function refreshSatelliteRoofs(p){document.querySelectorAll(`[data-roof-property="${p.id}"]`).forEach(el=>{el.innerHTML=satelliteRoofContent(p,el.dataset.roofProjected==='true');});}
  function resultMarkup(m) {
    const p=property(m.propertyId),end=2026+m.horizon;
    const active=state.simulation?.resultId===m.id,year=active?state.simulation.year:end;
    const score=projectedScore(p,year),wear=wearAt(year);
    return `<h2>${m.horizon===1?'A year':m.horizon+' years'} can leave a mark.</h2><p>For ${esc(p.address)}, repeated rainfall and seasonal heating could accelerate membrane wear around drainage points. This illustrative ${m.horizon}-year scenario also considers nearby development, greenery, and changes to sidewalk and parking access.</p><div class="roof-reveal" data-result="${m.id}" style="--reveal:50%"><div class="roof-reveal-image" role="group" aria-label="Roof impact image comparison"><div class="roof-reveal-base">${satelliteRoof(p,false)}</div><div class="roof-reveal-projected">${satelliteRoof(p,true)}</div><div class="roof-reveal-labels" aria-hidden="true"><span>Today</span><span>Potential impact</span></div><div class="roof-reveal-divider" aria-hidden="true"><span>‹ ›</span></div><input class="roof-reveal-range" type="range" min="0" max="100" value="50" aria-label="Reveal projected roof impacts" aria-valuetext="50% projected impacts visible" data-roof-reveal="${m.id}"></div></div><div class="story-facts" data-result-metrics="${m.id}"><div class="story-fact"><small>Roof condition · <span data-output-year>${Number.isInteger(year)?year:timelineDate(year)}</span></small><strong><span data-output-score>${score}</span> <span style="color:#939391;font-size:12px">/ 100</span></strong></div><div class="story-fact"><small>Surface affected</small><strong><span data-output-wear>${wear}</span>%</strong></div><div class="story-fact"><small>Primary concern</small><strong style="font-size:14px">Drainage wear</strong></div></div><label class="story-year-control">2026<input type="range" min="2026" max="${end}" step="${1/12}" value="${year}" aria-label="Projection year in chat" data-story-year="${m.id}">${end}</label><p class="story-result-note">Inspect drainage and repair membrane seams to reduce the illustrated exposure. Drag the image divider to reveal the affected areas. Move the timeline to explore the same year on the map.</p>${impactSummary(m)}<p class="story-source">Satellite imagery is the current basemap, not imagery captured in 2026 or 2031. Colored areas illustrate potential impact. Assumes typical rainfall, continued aging, and no roof intervention. This is a visual concept, not a measured forecast.</p><div class="story-suggestions">${button('Monitor this roof','prompt','','data-prompt="Monitor this roof for changes"')}${button('Explain the changes','prompt','','data-prompt="Explain the projected roof changes"')}${button('Run again','replay','',`data-result-id="${m.id}"`)}</div>`;
  }
  function messageMarkup(m) {
    if(m.type==='user')return `<article class="story-message user" data-message="${m.id}" data-message-type="${m.type}"><span class="story-user-avatar">V</span><p>${esc(m.text)}</p></article>`;
    const p=property(m.propertyId)||property(state.active)||properties[0];
    let content='';
    if(m.type==='asset')content=`<h2>Let’s take a closer look.</h2><p>I’ve located ${esc(p.address)} and highlighted its demo building footprint on the map. We can explore its condition, keep an eye on changes, or look ahead.</p>${assetCard(p)}${suggestions(p)}`;
    if(m.type==='info')content=`<h2>A closer look at the building.</h2><p>${esc(p.name)} is ${/^[aeiou]/i.test(p.type)?'an':'a'} ${p.type.toLowerCase()} property with ${p.area} of building area. Its ${p.roof.toLowerCase()} roof has a sample condition score of ${p.score}/100.</p><p>The main areas to watch are membrane seams and drainage. I’ve highlighted those roof zones on the map so you can see where the observations apply.</p><div class="story-facts"><div class="story-fact"><small>Roof condition</small><strong>${p.status}</strong></div><div class="story-fact"><small>Sample confidence</small><strong>92%</strong></div><div class="story-fact"><small>Last assessed</small><strong>${p.assessed}</strong></div></div>${suggestions(p,false)}<p class="story-source">Fictional assessment · Exterior observations only</p>`;
    if(m.type==='assessment-outlook'){const c=assessmentCategories(p).find(c=>c.id===m.category);content=`<h2>What to watch over time.</h2><p>${c.id==='greenery'?'Tree growth could bring branches closer to the roof, and seasonal leaf fall could obstruct gutters. Watch for canopy changes, blocked drains, and dry or damaged branches.':'Repeated traffic and wet weather could lead to cracks, potholes, and temporary access restrictions. Watch the entrance, loading route, and curbside drainage after heavy rain.'}</p><p>Compare future checks with the current condition and arrange a closer inspection if new changes appear.</p>`;}
    if(m.type==='issue-help')content=`<h2>What you can do next.</h2><p><strong>${esc(m.issueTitle)}</strong></p><p>For ${esc(p.address)}: ${esc(m.issueDetail)}</p><p>A useful next step is to arrange a closer inspection of the flagged area, record what is found, and compare it with the next assessment.</p><p>We can use this chat to explore the finding and keep your follow-up questions together.</p><p class="story-source">Illustrative next steps based on sample monitoring data.</p>`;
    if(m.type==='monitor')content=`<h2>${m.removed?'Monitoring paused.':'I’ll keep an eye on it.'}</h2><p>${m.removed?`${esc(p.address)} has been removed from your monitored properties.`:`${esc(p.address)} is now in your monitored properties. The same building is marked in purple on the map.`}</p>${m.removed?'':`<div class="story-monitor-card"><div class="story-flex">${icon('check')}<h3>Roof & exterior monitoring</h3></div><p>${state.monitoring[p.id]?.frequency||'Monthly'} checks · Alert when condition drops by ${state.monitoring[p.id]?.threshold||'10'} points or surface wear increases.</p><p>Next sample check: November 15, 2026</p><small>Demo schedule saved in this browser · No emails are sent</small></div><div class="story-suggestions">${button('Show monitored properties','watchlist')}${button('Simulate future roof condition','prompt','','data-prompt="Simulate the roof in five years"')}${button('Pause monitoring','prompt','','data-prompt="Stop monitoring this building"')}</div>`}`;
    if(m.type==='pending')content=`<div class="story-pending" role="status"><div class="story-pending-top"><span class="story-flex"><span class="story-spinner"></span><span data-stage-text>${esc(state.simulation?.stage||'Preparing the roof model')}</span></span><span class="story-eyebrow">Simulation</span></div><p style="font-size:11px;color:#939391;margin-top:10px">The map is showing the same scenario as it develops.</p><div class="story-progress"><span style="--progress:${state.simulation?.progress||12}%"></span></div>${button('Cancel simulation','cancel-simulation','quiet')}</div>`;
    if(m.type==='simulation')content=resultMarkup(m);
    if(m.type==='explain')content=`<h2>Where the wear comes from.</h2><p>The warm-colored zones show an illustrative concentration of surface wear near roof edges and drains. Repeated wetting and drying can stress membrane seams; pooled water can increase exposure in low points.</p><p>I’ve returned the map to the projected roof so you can inspect those areas. The baseline image represents the same roof before the simulated changes.</p><p class="story-source">Scripted demo explanation · No actual deterioration model has run</p>`;
    if(m.type==='area')content=`<h2>A wider view, connected.</h2><p>${m.ids.length?`${m.ids.length} sample properties fall inside your drawn area. Select a property below to continue its story.`:'There are no sample properties inside this area. Try drawing around the purple markers.'}</p>${m.ids.map(id=>property(id)).filter(Boolean).map(p=>row(p)).join('')}`;
    if(m.type==='note')content=`<p>${esc(m.text)}</p>`;
    if(m.type==='help')content=`<h2>Let’s start with a place.</h2><p>${esc(m.text||'Choose one of the sample properties below. Then ask for information, add it to monitoring, or simulate its roof in five years.')}</p>${properties.slice(0,3).map(p=>row(p)).join('')}`;
    return `<article class="story-message assistant" data-message="${m.id}" data-message-type="${m.type}"><div class="story-assistant-label"><img src="geolava-assets/Geolava-assistant.png" alt="Geolava assistant"></div>${content}</article>`;
  }
  function monitoringSettings(p) {
    const config=state.monitoring[p.id]||{frequency:'Monthly',threshold:'10'};
    return `<section class="story-settings" aria-label="Monitoring settings"><form id="story-monitoring-form"><div class="story-flex" style="justify-content:space-between"><h3>Monitoring settings</h3>${button('Close','close-settings','quiet')}</div><label class="story-setting-toggle"><input type="checkbox" id="story-monitor-enabled" ${state.monitored.has(p.id)?'checked':''}> Monitor this property</label><label for="story-monitor-frequency">Assessment schedule</label><select id="story-monitor-frequency">${['Weekly','Monthly','Quarterly'].map(v=>`<option ${config.frequency===v?'selected':''}>${v}</option>`).join('')}</select><label for="story-monitor-threshold">Alert on condition decline</label><select id="story-monitor-threshold">${['5','10','20'].map(v=>`<option value="${v}" ${config.threshold===v?'selected':''}>${v} points</option>`).join('')}</select><div class="story-flex" style="margin-top:16px"><button type="submit" class="story-btn primary">Save settings</button></div></form></section>`;
  }
  function propertyHeader(p,chat=false) {
    const bookmarked=!!currentSession()?.bookmarked;
    const chatActions=button('<img src="Icons/bookmark-icon.svg" width="18" height="18" alt="">','bookmark-chat','story-header-bookmark',`aria-label="Bookmark" aria-pressed="${bookmarked}" title="${bookmarked?'Remove bookmark':'Bookmark'}"`)+button('<img src="Icons/Share-icon.svg" width="18" height="18" alt="">Share','share-chat','story-header-share');
    return `<header class="story-chat-header story-property-header">${!chat&&p?.groupId?`<button class="story-property-back" data-story-action="monitor-group" aria-label="Back to City portfolio">${icon('back')}</button>`:''}${chat?`<button class="story-property-back" data-story-action="property" aria-label="Property overview" title="Property overview">${icon('back')}</button>`:''}<h1 class="story-header-title" title="${esc(p?.address||'Explore an area')}">${esc(p?.address||'Explore an area')}</h1><div class="story-header-actions">${chat?chatActions:p?button('Monitoring settings','settings','story-header-settings','aria-expanded="'+state.settingsOpen+'"'):''}</div>${!chat&&p&&state.settingsOpen?monitoringSettings(p):''}</header>`;
  }
  function assessmentCategories(p) {
    const offset=Math.max(0,properties.indexOf(p))*2;
    return [
      {id:'roof',name:'Roof',color:'#6266E6',confidence:92,suggestions:['Inspect and reseal worn membrane seams.','Clear roof drains and remove standing debris.','Record roof photos to track surface wear.'],score:p.score,status:p.status,icon:'monitor',detail:'Surface wear is concentrated near membrane seams. The main roof area remains intact.',advice:'Arrange a roof inspection, seal open membrane seams, and record photos of the worn areas to compare at the next check.'},
      {id:'sidewalk',name:'Sidewalks',color:'#d0ad43',confidence:88,suggestions:['Level the uneven paving at the entrance.','Repair the visible crack before it spreads.','Check the accessible route for trip hazards.'],score:72+offset,status:'Needs a look',icon:'cursor',detail:'Uneven paving and a small crack are visible near the main entrance.',advice:'Have the uneven paving inspected for trip hazards and ask the property manager to plan a level, accessible repair.'},
      {id:'roads',name:'Roads & access',color:'#5685c9',confidence:86,suggestions:[],score:85+offset,status:'Good',icon:'draw',detail:'Road surfaces look sound and the building entrance is easy to access.',advice:'Keep loading access clear, document any developing potholes, and coordinate road repairs with the local authority.'},
      {id:'drainage',name:'Drainage',color:'#c65d56',confidence:90,suggestions:['Remove leaves and debris from the curb inlet.','Check runoff during the next rainfall.','Arrange an inspection if water keeps pooling.'],score:68+offset,status:'Needs a look',icon:'rain',detail:'Debris near the curb inlet may slow runoff during heavy rain.',advice:'Clear accessible debris, check that water can reach the inlet, and have persistent pooling reviewed by a drainage professional.'},
      {id:'greenery',name:'Greenery',color:'#78946b',confidence:89,suggestions:[],score:88+offset,status:'Good',icon:'spark',detail:'Healthy tree cover adds shade, with clear separation from the roof and access routes.',advice:'Schedule routine pruning with an arborist and keep branches and fallen leaves clear of roof drains.'}
    ];
  }
  function renderAssessment() {
    const p=property(state.active);
    screen.innerHTML=`<div class="story-topline assessment-topbar">${button('Back to home','home','quiet')}<span class="story-eyebrow">Property assessment <time datetime="2026-10-19">Oct 19, 2026</time></span></div><div class="assessment-overview"><img src="geolava-assets/Geolava-assistant.png" alt="Geolava assistant"><h1>The property is in fair shape, with drainage and sidewalk repairs worth a closer look.</h1></div><div class="assessment-property-heading"><h2>${esc(p.address)}</h2><p>${esc(p.type)} · San Francisco</p></div><div class="assessment-dashboard">${assessmentCategories(p).map(c=>{const score=Math.min(98,c.score);return `<section class="assessment-category" id="assessment-${c.id}" data-assessment-category="${c.id}" tabindex="0" aria-haspopup="dialog" aria-label="${c.name} assessment; right-click to ask the assistant" style="--category-color:${c.color}"><div class="assessment-category-head"><span class="property-prompt-icon">${icon(c.icon)}</span><h2>${c.name}</h2>${button('Locate on map','assessment-locate','',`data-category="${c.id}"`)}</div><div class="assessment-condition-chart"><div class="assessment-chart-label"><span>${c.status}</span><span class="assessment-score">${score}<small> / 100</small></span></div><div class="assessment-chart" role="meter" aria-label="${c.name} condition" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${score}" aria-valuetext="${score} out of 100, ${c.status}"><span style="width:${score}%"></span></div><div class="assessment-chart-scale"><span>Poor</span><span>Excellent</span></div></div><div class="assessment-confidence">Assessment confidence <strong>${c.confidence}%</strong></div><p>${c.detail}</p>${c.suggestions.length?`<h3 class="assessment-suggestions-title">Recommended next steps</h3><ol class="assessment-recommendations">${c.suggestions.map(item=>`<li>${item}</li>`).join('')}</ol>`:button('<img src="geolava-assets/Geolava-assistant.png" alt="" width="20" height="20">What can go wrong in the future?','assessment-future','',`data-category="${c.id}"`)}</section>`;}).join('')}</div>`;
  }
  function openAssessment(id) {
    cancelSimulation();clearInput();state.simulation=null;state.area=[];state.settingsOpen=false;state.session=null;state.page='assessment';focusProperty(id);screen.scrollTop=0;render();announce('Assessment results for '+property(id).address);
  }
  function updateAssessmentSuggestions(inputId='assessment-address',resultsId='assessment-address-results') {
    const input=$('#'+inputId),results=$('#'+resultsId);
    if(!input||!results)return;
    input.removeAttribute('aria-activedescendant');
    const query=normalize(input.value);
    const matches=query?properties.filter(p=>normalize(p.address+' '+p.name+' San Francisco').includes(query)):[];
    results.innerHTML=matches.length?matches.map(p=>`<button type="button" role="option" aria-selected="false" data-assessment-address="${p.id}">${icon('pin')}<span>${esc(p.address)}<small>San Francisco</small></span></button>`).join(''):'<p>No matching sample address. Try 101 Market Street or 580 Howard Street.</p>';
    results.hidden=!query;input.setAttribute('aria-expanded',String(!!query));
  }
  function renderProperty() {
    const p=property(state.active);if(!p){navigate('home');return;}
    const chats=state.history.filter(s=>s.propertyId===p.id);
    screen.innerHTML=`${propertyUpdates(p)}<section class="story-section"><h2>Explore this property</h2>${suggestions(p)}</section><section class="story-section property-details"><h2>Property details</h2><p>${esc(p.name)} · ${esc(p.type)} · San Francisco</p><div class="story-facts"><div class="story-fact"><small>Roof condition</small><strong>${p.score}<span style="font-size:11px;color:#939391"> / 100</span></strong></div><div class="story-fact"><small>Building area</small><strong>${p.area}</strong></div><div class="story-fact"><small>Roof type</small><strong>${p.roof}</strong></div></div></section><section class="story-section"><div class="story-section-head"><h2>Chats about this property</h2>${button('NEW CHAT','new-chat','new-chat-button')}</div>${chats.map(chat=>chatRow(chat)).join('')||'<p class="story-empty">No chats yet. Start with a question above or type one below.</p>'}</section>`;
  }
  function renderChat() {
    const session=currentSession(),p=property(state.active);
    let log=$('#story-messages',screen);
    if(!log||log.dataset.session!==(session?.id||'')){
      screen.innerHTML=`<div id="story-messages" role="log" aria-label="Conversation" data-session="${session?.id||''}"></div>`;
      log=$('#story-messages',screen);
    }
    if(!session?.messages.length){log.innerHTML=`<div class="story-chat-start"><h2>A new conversation.</h2><p>What would you like to explore about ${esc(p?.address||'this area')}?</p>${p?suggestions(p):''}</div>`;return;}
    $('.story-chat-start',log)?.remove();
    for(const message of session.messages) {
      const existing=Array.from(log.children).find(el=>el.dataset.message===message.id);
      if(!existing)log.insertAdjacentHTML('beforeend',messageMarkup(message));
      else if(existing.dataset.messageType!==message.type)existing.outerHTML=messageMarkup(message);
    }
  }

  function render({scroll=false}={}) {
    closeAssessmentQuickChat();
    screen.classList.toggle('is-home',state.page==='home');
    document.body.classList.toggle('story-property-open',['property','chat'].includes(state.page));
    document.body.classList.toggle('story-assessment-mode',['home','assessment','group'].includes(state.page));
    screen.style.paddingBottom=['home','assessment','group'].includes(state.page)?'32px':($('.home-chat-wrap').getBoundingClientRect().height+28)+'px';
    if(state.page==='home')renderHome();else if(state.page==='group')renderPortfolio();else if(state.page==='assessment')renderAssessment();else if(state.page==='property')renderProperty();else if(state.page==='chat')renderChat();else renderCollection(state.page);
    $('#story-header-slot').innerHTML=['property','chat'].includes(state.page)?propertyHeader(property(state.active),state.page==='chat'):'';
    const active=state.page==='history'?'History':state.page==='watchlist'?'Watchlist':'Home';
    document.querySelectorAll('.sidebar-nav-item').forEach(el=>{const yes=el.title===active;el.classList.toggle('active',yes);el.setAttribute('aria-label',el.title);if(yes)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    updateContext();updateMarkers();setHighlight(!!state.simulation);updatePortfolioMap();renderMap();
    requestAnimationFrame(updateCarouselControls);
    if(scroll)scrollBottom();
  }
  function scrollBottom() {
    cancelAnimationFrame(screenFrame);screenFrame=requestAnimationFrame(()=>{const last=$('.story-message:last-child',screen);if(last)screen.scrollTo({top:Math.max(0,last.offsetTop-95),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
  }
  function updateContext() {
    const p=property(state.active),el=$('#story-context');
    el.classList.remove('visible');el.innerHTML='';
    homeInput.placeholder=' ';
  }

  function createSession(p) {
    const s={id:uid(),propertyId:p.id,title:'New chat',createdAt:Date.now(),updatedAt:Date.now(),messages:[]};state.history.unshift(s);state.history=state.history.slice(0,20);state.session=s.id;return s;
  }
  function currentSession(){return state.history.find(s=>s.id===state.session);}
  function addMessage(type,data={}) {const s=currentSession()||createSession(property(state.active)||properties[0]);const m={id:uid(),type,propertyId:state.active,...data};s.messages.push(m);s.updatedAt=Date.now();return m;}
  function clearInput(){homeInput.value='';homeChat.classList.remove('has-text');hideSuggestions();clearActiveModes();}
  function focusProperty(id,{camera=true}={}) {
    if(state.active!==id){
      if(state.simulation?.running)cancelSimulation();
      state.simulation=null;
      if(currentSession()?.propertyId!==id)state.session=null;
    }
    state.active=id;hovered=null;updateContext();updateMarkers();setHighlight();
    const p=property(id);if(camera&&p)map.flyTo({...propertyCamera(p),duration:1400,essential:false});
    renderMap();
  }
  function openProperty(id) {
    cancelSimulation();clearInput();state.simulation=null;state.area=[];state.settingsOpen=false;state.selectedUpdate=null;state.page='property';state.session=null;focusProperty(id);screen.scrollTop=0;render();
  }
  function newChat() {
    cancelSimulation();clearInput();state.simulation=null;state.settingsOpen=false;state.session=null;state.page='chat';screen.scrollTop=0;render();homeInput.focus();
  }

  const normalize = text => text.toLowerCase().replace(/\bst\b\.?/g,'street').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  function matchProperty(text) {
    const q=normalize(text);
    return properties.find(p=>q.includes(normalize(p.address))||q.includes(normalize(p.name)))||properties.find(p=>q.includes(p.address.split(' ').slice(0,2).join(' ').toLowerCase()));
  }
  function submit(text,{issue=null}={}) {
    text=text.trim();if(!text)return;
    clearInput();const match=matchProperty(text);
    if(match&&match.id!==state.active){cancelSimulation();state.simulation=null;state.session=null;focusProperty(match.id);}
    if(!state.active&&match)focusProperty(match.id);
    state.settingsOpen=false;state.page='chat';if(!currentSession())createSession(property(state.active)||properties[0]);
    if(!currentSession().messages.length)currentSession().title=text.slice(0,70);
    addMessage('user',{text});
    const p=property(state.active);
    if(!p) {addMessage('help',{text:'This demo uses a small sample portfolio. Try 101 Market Street, San Francisco to see the building highlight and continue the conversation.'});persist();render({scroll:true});return;}
    if(issue) {
      addMessage('issue-help',{issueTitle:issue.title,issueDetail:issue.detail});setHighlight(true);
    } else if(/\b(stop|pause|remove|cancel|do not|don t)\b.*\bmonitor|\bunmonitor/i.test(text)) {
      state.monitored.delete(p.id);addMessage('monitor',{removed:true});announce('Monitoring paused for '+p.address);
    } else if(/\bmonitor|\bwatch\b|\btrack\b|\balert/i.test(text)) {
      state.monitored.add(p.id);addMessage('monitor',{removed:false});announce('Monitoring enabled for '+p.address);
    } else if(/\b(explain|why|changes|impact)\b/i.test(text)&&currentSession().messages.some(m=>m.type==='simulation')) {
      const result=[...currentSession().messages].reverse().find(m=>m.type==='simulation');activateResult(result,2026+result.horizon);addMessage('explain');
    } else if(/\b(simulat|future|years?|happen|forecast|project|rain)/i.test(text)) {
      const years=text.match(/\b(\d{1,2})\s*years?\b/i),words=/\bten\b/i.test(text)?10:/\bthree\b/i.test(text)?3:/\bone year\b/i.test(text)?1:5;
      runSimulation(Math.min(10,Math.max(1,years?+years[1]:words)));return;
    } else if(match&&!/more|detail|information|condition|roof/i.test(text)) { addMessage('asset');setHighlight(); }
    else { addMessage('info');setHighlight(true); }
    persist();render({scroll:true});
  }
  function projectedScore(p,year){return Math.round(p.score-(year-2026)*4.2);}
  function wearAt(year){return Math.round(8+(year-2026)*4.8);}
  function cancelSimulation() {
    simulationTimers.forEach(clearTimeout);simulationTimers=[];
    if(!state.simulation?.running)return;
    const s=state.history.find(s=>s.id===state.simulation.sessionId),m=s?.messages.find(m=>m.id===state.simulation.pendingId);
    if(m){m.type='note';m.text='Simulation paused. Ask to run it again when you’re ready.';}
    state.simulation=null;persist();setHighlight();renderMap();announce('Simulation cancelled.');
  }
  function runSimulation(horizon) {
    cancelSimulation();clearActiveModes();
    const p=property(state.active);if(!p)return;
    const pending=addMessage('pending');const token=uid();
    state.simulation={running:true,token,propertyId:p.id,sessionId:state.session,pendingId:pending.id,year:2026,horizon,progress:12,stage:'Reading the roof geometry'};
    render({scroll:true});setHighlight(true);
    map.flyTo({...propertyCamera(p),duration:1600,essential:false});
    announce('Roof simulation started. Reading the roof geometry.');
    const step=(delay,progress,stage,fraction)=>simulationTimers.push(setTimeout(()=>{
      if(state.simulation?.token!==token)return;
      Object.assign(state.simulation,{progress,stage,year:2026+Math.round(horizon*fraction)});
      document.querySelectorAll('[data-stage-text]').forEach(el=>el.textContent=stage);
      document.querySelectorAll('.story-progress span').forEach(el=>el.style.setProperty('--progress',progress+'%'));
      setHighlight(true);renderMap();announce(stage);
    },delay));
    step(1500,38,'Applying rainfall & seasonal exposure',.3);
    step(3200,72,'Projecting membrane wear & drainage stress',.7);
    step(4700,94,'Comparing the roof before and after',1);
    simulationTimers.push(setTimeout(()=>{
      if(state.simulation?.token!==token)return;
      pending.type='simulation';pending.horizon=horizon;
      state.simulation={running:false,propertyId:p.id,resultId:pending.id,year:2026+horizon,horizon};
      simulationTimers=[];persist();setHighlight(true);render({scroll:true});announce('Simulation complete. Compare the baseline and projected roof in chat and on the map.');
    },5900));
  }
  function activateResult(m,year) {
    if(!m)return;cancelSimulation();focusProperty(m.propertyId,{camera:state.active!==m.propertyId});
    state.simulation={running:false,propertyId:m.propertyId,resultId:m.id,year,horizon:m.horizon};
    setHighlight(true);renderMap();updateResultUI(m);
  }
  function updateResultUI(m) {
    if(!m||!state.simulation)return;
    const year=state.simulation.year,p=property(m.propertyId),metrics=$(`[data-result-metrics="${m.id}"]`);
    if(metrics){$('[data-output-year]',metrics).textContent=Number.isInteger(year)?year:timelineDate(year);$('[data-output-score]',metrics).textContent=projectedScore(p,year);$('[data-output-wear]',metrics).textContent=wearAt(year);}
    const frames=$(`[data-result="${m.id}"]`);
    if(frames)frames.querySelectorAll('button').forEach((el,i)=>{const on=i===0?year===2026:year>2026;el.classList.toggle('active',on);el.setAttribute('aria-pressed',on);});
    document.querySelectorAll(`[data-story-year="${m.id}"]`).forEach(el=>el.value=year);
  }
  function findResult(id){return state.history.flatMap(s=>s.messages).find(m=>m.id===id&&m.type==='simulation');}
  function setYear(id,year) {
    const m=findResult(id);if(!m)return;
    year=Math.max(2026,Math.min(2026+m.horizon,Number(year)));
    if(state.simulation?.resultId!==id)activateResult(m,year);
    else state.simulation.year=year;
    setHighlight(true);updateResultUI(m);
    const date=$('[data-timeline-date]');if(date)date.textContent=timelineDate(year);
  }
  // A demo roof footprint: geographic coordinates keep every effect attached to the map.
  function roofPoint(p,u,v) { const x=(u-.5)*.00050,y=(v-.5)*.00032,angle=-.38;return [p.lng+x*Math.cos(angle)-y*Math.sin(angle),p.lat+x*Math.sin(angle)*.79+y*Math.cos(angle)]; }
  function roofRing(p,u0=0,v0=0,u1=1,v1=1) {const points=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>roofPoint(p,u,v));return [...points,points[0]];}
  function sceneCenter(p) {
    const geometry=footprints.get(p.id);
    return geometry?turf.centerOfMass({type:'Feature',geometry,properties:{}}).geometry.coordinates:[p.lng,p.lat];
  }
  function propertyCamera(p) {
    return {center:sceneCenter(p),zoom:17.6,pitch:48,bearing:-18};
  }
  function resolveFootprint() {
    const p=property(state.active);if(!p||footprints.has(p.id)||!map.isStyleLoaded())return;
    let candidates=[];
    for(const [id,source] of Object.entries(map.getStyle().sources)) {
      if(source.type!=='vector')continue;
      try {candidates.push(...map.querySourceFeatures(id,{sourceLayer:'building'}));}catch{}
    }
    let nearest=null,distance=Infinity;
    for(const feature of candidates) {
      if(!['Polygon','MultiPolygon'].includes(feature.geometry.type))continue;
      try {
        const center=turf.centerOfMass(feature).geometry.coordinates;
        const d=turf.distance([p.lng,p.lat],center,{units:'meters'});
        if(d<distance&&d<110){nearest=feature;distance=d;}
      }catch{}
    }
    if(nearest){
      footprints.set(p.id,JSON.parse(JSON.stringify(nearest.geometry)));
      buildingHeights.set(p.id,Math.max(3,Number(nearest.properties?.height)||12));
      roofHighlightCache.delete(p.id);
      surroundingsCache.delete(p.id);
      refreshSatelliteRoofs(p);
      updateMarkers();setHighlight(!!state.simulation);renderMap();
      map.easeTo({...propertyCamera(p),duration:900});
    }
  }
  function buildingGeometry(p){return footprints.get(p.id)||{type:'Polygon',coordinates:[roofRing(p)]};}
  // Inset contour bands keep the fade inside irregular roofs, including courtyards.
  // Flat fill layers keep the highlight attached to the satellite footprint.
  function roofHighlight(p) {
    if(roofHighlightCache.has(p.id))return roofHighlightCache.get(p.id);
    const roof=turf.feature(buildingGeometry(p)),height=(buildingHeights.get(p.id)||18)+.2;
    const bounds=turf.bbox(roof);
    let low=0,high=turf.distance([bounds[0],bounds[1]],[bounds[2],bounds[3]],{units:'meters'});
    const inset=distance=>turf.buffer(roof,-distance,{units:'meters',steps:4});
    for(let i=0;i<12;i++){const mid=(low+high)/2;try{if(inset(mid))low=mid;else high=mid;}catch{high=mid;}}
    const features=[];
    let outer=roof;
    for(let band=0;band<32;band++){
      const inner=inset(low*(band+1)/32);
      const strip=inner?turf.difference(turf.featureCollection([outer,inner])):outer;
      if(strip){strip.properties={band,height};features.push(strip);}
      if(!inner)break;
      outer=inner;
    }
    const innerStroke=inset(Math.max(.5,Math.min(1.8,(buildingHeights.get(p.id)||18)/80)));
    const stroke=innerStroke?turf.difference(turf.featureCollection([roof,innerStroke])):roof;
    if(stroke){stroke.properties={band:-1,height:height+.03};features.push(stroke);}
    const data=turf.featureCollection(features);roofHighlightCache.set(p.id,data);return data;
  }
  function surroundingGeometry(p){
    if(surroundingsCache.has(p.id))return surroundingsCache.get(p.id);
    const roof=turf.feature(buildingGeometry(p)),bounds=turf.bbox(roof),center=turf.center(roof).geometry.coordinates;
    const width=turf.distance([bounds[0],center[1]],[bounds[2],center[1]],{units:'meters'});
    const depth=turf.distance([center[0],bounds[1]],[center[0],bounds[3]],{units:'meters'});
    const point=(x,y)=>turf.destination(center,Math.hypot(x,y),Math.atan2(x,y)*180/Math.PI,{units:'meters'}).geometry.coordinates;
    const rectangle=(x,y,w,h)=>turf.polygon([[point(x-w/2,y-h/2),point(x+w/2,y-h/2),point(x+w/2,y+h/2),point(x-w/2,y+h/2),point(x-w/2,y-h/2)]]);
    const clearance=turf.buffer(roof,2,{units:'meters'});
    const areas=[
      {eventId:'canopy',geometry:turf.circle(point(-width/2-10,depth*.3),18,{units:'meters',steps:48})},
      {eventId:'shopping',geometry:rectangle(width/2+30,depth/2+12,42,32)},
      {eventId:'sidewalk',geometry:rectangle(0,-depth/2-8,width+26,10)},
      {eventId:'sidewalk',geometry:rectangle(width/2+15,-depth*.25,22,32)}
    ].map((area,index)=>{const clipped=clearance?turf.difference(turf.featureCollection([area.geometry,clearance])):area.geometry;if(!clipped)return null;clipped.id=index;clipped.properties={eventId:area.eventId};return clipped;}).filter(Boolean);
    surroundingsCache.set(p.id,areas);return areas;
  }
  function updateSurroundingImpacts(p,sim){
    const features=p&&sim?surroundingGeometry(p).map(feature=>{
      const event=timelineEvents.find(event=>event.id===feature.properties.eventId),category=timelineCategories[event.category];
      // Each zone builds up in the months leading to its timeline event.
      const progress=Math.max(0,Math.min(1,(sim.year-event.year+.75)/.75));
      return {...feature,properties:{...feature.properties,color:category.color,opacity:.38*progress,lineOpacity:.85*progress}};
    }):[];
    updateSource('story-context-impacts',turf.featureCollection(features));
  }
  function assessmentMapFeatures(p) {
    if(!p)return [];
    const roof=turf.feature(buildingGeometry(p)),bounds=turf.bbox(roof),w=bounds[2]-bounds[0],h=bounds[3]-bounds[1];
    const box=(x,y,dx,dy)=>turf.bboxPolygon([bounds[0]+w*x,bounds[1]+h*y,bounds[0]+w*(x+dx),bounds[1]+h*(y+dy)]);
    const shapes={roof,sidewalk:box(-.12,-.18,1.24,.12),roads:box(-.25,-.48,1.5,.23),drainage:turf.circle([bounds[0]+w*.85,bounds[1]-.04*h],5,{units:'meters',steps:32}),greenery:turf.circle([bounds[0]-.18*w,bounds[1]+h*.65],10,{units:'meters',steps:40})};
    return assessmentCategories(p).map(c=>({...shapes[c.id],properties:{category:c.id,name:c.name,color:c.color}}));
  }
  function updateAssessmentMap(p) {
    const features=assessmentMapFeatures(p);
    updateSource('story-assessment-areas',turf.featureCollection(features));
    updateSource('story-assessment-labels',turf.featureCollection(features.map(f=>{const point=turf.centerOfMass(f);point.properties=f.properties;return point;})));
  }
  function locateAssessmentCategory(id) {
    const p=property(state.active),feature=assessmentMapFeatures(p).find(f=>f.properties.category===id);
    if(!feature)return;
    map.flyTo({center:turf.centerOfMass(feature).geometry.coordinates,zoom:18,pitch:48,duration:800});
    document.querySelectorAll('.assessment-category').forEach(el=>el.classList.toggle('is-selected',el.id==='assessment-'+id));
  }
  function updateSource(id,data) {const source=map.getSource(id);if(source)source.setData(data);}
  function setHighlight(detail=false) {
    if(!map.isStyleLoaded())return;
    const p=['property','chat','assessment'].includes(state.page)?property(hovered||state.active):null;const empty={type:'FeatureCollection',features:[]};
    updateSource('story-building',p?{type:'FeatureCollection',features:[{type:'Feature',properties:{height:buildingHeights.get(p.id)||18,fallback:!footprints.has(p.id)},geometry:buildingGeometry(p)}]}:empty);
    updateSource('story-building-fade',p?roofHighlight(p):empty);
    const sim=state.simulation,show=!!sim;
    updateSurroundingImpacts(p,sim);
    updateAssessmentMap(state.page==='assessment'?p:null);
    const amount=sim?Math.max(0,(sim.year-2026)/5):0;
    if(map.getLayer('story-roof-impact-fill'))map.setPaintProperty('story-roof-impact-fill','fill-opacity',Math.min(.8,amount*.65));
    let patches=[];
    if(p&&show){
      const building={type:'Feature',geometry:buildingGeometry(p),properties:{}};
      const bounds=turf.bbox(building),w=bounds[2]-bounds[0],h=bounds[3]-bounds[1];
      patches=[[.08,.1,.43,.36],[.55,.53,.96,.92],[.12,.7,.48,.98]].map((box,i)=>{
        const [u0,v0,u1,v1]=box;
        const rect=turf.bboxPolygon([bounds[0]+w*u0,bounds[1]+h*v0,bounds[0]+w*u1,bounds[1]+h*v1]);
        const clipped=turf.intersect(turf.featureCollection([building,rect]));
        if(clipped)clipped.properties={opacity:Math.min(.8,amount*(i===1?.75:.55)),severity:i,height:(buildingHeights.get(p.id)||18)+.3};
        return clipped;
      }).filter(Boolean);
    }
    updateSource('story-roof-impact',{type:'FeatureCollection',features:patches});
  }
  function ensureLayers() {
    const empty={type:'FeatureCollection',features:[]};
    const vector=Object.entries(map.getStyle().sources).find(([,source])=>source.type==='vector');
    if(vector&&!map.getLayer('story-reference-buildings'))map.addLayer({id:'story-reference-buildings',type:'fill',source:vector[0],'source-layer':'building',paint:{'fill-opacity':0}});
    if(!map.getSource('story-portfolio-buildings'))map.addSource('story-portfolio-buildings',{type:'geojson',data:empty});
    if(!map.getLayer('story-portfolio-dots'))map.addLayer({id:'story-portfolio-dots',type:'circle',source:'story-portfolio-buildings',paint:{'circle-radius':6,'circle-color':['case',['get','attention'],'#c65d56','#6266E6'],'circle-stroke-color':'#FEFEFB','circle-stroke-width':2}});
    updatePortfolioMap();
    if(!map.getSource('story-assessment-areas'))map.addSource('story-assessment-areas',{type:'geojson',data:empty});
    if(!map.getSource('story-assessment-labels'))map.addSource('story-assessment-labels',{type:'geojson',data:empty});
    if(!map.getLayer('story-assessment-fill'))map.addLayer({id:'story-assessment-fill',type:'fill',source:'story-assessment-areas',paint:{'fill-color':['get','color'],'fill-opacity':.23}});
    if(!map.getLayer('story-assessment-line'))map.addLayer({id:'story-assessment-line',type:'line',source:'story-assessment-areas',paint:{'line-color':['get','color'],'line-width':2}});
    if(!map.getLayer('story-assessment-label'))map.addLayer({id:'story-assessment-label',type:'symbol',source:'story-assessment-labels',layout:{'text-field':['get','name'],'text-size':12,'text-offset':[0,1.2],'text-allow-overlap':false},paint:{'text-color':'#FEFEFB','text-halo-color':'#282823','text-halo-width':1.5}});
    if(!map.getSource('story-context-impacts'))map.addSource('story-context-impacts',{type:'geojson',data:empty});
    if(!map.getLayer('story-context-impact-fill'))map.addLayer({id:'story-context-impact-fill',type:'fill',source:'story-context-impacts',paint:{'fill-color':['get','color'],'fill-opacity':['get','opacity'],'fill-opacity-transition':{duration:450}}});
    if(!map.getLayer('story-context-impact-line'))map.addLayer({id:'story-context-impact-line',type:'line',source:'story-context-impacts',paint:{'line-color':['get','color'],'line-opacity':['get','lineOpacity'],'line-width':1.5}});
    if(!map.getSource('story-building'))map.addSource('story-building',{type:'geojson',data:empty});
    if(!map.getSource('story-building-fade'))map.addSource('story-building-fade',{type:'geojson',data:empty});
    for(let band=31;band>=-1;band--){
      const id='story-roof-fade-'+band;
      if(!map.getLayer(id))map.addLayer({id,type:'fill',source:'story-building-fade',filter:['==',['get','band'],band],paint:{'fill-color':'#6266E6','fill-opacity':band===-1?1:.3*(1-band/31)}});
    }
    if(!map.getSource('story-roof-impact'))map.addSource('story-roof-impact',{type:'geojson',data:empty});
    if(!map.getLayer('story-roof-impact-fill'))map.addLayer({id:'story-roof-impact-fill',type:'fill',source:'story-roof-impact',paint:{'fill-color':['match',['get','severity'],1,'#d9785b','#e6b57b'],'fill-opacity':.6}});
    setHighlight();
  }
  function updateMarkers() {
    properties.forEach(p=>{
      let marker=markerMap.get(p.id);
      if(!marker){const el=document.createElement('button');el.type='button';el.className='story-marker';el.title=p.address;el.setAttribute('aria-label','Explore '+p.address);el.addEventListener('click',e=>{e.stopPropagation();if(drawMode||commentMode)return;openProperty(p.id);});marker=new mapboxgl.Marker({element:el}).setLngLat([p.lng,p.lat]).addTo(map);el.setAttribute('role','button');markerMap.set(p.id,marker);}
      marker.setLngLat(sceneCenter(p));
      const selected=state.active===p.id&&['property','chat','assessment'].includes(state.page);
      marker.getElement().style.display=(selected||state.page==='group')?'none':'';
      marker.getElement().tabIndex=(selected||state.page==='group')?-1:0;
      marker.getElement().setAttribute('aria-hidden',String(selected||state.page==='group'));
      marker.getElement().className=`story-marker ${state.monitored.has(p.id)?'monitored':''} ${unreadFor(p.id).length&&state.monitored.has(p.id)?'has-updates':''} ${state.active===p.id||hovered===p.id?'active':''}`;
    });
  }
  function renderMap() {
    const root=$('#story-map'),p=property(state.active),sim=state.simulation;
    $('#story-map-recenter').hidden=!p||!['property','chat','assessment'].includes(state.page);
    root.classList.toggle('running',!!sim?.running);
    if(!p){root.innerHTML='';return;}
    if(!$('.story-map-content',root))root.innerHTML='';
    const caption=sim?.running?'Exploring future roof condition':'';
    let dock=state.page==='assessment'?`<div class="assessment-map-key" aria-label="Assessment map categories">${assessmentCategories(p).map(c=>`<button data-story-action="assessment-locate" data-category="${c.id}" style="--category-color:${c.color}"><i></i>${c.name}</button>`).join('')}</div>`:'';
    if(sim?.running) dock=`<div class="story-map-dock" role="status"><span class="story-eyebrow">${icon('rain')} Scenario in progress</span><h3>${esc(sim.stage)}</h3><p>${esc(p.address)} · ${sim.horizon} years of sample exposure</p><div class="story-progress"><span style="--progress:${sim.progress}%"></span></div>${button('Cancel','cancel-simulation','quiet')}</div>`;
    else if(sim){pinnedTimelineEvent=null;dock=timelineMarkup(sim);}

    // Keep the animated weather node alive between stages so it never restarts abruptly.
    const weather=sim?.running?`<div class="story-rain active">${Array.from({length:32},(_,i)=>`<span style="left:${(i*37)%100}%;animation-delay:-${(i%9)*.13}s;animation-duration:${.6+(i%5)*.11}s"></span>`).join('')}</div><div class="story-scan"></div>`:'';
    let weatherNode=$('.story-weather',root);
    if(!weatherNode){weatherNode=document.createElement('div');weatherNode.className='story-weather';root.prepend(weatherNode);}
    if(!!sim?.running!==weatherNode.classList.contains('visible')){
      weatherNode.classList.toggle('visible',!!sim?.running);
      if(sim?.running)weatherNode.innerHTML=weather;
      else { $('.story-rain',weatherNode)?.classList.remove('active');setTimeout(()=>{if(!weatherNode.classList.contains('visible'))weatherNode.innerHTML='';},1000); }
    }
    let content=$('.story-map-content',root);if(!content){content=document.createElement('div');content.className='story-map-content';root.append(content);}
    content.innerHTML=`${caption?`<div class="story-map-caption"><i></i>${esc(caption)}</div>`:''}${dock}`;
  }
  function fitProperties() {const bounds=new mapboxgl.LngLatBounds();properties.forEach(p=>bounds.extend([p.lng,p.lat]));map.fitBounds(bounds,{padding:50,maxZoom:15,pitch:0,bearing:0,duration:1100});}
  function navigate(page) {
    cancelSimulation();clearActiveModes();state.simulation=null;state.page=page;state.settingsOpen=false;state.active=null;state.area=[];state.session=null;hovered=null;screen.scrollTop=0;clearInput();setHighlight();render();fitProperties();history.replaceState(null,'',location.pathname);
  }
  function restoreSession(id) {
    const s=state.history.find(s=>s.id===id);if(!s)return;
    cancelSimulation();clearActiveModes();state.settingsOpen=false;state.session=id;state.page='chat';state.simulation=null;focusProperty(s.propertyId);
    const result=[...s.messages].reverse().find(m=>m.type==='simulation');if(result)activateResult(result,2026+result.horizon);
    render({scroll:true});
  }
  function hideSuggestions() {state.suggestions=[];state.suggestionIndex=-1;addrSuggest.classList.remove('open');addrSuggest.innerHTML='';}
  function localSuggestions() {
    const q=normalize(homeInput.value);state.suggestions=q.length>=2?properties.filter(p=>normalize(p.address).includes(q)||normalize(p.name).includes(q)):[];state.suggestionIndex=-1;
    addrSuggest.innerHTML=state.suggestions.map(p=>`<button type="button" role="option" aria-selected="false" class="addr-suggest-item" data-story-suggestion="${p.id}">${icon('pin')}<span class="addr-suggest-text"><span class="addr-suggest-title">${p.address}</span><span class="addr-suggest-sub">San Francisco · Demo property</span></span></button>`).join('');
    addrSuggest.classList.toggle('open',state.suggestions.length>0);
  }
  function chooseLocal(id) {homeInput.value=property(id).address+', San Francisco';homeChat.classList.add('has-text');focusProperty(id);hideSuggestions();homeInput.focus();announce(property(id).address+' highlighted on the map. Press Enter to explore.');}
  homeInput.addEventListener('input',e=>{e.stopImmediatePropagation();homeChat.classList.toggle('has-text',!!homeInput.value.trim());localSuggestions();},true);
  homeInput.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    if(['ArrowDown','ArrowUp'].includes(e.key)&&state.suggestions.length){e.preventDefault();e.stopImmediatePropagation();state.suggestionIndex=Math.max(0,Math.min(state.suggestions.length-1,state.suggestionIndex+(e.key==='ArrowDown'?1:-1)));addrSuggest.querySelectorAll('[role=option]').forEach((el,i)=>{el.classList.toggle('active',i===state.suggestionIndex);el.setAttribute('aria-selected',i===state.suggestionIndex);});return;}
    if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();if(state.suggestionIndex>=0){chooseLocal(state.suggestions[state.suggestionIndex].id);return;}submit(homeInput.value);}
    if(e.key==='Escape')hideSuggestions();
  },true);
  homeSend.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();submit(homeInput.value);},true);
  addrSuggest.addEventListener('mousedown',e=>{const el=e.target.closest('[data-story-suggestion]');if(el){e.preventDefault();e.stopImmediatePropagation();chooseLocal(el.dataset.storySuggestion);}});
  document.addEventListener('input',e=>{if(e.target.id==='assessment-address')updateAssessmentSuggestions();if(e.target.id==='welcome-address')updateAssessmentSuggestions('welcome-address','welcome-address-results');});
  document.addEventListener('click',e=>{
    const option=e.target.closest('[data-assessment-address]');
    if(option){const id=option.dataset.assessmentAddress;if($('#welcome-flow'))finishOnboarding();openAssessment(id);return;}
    if(!e.target.closest('.assessment-search-box')){const results=$('#assessment-address-results');if(results){results.hidden=true;$('#assessment-address').setAttribute('aria-expanded','false');}}
  });
  document.addEventListener('keydown',e=>{
    if(!['assessment-address','welcome-address'].includes(e.target.id))return;
    const results=$(e.target.id==='welcome-address'?'#welcome-address-results':'#assessment-address-results'),options=[...results.querySelectorAll('[role="option"]')];
    if(e.key==='Escape'){results.hidden=true;e.target.setAttribute('aria-expanded','false');return;}
    if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();results.hidden=false;e.target.setAttribute('aria-expanded','true');const current=options.findIndex(o=>o.getAttribute('aria-selected')==='true');const index=Math.max(0,Math.min(options.length-1,current+(e.key==='ArrowDown'?1:-1)));options.forEach((o,i)=>{o.setAttribute('aria-selected',String(i===index));o.id='assessment-option-'+i;});if(options[index])e.target.setAttribute('aria-activedescendant',options[index].id);}
    if(e.key==='Enter'){e.preventDefault();const option=options.find(o=>o.getAttribute('aria-selected')==='true')||options[0];if(option){const id=option.dataset.assessmentAddress;if($('#welcome-flow'))finishOnboarding();openAssessment(id);}}
  });
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-story-action],[data-story-property],[data-story-session],[data-story-notification]');if(!el)return;
    if(el.dataset.storyNotification){
      openProperty(el.dataset.propertyId);state.selectedUpdate=el.dataset.storyNotification;render();setHighlight(true);
      requestAnimationFrame(()=>{const update=$('#update-'+el.dataset.storyNotification);if(update)screen.scrollTo({top:Math.max(0,update.offsetTop-120),behavior:'smooth'});});
      return;
    }
    if(el.dataset.storyProperty){openProperty(el.dataset.storyProperty);return;}
    if(el.dataset.storySession){restoreSession(el.dataset.storySession);return;}
    const action=el.dataset.storyAction;
    if(action==='home'||action==='watchlist'||action==='history')navigate(action);
    else if(action==='monitor-group')openPortfolio();
    else if(action==='portfolio-page'){groupPage=Number(el.dataset.page);$('#portfolio-buildings').innerHTML=portfolioRows();$('.portfolio-results-count').focus({preventScroll:true});screen.scrollTo({top:Math.max(0,$('.portfolio-filters').offsetTop-20),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
    else if(action==='try-address'){homeInput.value='101 Market Street, San Francisco';homeChat.classList.add('has-text');focusProperty('market');homeInput.focus();}
    else if(action==='monitor-previous'||action==='monitor-next'){
      const rail=$('#monitor-carousel'),card=rail?.querySelector('.monitor-card');
      if(rail&&card)rail.scrollBy({left:(card.getBoundingClientRect().width+14)*(action==='monitor-next'?1:-1),behavior:'smooth'});
    }
    else if(action==='review-updates'){updatesFor(state.active).forEach(update=>state.reviewed.add(update.id));persist();render();toast('Monitoring updates marked as reviewed.');}
    else if(action==='property')openProperty(state.active);
    else if(action==='new-chat')newChat();
    else if(action==='assessment-locate')locateAssessmentCategory(el.dataset.category);
    else if(action==='assessment-future'){const c=assessmentCategories(property(state.active)).find(c=>c.id===el.dataset.category);if(c){newChat();const text=`What can go wrong with ${c.name.toLowerCase()} at ${property(state.active).address} in the future?`;createSession(property(state.active));currentSession().title=text;addMessage('user',{text});addMessage('assessment-outlook',{category:c.id});persist();render({scroll:true});}}
    else if(action==='assessment-help'){const category=assessmentCategories(property(state.active)).find(c=>c.id===el.dataset.category);if(category){newChat();submit(`How can I improve ${category.name.toLowerCase()} at ${property(state.active).address}?`,{issue:{title:category.name,detail:category.advice}});}}
    else if(action==='issue-chat'){
      const issue=updatesFor(state.active).find(update=>update.id===el.dataset.issueId);
      if(issue){newChat();submit(`What can I do about ${issue.title.toLowerCase()} at ${property(state.active).address}?`,{issue});}
    }
    else if(action==='bookmark-chat'){const session=currentSession()||createSession(property(state.active));session.bookmarked=!session.bookmarked;persist();render();toast(session.bookmarked?'Conversation bookmarked.':'Bookmark removed.');}
    else if(action==='share-chat'){const session=currentSession();if(!session?.messages.length){toast('Start a conversation before sharing.');return;}const transcript=property(state.active).address+'\n\n'+[...document.querySelectorAll('#story-messages .story-message')].map(el=>el.innerText).join('\n\n');navigator.clipboard.writeText(transcript).then(()=>toast('Conversation copied for sharing.'),()=>toast('Copy unavailable. Select the conversation text to share it.'));}
    else if(action==='settings'){state.settingsOpen=!state.settingsOpen;render();}
    else if(action==='close-settings'){state.settingsOpen=false;render();}
    else if(action==='prompt')submit(el.dataset.prompt);
    else if(action==='ask'){($('#assessment-address')||homeInput).focus();}
    else if(action==='pick'){clearActiveModes();openComment();toast(state.page==='home'?'Pick a location on the map to assess the nearest sample property.':'Pick a location on the map, then ask about it.');}
    else if(action==='draw'){clearActiveModes();drawChipSlot.classList.add('show');enterDrawMode();toast('Draw a closed loop around the properties you want to explore.');}
    else if(action==='refocus')focusProperty(state.active);
    else if(action==='timeline-event'){const event=timelineEvents.find(event=>event.id===el.dataset.eventId),id=el.dataset.resultId||state.simulation?.resultId;if(event&&id){setYear(id,event.year);showTimelineEvent(event.id,true);}}
    else if(action==='timeline-close')closeTimelineEvent();
    else if(action==='cancel-simulation'){cancelSimulation();render();}
    else if(action==='preview-year')activateResult(findResult(el.dataset.resultId),Number(el.dataset.year));
    else if(action==='replay'){const m=findResult(el.dataset.resultId);if(m){focusProperty(m.propertyId);addMessage('user',{text:`Replay the ${m.horizon}-year roof simulation`});runSimulation(m.horizon);}}
  });
  document.addEventListener('load',e=>{if(e.target.matches?.('.satellite-roof img'))e.target.parentElement.classList.add('image-loaded');},true);
  document.addEventListener('error',e=>{if(e.target.matches?.('.satellite-roof img')){const frame=e.target.parentElement;frame.classList.add('image-unavailable');$('.satellite-image-status',frame).textContent='Satellite imagery unavailable';}},true);
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.timeline-event,.timeline-event-popover'))closeTimelineEvent();});
  $('#story-map').addEventListener('pointerover',e=>{if(e.target.closest('.timeline-event,.timeline-event-popover'))clearTimeout(timelineHoverTimer);const event=e.target.closest('.timeline-event');if(event)showTimelineEvent(event.dataset.eventId);});
  $('#story-map').addEventListener('pointerout',e=>{const area=e.target.closest('.timeline-event,.timeline-event-popover');if(area&&!area.contains(e.relatedTarget))timelineHoverTimer=setTimeout(()=>{if(pinnedTimelineEvent)showTimelineEvent(pinnedTimelineEvent);else closeTimelineEvent();},180);});
  $('#story-map').addEventListener('pointerleave',()=>{if(pinnedTimelineEvent)showTimelineEvent(pinnedTimelineEvent);else closeTimelineEvent();});
  $('#story-map').addEventListener('focusin',e=>{const event=e.target.closest('.timeline-event');if(event)showTimelineEvent(event.dataset.eventId);});
  $('#story-map').addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeTimelineEvent();}});
  screen.addEventListener('scroll',e=>{if(e.target.id==='monitor-carousel')updateCarouselControls();},true);
  const carouselObserver=new ResizeObserver(updateCarouselControls);carouselObserver.observe(screen);
  document.addEventListener('submit',e=>{
    if(e.target.id!=='story-monitoring-form')return;
    e.preventDefault();const p=property(state.active);if(!p)return;
    state.monitoring[p.id]={frequency:$('#story-monitor-frequency').value,threshold:$('#story-monitor-threshold').value};
    if($('#story-monitor-enabled').checked)state.monitored.add(p.id);else state.monitored.delete(p.id);
    state.settingsOpen=false;persist();render();toast('Monitoring settings saved.');
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.settingsOpen){state.settingsOpen=false;render();}});
  document.addEventListener('input',e=>{if(e.target.dataset.roofReveal){const value=Number(e.target.value);e.target.closest('.roof-reveal').style.setProperty('--reveal',value+'%');e.target.setAttribute('aria-valuetext',Math.round(100-value)+'% projected impacts visible');}if(e.target.dataset.storyYear)setYear(e.target.dataset.storyYear,e.target.value);});
  screen.addEventListener('pointerover',e=>{const el=e.target.closest('[data-story-property],[data-story-preview]');if(el&&!state.simulation?.running){hovered=el.dataset.storyProperty||el.dataset.storyPreview;updateMarkers();setHighlight();}});
  screen.addEventListener('pointerout',e=>{const el=e.target.closest('[data-story-property],[data-story-preview]');if(el&&!el.contains(e.relatedTarget)){hovered=null;updateMarkers();setHighlight(!!state.simulation);}});
  document.querySelectorAll('.sidebar-nav-item').forEach(el=>el.addEventListener('click',()=>navigate(el.title==='Home'?'home':el.title==='History'?'history':'watchlist')));
  window.addEventListener('geolava:area',e=>{
    if(state.page==='home'){const polygon=turf.polygon([e.detail.coords]);const selected=properties.find(p=>turf.booleanPointInPolygon([p.lng,p.lat],polygon));if(selected)openAssessment(selected.id);else toast('No sample properties in this area. Draw around a property marker.');clearActiveModes();return;}
    cancelSimulation();state.simulation=null;const polygon=turf.polygon([e.detail.coords]);const ids=properties.filter(p=>turf.booleanPointInPolygon([p.lng,p.lat],polygon)).map(p=>p.id);state.area=ids;state.active=ids[0]||null;state.session=null;state.page='chat';createSession(property(state.active)||properties[0]);addMessage('user',{text:'Explore the properties in this area'});addMessage('area',{ids});clearActiveModes();persist();setHighlight();render({scroll:true});
  });
  window.addEventListener('geolava:pick',e=>{const loc=e.detail;const nearest=properties.reduce((best,p)=>Math.hypot(p.lng-loc.lng,p.lat-loc.lat)<Math.hypot(best.lng-loc.lng,best.lat-loc.lat)?p:best,properties[0]);if(state.page==='home'){openAssessment(nearest.id);return;}focusProperty(nearest.id,{camera:false});toast('Sample property selected: '+nearest.address);});
  $('.add-popover [data-action="add-file"]').addEventListener('click',()=>toast('This story demo starts with an address or a map selection.'));
  const assessmentQuickThreads=new Map();
  let assessmentQuickContext=null;
  function closeAssessmentQuickChat(restoreFocus=false) {
    const cardId=assessmentQuickContext?.cardId;
    $('#assessment-quick-chat')?.remove();assessmentQuickContext=null;
    if(restoreFocus&&cardId)$('#'+cardId)?.focus({preventScroll:true});
  }
  function positionAssessmentQuickChat(x,y) {
    const popup=$('#assessment-quick-chat');if(!popup)return;
    const width=popup.offsetWidth,height=popup.offsetHeight,gap=12;
    popup.style.left=Math.max(gap,Math.min(x,innerWidth-width-gap))+'px';
    popup.style.top=Math.max(gap,Math.min(y,innerHeight-height-gap))+'px';
  }
  function assessmentQuickAnswer(question,category) {
    const text=question.toLowerCase();
    if(/confidence|certain|accurate|reliable/.test(text))return `The ${category.name.toLowerCase()} assessment has ${category.confidence}% confidence in this prototype. The condition score is ${Math.min(98,category.score)}/100. These are illustrative values; a site inspection would be needed to verify the finding.`;
    if(/future|risk|wrong|happen|worse/.test(text)){
      const risks={roof:'Membrane wear could widen into open seams, allowing water to enter during rain.',sidewalk:'Cracks and uneven paving could worsen with use, creating a greater trip hazard.',roads:'Traffic and wet weather could create cracks or potholes and disrupt access.',drainage:'A blocked inlet could cause pooling and increase water exposure around the property.',greenery:'Tree growth and falling leaves could eventually affect roof clearance and drainage.'};
      return `${risks[category.id]} ${category.advice}`;
    }
    if(/improv|repair|fix|next|recommend|cost|action|help/.test(text))return `${category.advice}${/cost|price|budget/.test(text)?' There is no cost estimate in this assessment; a contractor would need to confirm the scope before quoting.':''}`;
    return `${category.name} is rated ${category.status.toLowerCase()} at ${Math.min(98,category.score)}/100. ${category.detail} ${category.suggestions.length?category.advice:'No immediate improvement is flagged. You can ask what to watch for in the future.'}`;
  }
  function openAssessmentQuickChat(card,x,y) {
    if(state.page!=='assessment')return;
    closeAssessmentQuickChat();clearActiveModes();
    const p=property(state.active),category=assessmentCategories(p).find(c=>c.id===card.dataset.assessmentCategory);
    if(!category)return;
    const key=p.id+':'+category.id;
    if(!assessmentQuickThreads.has(key))assessmentQuickThreads.set(key,[]);
    assessmentQuickContext={key,category,propertyId:p.id,cardId:card.id,x,y};
    document.body.insertAdjacentHTML('beforeend',`<section class="assessment-quick-chat" id="assessment-quick-chat" role="dialog" aria-modal="false" aria-labelledby="assessment-quick-title"><header><img src="geolava-assets/Geolava-assistant.png" alt="Geolava assistant" width="44" height="44"><div><h2 id="assessment-quick-title">Ask about ${esc(category.name.toLowerCase())}</h2><p>${esc(p.address)}</p></div><button type="button" class="assessment-quick-close" aria-label="Close assistant chat">×</button></header><div class="assessment-quick-messages" role="log" aria-label="Assessment conversation" aria-live="polite"></div><form class="quick-ask-input-wrap" id="assessment-quick-form"><input type="text" id="assessment-quick-input" aria-label="Ask about ${esc(category.name.toLowerCase())}" placeholder="Ask a question…" autocomplete="off"><button type="submit" class="quick-ask-send" aria-label="Send assessment question" disabled>${icon('arrow')}</button></form></section>`);
    const popup=$('#assessment-quick-chat'),input=$('#assessment-quick-input'),form=$('#assessment-quick-form');
    renderAssessmentQuickMessages();positionAssessmentQuickChat(x,y);
    $('.assessment-quick-close',popup).addEventListener('click',()=>closeAssessmentQuickChat(true));
    input.addEventListener('input',()=>{const hasText=!!input.value.trim();form.classList.toggle('has-text',hasText);$('button',form).disabled=!hasText;});
    form.addEventListener('submit',e=>{
      e.preventDefault();const question=input.value.trim();if(!question||!assessmentQuickContext)return;
      const thread=assessmentQuickThreads.get(key);thread.push({role:'user',text:question},{role:'assistant',text:assessmentQuickAnswer(question,category)});
      input.value='';form.classList.remove('has-text');$('button',form).disabled=true;
      renderAssessmentQuickMessages();positionAssessmentQuickChat(x,y);input.focus({preventScroll:true});
    });
    popup.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeAssessmentQuickChat(true);}});
    input.focus({preventScroll:true});
  }
  function renderAssessmentQuickMessages() {
    const log=$('.assessment-quick-messages');if(!log||!assessmentQuickContext)return;
    const messages=assessmentQuickThreads.get(assessmentQuickContext.key)||[];
    log.hidden=!messages.length;
    log.innerHTML=messages.map(m=>`<div class="assessment-quick-message ${m.role}"><small>${m.role==='user'?'You':'Assistant'}</small><p>${esc(m.text)}</p></div>`).join('');
    log.scrollTop=log.scrollHeight;
  }
  screen.addEventListener('contextmenu',e=>{
    const card=e.target.closest('.assessment-category');if(!card||state.page!=='assessment')return;
    e.preventDefault();openAssessmentQuickChat(card,e.clientX,e.clientY);
  });
  screen.addEventListener('keydown',e=>{
    if(e.key!=='ContextMenu'&&!(e.shiftKey&&e.key==='F10'))return;
    const card=e.target.closest('.assessment-category');if(!card)return;
    e.preventDefault();const rect=card.getBoundingClientRect();openAssessmentQuickChat(card,rect.left+24,Math.max(12,rect.top+48));
  });
  document.addEventListener('pointerdown',e=>{if(assessmentQuickContext&&!e.target.closest('#assessment-quick-chat'))closeAssessmentQuickChat();});
  screen.addEventListener('scroll',()=>closeAssessmentQuickChat());
  window.addEventListener('resize',()=>closeAssessmentQuickChat());
  const accountControl=$('.sidebar-account'),accountButton=$('#sidebar-account-button'),accountPopover=$('#sidebar-account-popover');
  let accountCloseTimer;
  function setAccountOpen(open) {
    clearTimeout(accountCloseTimer);accountPopover.hidden=!open;accountButton.setAttribute('aria-expanded',String(open));
  }
  accountControl.addEventListener('pointerenter',()=>setAccountOpen(true));
  accountControl.addEventListener('pointerleave',()=>{accountCloseTimer=setTimeout(()=>{if(!accountControl.contains(document.activeElement))setAccountOpen(false);},180);});
  accountControl.addEventListener('focusin',()=>setAccountOpen(true));
  accountControl.addEventListener('focusout',e=>{if(!accountControl.contains(e.relatedTarget))setAccountOpen(false);});
  accountButton.addEventListener('click',()=>setAccountOpen(true));
  accountControl.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();accountButton.focus();setAccountOpen(false);}});
  document.addEventListener('pointerdown',e=>{if(!accountControl.contains(e.target))setAccountOpen(false);});
  $('#sidebar-logout').addEventListener('click',()=>{
    setAccountOpen(false);clearTimeout(onboardingTimer);navigate('home');
    try{localStorage.removeItem(ONBOARDING_KEY);}catch{}
    initOnboarding();announce('Logged out. Sign in to continue.');
  });
  function finishOnboarding() {
    clearTimeout(onboardingTimer);
    try{localStorage.setItem(ONBOARDING_KEY,'1');}catch{}
    $('#welcome-flow')?.remove();
    document.body.classList.remove('welcome-active','welcome-scanning','welcome-ready');
    $('.home-panel').inert=false;
    map.resize();navigate('home');
    $('.sidebar-nav-item[title="Home"]').focus();
  }
  function revealWelcomeSearch() {
    const root=$('#welcome-flow');if(!root)return;
    root.dataset.step='assess';
    $('#welcome-signin').hidden=true;$('#welcome-scan').hidden=true;$('#welcome-assess').hidden=false;
    document.body.classList.remove('welcome-scanning');document.body.classList.add('welcome-ready');
    $('#welcome-address').focus({preventScroll:true});
    announce('Start with an address to assess your first property.');
  }
  function startWelcomeScan() {
    const root=$('#welcome-flow');if(!root)return;
    $('#welcome-login').reset();
    root.dataset.step='scan';$('#welcome-signin').hidden=true;$('#welcome-scan').hidden=false;
    document.body.classList.add('welcome-scanning');
    $('#welcome-skip').focus({preventScroll:true});
    map.flyTo({center:[-122.396,37.790],zoom:15.5,pitch:0,bearing:-12,duration:2400,essential:false});
    announce('Exploring the neighborhood.');
    onboardingTimer=setTimeout(revealWelcomeSearch,matchMedia('(prefers-reduced-motion: reduce)').matches?400:3200);
  }
  function initOnboarding() {
    let completed=false;try{completed=localStorage.getItem(ONBOARDING_KEY)==='1';}catch{}
    if(completed&&!onboardingRequested)return;
    clearActiveModes();document.body.classList.add('welcome-active');$('.home-panel').inert=true;
    const cards=[
      ['market','Assess this property','101 Market Street','monitor',-3],
      ['howard','How is the roof holding up?','580 Howard Street','rain',-2],
      ['mission','Understand the surroundings','245 Mission Street','spark',-1],
      ['spear','What could change in five years?','400 Spear Street','rain',0],
      ['folsom','Give me a property assessment','680 Folsom Street','scan',1],
      ['market','Check sidewalks and access','101 Market Street','draw',2],
      ['howard','See the bigger picture','580 Howard Street','spark',3]
    ];
    document.body.insertAdjacentHTML('beforeend',`<main id="welcome-flow" class="welcome-flow" data-step="signin" aria-label="Welcome to Geolava"><header class="welcome-header"><a class="welcome-brand" href="#" aria-label="Geolava welcome"><img src="Icons/Geolava-Logo.svg" alt="" width="30" height="36"></a><button type="button" class="story-btn" id="welcome-skip">Skip ${icon('arrow')}</button></header><section id="welcome-signin" class="welcome-signin" aria-labelledby="welcome-login-title"><img class="welcome-avatar" src="geolava-assets/Geolava-assistant.png" alt="Geolava assistant"><p class="welcome-eyebrow">A closer look at any property</p><h1 id="welcome-login-title">Every place has<br>a story.</h1><p class="welcome-description">Sign in to see what’s happening, what’s changing, and what comes next.</p><form id="welcome-login"><label>Email<input type="email" name="email" autocomplete="off" placeholder="you@example.com" required></label><label>Password<span class="welcome-password-field"><input type="password" id="welcome-password" name="password" autocomplete="off" placeholder="Enter your password" required><button type="button" id="welcome-password-toggle" aria-label="Show password" aria-pressed="false">Show</button></span></label><button type="submit" class="story-btn primary welcome-submit">Sign in ${icon('arrow')}</button></form><p class="welcome-prototype-note">Prototype sign-in. Use made-up details.</p></section><section id="welcome-scan" class="welcome-scan" aria-labelledby="welcome-scan-title" hidden><div class="welcome-scan-grid" aria-hidden="true"></div><div class="welcome-scan-line" aria-hidden="true"></div><div class="welcome-scan-ring" aria-hidden="true"></div><div class="welcome-scan-copy" role="status"><span class="welcome-scan-dot"></span><h1 id="welcome-scan-title">A new perspective on your surroundings.</h1><p>From the roof to the road, see how it all connects.</p></div></section><section id="welcome-assess" class="welcome-assess" aria-labelledby="welcome-assess-title" hidden><div class="welcome-cream-surface" aria-hidden="true"></div><div class="welcome-orbit" aria-label="Things you can explore">${cards.map(([id,title,address,symbol,position],i)=>`<button type="button" class="welcome-prompt-card" data-welcome-property="${id}" style="--arc-position:${position};--card-delay:${i*90}ms"><span class="welcome-card-icon">${icon(symbol)}</span><strong>${title}</strong><small>${address}</small></button>`).join('')}</div><div class="welcome-assess-content"><img class="welcome-avatar" src="geolava-assets/Geolava-assistant.png" alt="Geolava assistant"><h1 id="welcome-assess-title">Assess the property</h1><p>Start with an address.</p><div class="assessment-search-box"><label class="assessment-search-field">${icon('pin')}<input id="welcome-address" type="search" placeholder="Search for an address" aria-label="Search for an address" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="welcome-address-results" autocomplete="off"></label><div id="welcome-address-results" class="assessment-address-results" role="listbox" aria-label="Suggested addresses" hidden></div></div></div></section></main>`);
    $('#welcome-skip').addEventListener('click',finishOnboarding);
    $('.welcome-brand').addEventListener('click',e=>e.preventDefault());
    $('#welcome-login').addEventListener('submit',e=>{e.preventDefault();startWelcomeScan();});
    $('#welcome-password-toggle').addEventListener('click',()=>{const field=$('#welcome-password'),toggle=$('#welcome-password-toggle'),show=field.type==='password';field.type=show?'text':'password';toggle.textContent=show?'Hide':'Show';toggle.setAttribute('aria-label',show?'Hide password':'Show password');toggle.setAttribute('aria-pressed',String(show));});
    $('#welcome-flow').addEventListener('click',e=>{const card=e.target.closest('[data-welcome-property]');if(card){const input=$('#welcome-address');input.value=property(card.dataset.welcomeProperty).address;updateAssessmentSuggestions('welcome-address','welcome-address-results');input.focus();}});
    // Prevent map tool hotkeys and background focus while the first-time flow is open.
    $('#welcome-flow').addEventListener('keydown',e=>{
      if(['c','d'].includes(e.key.toLowerCase())&&!['INPUT','TEXTAREA'].includes(e.target.tagName))e.stopPropagation();
      if(e.key==='Tab'){
        const focusable=[...$('#welcome-flow').querySelectorAll('a,button,input')].filter(el=>!el.closest('[hidden]')&&!el.disabled);
        const first=focusable[0],last=focusable[focusable.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    });
    requestAnimationFrame(()=>{map.resize();$('#welcome-login input').focus({preventScroll:true});});
  }
  document.addEventListener('input',e=>{if(e.target.id==='portfolio-search'){groupQuery=e.target.value;groupPage=1;$('#portfolio-buildings').innerHTML=portfolioRows();updatePortfolioMap();}});
  document.addEventListener('change',e=>{if(e.target.id==='portfolio-status'){groupStatus=e.target.value;groupPage=1;$('#portfolio-buildings').innerHTML=portfolioRows();updatePortfolioMap();}});
  map.on('click','story-portfolio-dots',e=>{if(state.page==='group'&&!drawMode&&!commentMode&&e.features?.[0])openProperty(e.features[0].properties.id);});
  map.on('mouseenter','story-portfolio-dots',()=>{if(state.page==='group')map.getCanvas().style.cursor='pointer';});
  map.on('mouseleave','story-portfolio-dots',()=>{if(!drawMode&&!commentMode)map.getCanvas().style.cursor='';});
  map.on('click','story-assessment-fill',e=>{
    if(state.page!=='assessment'||drawMode||commentMode)return;
    const id=e.features?.[0]?.properties.category;
    if(id){locateAssessmentCategory(id);$('#assessment-'+id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}
  });
  map.on('mousemove','story-assessment-fill',()=>{if(state.page==='assessment'&&!drawMode&&!commentMode)map.getCanvas().style.cursor='pointer';});
  map.on('mouseleave','story-assessment-fill',()=>{if(!drawMode&&!commentMode)map.getCanvas().style.cursor='';});
  map.on('click','story-context-impact-fill',e=>{
    if(drawMode||commentMode||!state.simulation?.resultId)return;
    const feature=e.features?.find(feature=>feature.properties.opacity>.01),event=timelineEvents.find(event=>event.id===feature?.properties.eventId);
    if(event){setYear(state.simulation.resultId,event.year);showTimelineEvent(event.id,true);}
  });
  map.on('mousemove','story-context-impact-fill',e=>{if(!drawMode&&!commentMode)map.getCanvas().style.cursor=e.features?.some(feature=>feature.properties.opacity>.01)?'pointer':'';});
  map.on('mouseleave','story-context-impact-fill',()=>{if(!drawMode&&!commentMode)map.getCanvas().style.cursor='';});
  map.on('style.load',ensureLayers);
  map.on('moveend',resolveFootprint);
  map.on('idle',resolveFootprint);
  if(map.isStyleLoaded())ensureLayers();else map.once('load',ensureLayers);
  if(map.loaded())fitProperties();else map.once('load',fitProperties);
  render();initOnboarding();history.replaceState(null,'',location.pathname);
})();

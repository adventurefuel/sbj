/* Cargo+420 storefront */
const HOME_CATS=['flower','edibles','cbd','concentrates','mushrooms','vapes','enhance'];
const D={products:[],zones:[],settings:{},tiers:[],events:[],zips:{}};
const prod=id=>D.products.find(p=>p.id===id);
const PAYS=[{id:'cash',label:'Cash',sub:'Exact change helps'},{id:'cashapp',label:'Cash App',sub:'$420Cargo'},{id:'card',label:'Card tap',sub:'Square · debit/credit'}];
const payLabel=id=>id==='cashapp'?'Cash App ($420Cargo)':id==='card'?'Card tap (Square)':'Cash';
const shopItems=()=>D.products.filter(p=>p.cat!=='drop');
const choices=p=>p&&p.options&&Array.isArray(p.options.choices)?p.options.choices:null;
const choiceOf=(p,opt)=>(choices(p)||[]).find(c=>c.label===opt)||null;
const itemPrice=(p,opt)=>{const c=choiceOf(p,opt);return c?Number(c.price):Number(p.price)};
const itemStock=(p,opt)=>{const c=choiceOf(p,opt);return c?Number(c.stock):Number(p.stock)};
const fromPrice=p=>{const ch=choices(p);if(!ch)return money(p.price);const ps=ch.map(c=>Number(c.price)),lo=Math.min(...ps);return (Math.max(...ps)>lo?'From ':'')+money(lo)};
const allCities=()=>D.zones.flatMap(z=>z.cities).sort((a,b)=>a.localeCompare(b));
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let cart=store.get('c420cart',[]);
function saveCart(){cart=cart.filter(x=>{const p=prod(x.id);return p&&x.qty>0&&(!choices(p)||choiceOf(p,x.opt))});store.set('c420cart',cart);$('#cartn').textContent=cart.reduce((s,x)=>s+x.qty,0)}

async function loadAll(){
  const [p,z,s,t,e,zz]=await Promise.all([
    sb.from('products').select('*').eq('active',true).order('created_at',{ascending:false}),
    sb.from('zones').select('*').order('sort'),
    sb.from('store_settings').select('*').eq('id',1).single(),
    sb.from('tiers').select('*').order('sort'),
    sb.from('events').select('*').gte('starts_on',new Date(Date.now()-864e5).toISOString().slice(0,10)).order('starts_on'),
    sb.from('zip_codes').select('zip,city')]);
  const err=[p,z,s,t,e].find(x=>x.error);if(err)throw err.error;
  D.products=p.data;D.zones=z.data;D.settings=s.data;D.tiers=t.data;D.events=e.data;
  D.zips={};(zz.data||[]).forEach(r=>D.zips[r.zip]=r.city);
  D.hhMin={};try{const hm=await sb.from('hh_city_min').select('city,min_order');(hm.data||[]).forEach(r=>D.hhMin[r.city]=Number(r.min_order))}catch(e){}
  try{const [ps,nf]=await Promise.all([sb.from('promo_settings').select('*').eq('id',1).single(),sb.rpc('next_free_order')]);D.promo=ps.data||{ref_new:10,ref_reward:10,win_cap:100};D.nextFree=nf.data||null}catch(e){D.promo={ref_new:10,ref_reward:10,win_cap:100};D.nextFree=null}
}

/* ---------- visit + speed analytics (first-party, no cookies, no IP stored) ---------- */
const TRK=(()=>{
  const off=/localhost|127\.0\.0\.1/.test(location.hostname)||navigator.webdriver||/bot|crawl|spider|lighthouse|headless|preview/i.test(navigator.userAgent);
  const rid=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)).replace(/-/g,'').slice(0,24);
  let vid='',sid='';try{vid=localStorage.getItem('c420vid')||'';if(!vid){vid=rid();localStorage.setItem('c420vid',vid)}
    const ss=JSON.parse(sessionStorage.getItem('c420sid')||'null');sid=ss&&Date.now()-ss.t<30*60e3?ss.id:rid();}catch(e){vid=vid||rid();sid=sid||rid()}
  const touch=()=>{try{sessionStorage.setItem('c420sid',JSON.stringify({id:sid,t:Date.now()}))}catch(e){}};touch();
  const ua=navigator.userAgent;
  const device=/iPad|Tablet/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)?'tablet':/Mobi|Android|iPhone/i.test(ua)?'mobile':'desktop';
  const browser=/Edg\//.test(ua)?'Edge':/SamsungBrowser/.test(ua)?'Samsung':/CriOS|Chrome\//.test(ua)?'Chrome':/FxiOS|Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Other';
  const app=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  const ref=(()=>{try{const u=new URL(location.href).searchParams.get('utm_source');if(u)return u.slice(0,60);if(app)return'Home-screen app';if(!document.referrer)return'';const h=new URL(document.referrer).hostname.replace(/^www\./,'');return/exclusivedeliveryservices\.com|cargo420\.onrender\.com/.test(h)?'':h}catch(e){return''}})();
  const rpc=(fn,body)=>fetch(CFG.SUPABASE_URL+'/rest/v1/rpc/'+fn,{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',apikey:CFG.SUPABASE_KEY,Authorization:'Bearer '+CFG.SUPABASE_KEY},body:JSON.stringify(body)}).then(r=>r.ok?r.json():null).catch(()=>null);
  let first=true,firstId=null,last='';
  // speed: measured once per full page load, sent when the visitor leaves or after 12s
  const m={lcp:null,cls:0,inp:null};
  try{new PerformanceObserver(l=>{const e=l.getEntries();m.lcp=Math.round(e[e.length-1].startTime)}).observe({type:'largest-contentful-paint',buffered:true})}catch(e){}
  try{new PerformanceObserver(l=>{l.getEntries().forEach(e=>{if(!e.hadRecentInput)m.cls+=e.value})}).observe({type:'layout-shift',buffered:true})}catch(e){}
  try{new PerformanceObserver(l=>{l.getEntries().forEach(e=>{if(e.interactionId)m.inp=Math.max(m.inp||0,Math.round(e.duration))})}).observe({type:'event',buffered:true,durationThreshold:40})}catch(e){}
  let sent=false;
  const sendPerf=async()=>{if(off||sent)return;const id=await firstIdP;if(!id)return;sent=true;
    const n=performance.getEntriesByType('navigation')[0]||{},fcp=(performance.getEntriesByName('first-contentful-paint')[0]||{}).startTime;
    rpc('track_perf',{p_id:id,p_visitor:vid,p_ttfb:n.responseStart?Math.round(n.responseStart):null,p_fcp:fcp!=null?Math.round(fcp):null,p_lcp:m.lcp,p_load:n.loadEventEnd?Math.round(n.loadEventEnd):null,p_cls:Math.round(m.cls*1000)/1000,p_inp:m.inp,p_conn:(navigator.connection&&navigator.connection.effectiveType)||null})};
  let resolveFirst;const firstIdP=new Promise(r=>resolveFirst=r);
  addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')sendPerf()});
  addEventListener('pagehide',sendPerf);
  addEventListener('load',()=>setTimeout(sendPerf,12000));
  return{view(path){if(off)return;path=(path||'home').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,30)||'home';if(path===last)return;last=path;touch();
    const p=rpc('track_view',{p_visitor:vid,p_session:sid,p_path:path,p_referrer:first?ref:null,p_device:device,p_browser:browser,p_first:first});
    if(first){first=false;p.then(id=>resolveFirst(id))}}};
})();
function trackView(h){TRK.view(h)}

/* ---------- routing ---------- */
let route='home',shopFilter={type:'all',val:null},sortBy='newest',q='';
const STRAINS=[{id:'indica',name:'Indica',sub:'Relax · body high'},{id:'sativa',name:'Sativa',sub:'Uplift · head high'},{id:'hybrid',name:'Hybrid',sub:'Best of both'}];
const SICONS={
 indica:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"><path d="M33 8a17 17 0 1 0 8 25A14 14 0 0 1 33 8z"/><path d="M36 15l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z"/></svg>',
 sativa:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="24" cy="24" r="8"/><path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.6 10.6l4.2 4.2M33.2 33.2l4.2 4.2M10.6 37.4l4.2-4.2M33.2 14.8l4.2-4.2"/></svg>',
 hybrid:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><circle cx="24" cy="24" r="17"/><path d="M24 7a8.5 8.5 0 0 1 0 17 8.5 8.5 0 0 0 0 17" /><path d="M24 7a17 17 0 0 0 0 34 8.5 8.5 0 0 1 0-17 8.5 8.5 0 0 0 0-17z" fill="currentColor"/></svg>'};
const strainOf=p=>(p.strain||'').trim().toLowerCase();
const strainName=id=>(STRAINS.find(x=>x.id===id)||{}).name||id;
function go(){
  const h=(location.hash||'#home').slice(1);
  try{trackView(h)}catch(e){}
  if(h==='happyhour')location.replace('#specials');
  route=['home','shop','drop','specials','members','events','areas','checkout','done'].includes(h)?h:'home';
  if(CATS.some(c=>c.id===h)){route='shop';shopFilter={type:'cat',val:h};q='';const hi=$('#hq');if(hi)hi.value=''}
  if(h==='liked'||STRAINS.some(x=>x.id===h)){route='shop';shopFilter=h==='liked'?{type:'feat',val:null}:{type:'strain',val:h};q='';const hi=$('#hq');if(hi)hi.value=''}
  render();window.scrollTo(0,0);
}
window.addEventListener('hashchange',()=>{$('#nav').classList.remove('open');$('#menubtn')?.setAttribute('aria-expanded','false');go()});
function render(){
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.r===route));
  const b=$('#banner');
  if(!D.settings.open){b.className='banner closed';b.textContent='We are closed right now and not taking orders. Hours: '+D.settings.hours}
  else{b.className='banner';b.textContent=`Pay at the door: Cash · Cash App $420Cargo · Card tap · $${Number(D.settings.base_min)} minimum on every order · Valid 21+ ID checked at delivery · Hours ${D.settings.hours}`}
  stopDropTimers();
  drawCatbar();
  ({home:vHome,shop:vShop,drop:vDrop,specials:vSpecials,members:vMembers,events:vEvents,areas:vAreas,checkout:vCheckout,done:vDone}[route])($('#view'));
  saveCart();
}

/* ---------- home ---------- */
/* ---------- specials ---------- */
function detroitNow(){const f=new Intl.DateTimeFormat('en-US',{timeZone:'America/Detroit',weekday:'short',hour:'numeric',minute:'numeric',hour12:false}).formatToParts(new Date());const g=t=>f.find(x=>x.type===t)?.value;return{day:g('weekday'),h:+g('hour')%24,m:+g('minute')}}
function happyHourStatus(){const {day,h,m}=detroitNow();const days=['Mon','Tue','Wed','Thu'];const mins=h*60+m;
  if(days.includes(day)&&mins>=660&&mins<900){const left=900-mins;return{on:true,text:`Happy Hour is on now · ${Math.floor(left/60)?Math.floor(left/60)+'h ':''}${left%60}m left to order`}}
  if(days.includes(day)&&mins<660)return{on:false,text:'Happy Hour starts today at 11am'};
  const next=day==='Thu'||day==='Fri'||day==='Sat'||day==='Sun'?'Monday':'tomorrow';return{on:false,text:`Next Happy Hour: ${next} at 11am`}}
const dealProd=n=>D.products.find(p=>p.name.toLowerCase()===n.toLowerCase());
function freeGiftFor(sub){if(sub>=100)return{label:'$100+ order',choices:['Free shake','5 free pre-rolls']};if(sub>=65)return{label:'$65+ order',choices:['3 free pre-rolls']};return{label:'Every order',choices:['2 free pre-rolls']}}
function vSpecials(V){
  const hh=happyHourStatus(),sfv=dealProd('SFV OG'),bolo=dealProd('Bolo Runtz');
  V.innerHTML=`<div class="sp">
  <section class="sp-hh${hh.on?' on':''}"><div class="wrap">
   <div class="sp-hhcard">
    <div class="sp-status"><i></i>${esc(hh.text)}</div>
    <h1>Happy Hour!!</h1>
    <div class="sp-when"><div><small>Days</small><b>Mon – Thu</b></div><div><small>Hours</small><b>11am – 3pm</b></div></div>
    <p class="sp-rule"><b>No delivery fee</b> when your order meets your area's Happy Hour minimum. Order must be placed by 3pm. <b>No exceptions.</b></p>
    <div class="sp-mins">
     <div><b>$25</b><span>minimum · Detroit &amp; nearby Wayne County cities · free delivery</span></div>
     <div><b>$50</b><span>minimum · Oakland County &amp; farther Wayne County · free delivery</span></div>
     <div><b>$50</b><span>minimum · Macomb County · free delivery</span></div>
    </div>
   </div></div></section>

  <section class="wrap sp-deals">
   <div class="sp-head"><span class="eyebrow">Every day</span><h2>Daily deals</h2></div>
   <div class="sp-feature">
    ${[sfv,bolo].filter(Boolean).map(p=>`<button class="sp-prod" data-p="${p.id}"><div class="sp-img">${art(p)}</div><div class="sp-pinfo"><b>${esc(p.name)}</b><span>3.5g <em>$15</em> · 28g <em>$70</em></span><u>Choose size →</u></div></button>`).join('')}
    <div class="sp-price"><span>SFV OG &amp; Bolo Runtz</span><b>$15</b><small>for 3.5g</small><b>$70</b><small>for 28g</small></div>
   </div>
   <div class="sp-head" style="margin-top:36px"><span class="eyebrow">Free with your order</span><h2>The more you order,<br>the more you get</h2></div>
   <ol class="sp-ladder">
    <li><div class="sp-tier">$100+</div><div><b>THC order</b><span>Choose a free shake or 5 pre-rolls</span></div></li>
    <li><div class="sp-tier">$65+</div><div><b>Any order</b><span>Choose 3 free pre-rolls</span></div></li>
    <li><div class="sp-tier">Under $65</div><div><b>Every order</b><span>2 free pre-rolls with your order</span></div></li>
   </ol>
   <p class="note">Pick your free item at checkout.</p>
   <div style="margin-top:28px">${freeCounter()}</div>
   <div class="sp-ref"><b>Give $${Number(D.promo.ref_new)}, get $${Number(D.promo.ref_reward)}</b><span>Share your referral code. Your friend gets $${Number(D.promo.ref_new)} off their first order, and you get $${Number(D.promo.ref_reward)} credit once it's delivered. Your code is on your order confirmation.</span></div>
   <a class="btn sp-cta" href="#shop">Shop the menu →</a>
  </section></div>`;
}

function freeCounter(){const n=D.nextFree;if(!n||!(Number(n.cap)>0))return'';return`<div class="fc"><div class="fc-plate"><small>Next free order</small><b>#${esc(n.code)}</b></div><div class="fc-txt"><b>${n.away} order${n.away===1?'':'s'} away</b><span>Every order number ending in 420 ships free, up to $${Number(n.cap)}. Your order could be the one.</span></div></div>`}
function vHome(V){
  V.innerHTML=`<div class="wrap">
  <section class="hero"><img src="img/logo.webp" alt="Cargo+420 Exclusive Delivery Service"><p>Metro Detroit cannabis delivery. Pick a category, build your order, pay at the door with cash, Cash App or card.</p>
   ${dropFeature()}${freeCounter()}
   <button class="zipchip" id="zipchip">${myZip?`${ICONS.pin}<span>Delivering to <b>${esc(myZip.city)} ${esc(myZip.zip)}</b></span><u>Change</u>`:`${ICONS.pin}<span>Do we deliver to you?</span><u>Check your ZIP</u>`}</button></section>
  <nav class="catgrid" aria-label="Shop by category">
   ${HOME_CATS.filter(id=>shopItems().some(p=>p.cat===id)).map(id=>{const c=CATS.find(x=>x.id===id);return`<a class="catbtn" href="#${id}">${ICONS[id]}<span>${c.name}</span><small>${c.blurb}</small></a>`}).join('')}
   ${STRAINS.filter(x=>shopItems().some(p=>strainOf(p)===x.id)).map(x=>`<a class="catbtn" href="#${x.id}">${SICONS[x.id]}<span>${x.name}</span><small>${x.sub}</small></a>`).join('')}
   <a class="catbtn all" href="#shop">${ICONS.all}<span>Shop all</span><small>${shopItems().length} products</small></a>
  </nav>
  <div class="strip">
   <div><b>Pay your way</b><p>Cash, Cash App <span class="cashtag">$420Cargo</span> or tap your card with Square when your driver arrives.</p></div>
   <div><b>21+ with ID</b><p>Meet your driver at their vehicle with a valid government ID.</p></div>
   <div><b>Members save up to ${Math.max(0,...D.tiers.map(t=>t.pct_off))}%</b><p>${D.tiers.map(t=>t.name).join(', ')}. <a href="#members">See membership</a>.</p></div>
  </div>
  <div class="steps">
   <div><b>1. Browse</b><span>Open the menu or tap a category.</span></div>
   <div><b>2. Add to cart</b><span>Pick sizes and quantities.</span></div>
   <div><b>3. Review</b><span>Adjust or remove items.</span></div>
   <div><b>4. Check out</b><span>Name, phone, address. We call or text to confirm.</span></div>
   <div><b>5. Receive</b><span>Driver sends an ETA. Show ID, pay with cash, Cash App or card.</span></div>
  </div></div>`;
}
function vAreas(V){
  const base=Number(D.settings.base_min);
  V.innerHTML=`<div class="sa">
  <section class="sa-hero"><div class="wrap">
   <div class="sa-plate">
    <span class="sa-stars">★ ★ ★ &nbsp;Exclusive delivery service&nbsp; ★ ★ ★</span>
    <h1>Do we pull up<br>to your door?</h1>
    <form class="sa-form" id="zipf" novalidate role="search"><label for="zip-in" class="sr">Your ZIP code</label>
     <input id="zip-in" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="ZIP code" value="${esc(myZip?.zip||'')}">
     <button>Check</button></form>
    <button type="button" class="sa-loc" id="zip-loc">${ICONS.plane}<span>Use my current location</span></button>
   </div>
   <div id="zip-out" data-v="plate" aria-live="polite">${myZip?zipResult(myZip.zip,'plate'):''}</div>
  </div></section>

  <section class="wrap sa-map">
   <div class="sa-maphead"><span class="eyebrow">Delivery zones</span><h2>The farther the drive,<br>the bigger the minimum.</h2>
    <p>Every order needs at least $${base}. Under your city's minimum? You can still order with a delivery fee.</p></div>
   <div class="sa-grid">
    <div class="sa-rings">${ringsSvg()}</div>
    <div class="sa-zones">${D.zones.map((z,i)=>`<article class="sa-zone" data-zone="${z.id}">
      <header><span class="sa-n">Zone ${i+1}</span><b>$${Number(z.min_order)}</b><span class="sa-fee">${Number(z.fee)?`minimum · $${Number(z.fee)} fee if under`:'minimum · no fee'}</span></header>
      <div class="sa-chips">${z.cities.map(c=>`<span class="sa-chip${myZip?.city===c?' hit':''}" data-city="${esc(c)}">${esc(c)}</span>`).join('')}</div></article>`).join('')}</div>
   </div>
  </section>

  <section class="wrap sa-rules">
   <div><b>$${base}</b><span>Minimum on every order, every city.</span></div>
   <div><b>Pay</b><span>Cash, Cash App ($420Cargo) or card tap at the door.</span></div>
   <div><b>21+ ID</b><span>Meet your driver at their vehicle with a valid ID.</span></div>
   <div><b>Missed it?</b><span>Re-delivery fee of ${esc(D.settings.redeliver)}.</span></div>
  </section></div>`;
}
function ringsSvg(){
  const n=D.zones.length,R=188,r0=48,step=n>1?(R-r0)/(n-1):0,hitZ=myZip&&zoneForCity(myZip.city);
  let g='';
  for(let i=n-1;i>=0;i--){const z=D.zones[i],r=r0+i*step,hit=hitZ&&hitZ.id===z.id;
    g+=`<circle cx="200" cy="200" r="${r}" class="ring${i===0?' core':''}${hit?' hit':''}" data-zone="${z.id}" style="--o:${(0.05+0.05*(n-1-i)).toFixed(2)}"/>`;
    if(i>0)g+=`<g class="rlab${hit?' hit':''}"><rect x="${200-26}" y="${200-r+6}" width="52" height="22" rx="11"/><text x="200" y="${200-r+21.5}" text-anchor="middle">$${Number(z.min_order)}</text></g>`;}
  const z0=D.zones[0];
  return `<svg viewBox="0 0 400 400" role="img" aria-label="Delivery zones radiating out from Detroit, minimum order rising with distance">${g}
   <text x="200" y="196" text-anchor="middle" class="cmin">$${z0?Number(z0.min_order):''}</text><text x="200" y="216" text-anchor="middle" class="ccity">DETROIT</text>
   <path d="M200 228v14M193 235h14" class="cross"/></svg>`;
}

/* ---------- ZIP checker ---------- */
let myZip=store.get('c420zip',null);
const zoneForCity=city=>D.zones.filter(z=>z.cities.includes(city)).sort((a,b)=>a.min_order-b.min_order)[0]||null;
function zipChecker(variant){
  const val=esc(myZip?.zip||''),out=`<div id="zip-out" aria-live="polite">${myZip?zipResult(myZip.zip):''}</div>`;
  if(variant==='light')return `<div class="jz-in">
   <a class="jz-back" href="#home" aria-label="Back to home">${ICONS.back}</a>
   <div class="jz-ill">${ICONS.route}</div>
   <h2 class="jz-title">Your Delivery, Your Way</h2>
   <p class="jz-sub">Discreet home delivery across Metro Detroit.<br>Cash, Cash App or card at the door, 21+ with ID.</p>
   <div class="jz-toggle" role="tablist" aria-label="Order type"><button type="button" role="tab" aria-selected="false" id="jz-pickup">Pickup</button><button type="button" role="tab" aria-selected="true" class="on">Delivery</button></div>
   <div class="jz-row"><span class="jz-pin">${ICONS.pin}</span><div><b>Add an address for delivery</b><small>Please enter your ZIP code &amp; enjoy delivery</small></div></div>
   <form class="jz-form" id="zipf" novalidate role="search"><label for="zip-in" class="sr">ZIP code</label>
    <input id="zip-in" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="Search ZIP code" value="${val}">
    <button aria-label="Check ZIP code">${ICONS.search}</button></form>
   <button type="button" class="jz-loc" id="zip-loc">${ICONS.plane}<span>Use My Current Location</span></button>
   ${out}</div>`;
  return `<div class="zc">
   <div class="zc-icon">${ICONS.route}</div>
   <h2>Your order, your door</h2>
   <p class="zc-sub">Discreet home delivery across Metro Detroit. Enter your ZIP code to see if we deliver to you and what your minimum is.</p>
   <form class="zc-form" id="zipf" novalidate role="search"><label for="zip-in" class="sr">ZIP code</label>
    <input id="zip-in" inputmode="numeric" autocomplete="postal-code" maxlength="5" placeholder="Enter your ZIP code" value="${val}">
    <button aria-label="Check ZIP code">${ICONS.search}</button></form>
   <button type="button" class="zc-loc" id="zip-loc">${ICONS.plane}<span>Use my current location</span></button>
   ${out}</div>`;
}
function zipResult(zip,v){
  const city=D.zips[zip];const z=city&&zoneForCity(city);
  if(v==='plate'){
    if(!z)return`<div class="sa-ticket no"><div class="t-main"><small>Out of range</small><b>${esc(zip)}</b><span>We don't deliver here yet. See the zones below for where we go.</span></div></div>`;
    const m=Number(z.min_order),f=Number(z.fee),i=D.zones.indexOf(z)+1;
    return`<div class="sa-ticket yes"><div class="t-main"><small>We deliver to</small><b>${esc(city)}</b><span>${esc(zip)} · Zone ${i}</span></div>
     <div class="t-stub"><div><small>Minimum</small><b>$${m}</b></div><div><small>Fee if under</small><b>${f?'$'+f:'None'}</b></div><a class="btn" href="#shop">Start shopping →</a></div></div>`;
  }
  if(!z)return`<div class="zc-res no"><b>We don't deliver to ${esc(zip)} yet.</b><span>We're growing. Check the city list below, or follow us for new areas.</span></div>`;
  const m=Number(z.min_order),f=Number(z.fee),base=Number(D.settings.base_min);
  return`<div class="zc-res yes"><b>Yes! We deliver to ${esc(city)} (${esc(zip)}).</b>
   <span>${m>base&&f?`Orders of $${m}+ deliver free. Under $${m}, a $${f} delivery fee applies (minimum order $${base}).`:`Minimum order $${m}. No delivery fee.`}</span>
   <a class="btn" href="#shop">Start shopping</a></div>`;
}
function checkZip(zip){
  zip=String(zip||'').replace(/\D/g,'').slice(0,5);const out=$('#zip-out');
  if(zip.length!==5){out.innerHTML='<div class="zc-res no"><b>Enter a 5-digit ZIP code.</b></div>';return}
  const city=D.zips[zip];
  if(city){myZip={zip,city};store.set('c420zip',myZip);co.city=city;store.set('c420co',{...co,age:undefined})}
  out.innerHTML=zipResult(zip,out.dataset.v);
  document.querySelectorAll('.sa-chip').forEach(c=>c.classList.toggle('hit',c.dataset.city===city));
  const hz=city&&zoneForCity(city);document.querySelectorAll('.sa-rings .ring,.sa-zone').forEach(c=>c.classList.toggle('hit',!!hz&&+c.dataset.zone===hz.id));
  document.querySelectorAll('.sa-rings .rlab').forEach(l=>l.classList.remove('hit'));
  const chip=$('#zipchip');if(chip&&city)chip.innerHTML=`${ICONS.pin}<span>Delivering to <b>${esc(city)} ${esc(zip)}</b></span><u>Change</u>`;
}
function useLocation(){
  const out=$('#zip-out');
  if(!navigator.geolocation){out.innerHTML='<div class="zc-res no"><b>Your browser can\'t share location.</b><span>Type your ZIP code instead.</span></div>';return}
  out.innerHTML='<div class="zc-res"><span>Finding your location…</span></div>';
  navigator.geolocation.getCurrentPosition(async pos=>{
    try{
      const {latitude:la,longitude:lo}=pos.coords;
      const r=await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${la}&longitude=${lo}&localityLanguage=en`);
      const j=await r.json();const zip=(j.postcode||'').slice(0,5);
      if(!zip)throw new Error('no zip');
      $('#zip-in').value=zip;checkZip(zip);
    }catch(e){out.innerHTML='<div class="zc-res no"><b>We couldn\'t find your ZIP code.</b><span>Type it in instead.</span></div>'}
  },()=>{out.innerHTML='<div class="zc-res no"><b>Location is turned off for this site.</b><span>Type your ZIP code instead.</span></div>'},{timeout:10000,maximumAge:600000});
}
function openZipModal(){
  $('#layer').innerHTML=`<div class="scrim" data-close></div><div class="modal"><div class="box zipbox" role="dialog" aria-label="Check your ZIP code"><button class="x zc-close" data-close aria-label="Close">×</button>${zipChecker()}</div></div>`;
  setTimeout(()=>$('#zip-in')?.focus(),50);
}

/* ---------- shop ---------- */
function filterLabel(){return shopFilter.type==='cat'?catName(shopFilter.val):shopFilter.type==='feat'?'Most liked':shopFilter.type==='strain'?strainName(shopFilter.val):shopFilter.val||''}
function openFilters(){
  const on=(t,v)=>shopFilter.type===t&&(v==null||shopFilter.val===v)?'on':'';
  $('#layer').innerHTML=`<div class="scrim" data-close></div><aside class="drawer fsheet" role="dialog" aria-label="Filter and sort"><header><h2 style="font-size:30px">Filter &amp; Sort</h2><button class="x" data-close aria-label="Close">×</button></header>
   <div class="body">
    <label>Search<input id="shopq2" type="search" placeholder="Search menu" value="${esc(q)}"></label>
    <label>Sort by<select id="sort2"><option value="newest">Newest</option><option value="low">Price, low to high</option><option value="high">Price, high to low</option><option value="name">Name A–Z</option></select></label>
    <div class="eyebrow" style="margin-top:6px">Category</div>
    <div class="fchips"><button class="${on('all')}" data-f="all">All</button><button class="${on('feat')}" data-f="feat">Most liked</button>${CATS.map(c=>`<button class="${on('cat',c.id)}" data-f="cat" data-v="${c.id}">${c.name}</button>`).join('')}</div>
    <div class="eyebrow" style="margin-top:6px">Strain</div>
    <div class="fchips">${STRAINS.map(x=>`<button class="${on('strain',x.id)}" data-f="strain" data-v="${x.id}">${x.name}</button>`).join('')}</div>
    <div class="eyebrow" style="margin-top:6px">Filter</div>
    <div class="fchips">${tagsFor().map(t=>`<button class="${on('tag',t)}" data-f="tag" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
   </div><button class="btn" data-close style="margin-top:12px">Show results</button></aside>`;
  $('#sort2').value=sortBy;
}
function tagsFor(){const s=new Set();shopItems().forEach(p=>(p.tags||[]).forEach(t=>s.add(t)));return[...s].sort()}
function vShop(V){
  let list=shopItems();
  if(shopFilter.type==='cat')list=list.filter(p=>p.cat===shopFilter.val);
  if(shopFilter.type==='tag')list=list.filter(p=>p.tags.includes(shopFilter.val));
  if(shopFilter.type==='feat')list=list.filter(p=>p.featured);
  if(shopFilter.type==='strain')list=list.filter(p=>strainOf(p)===shopFilter.val);
  if(q)list=list.filter(p=>(p.name+' '+p.tags.join(' ')).toLowerCase().includes(q.toLowerCase()));
  if(sortBy==='low')list.sort((a,b)=>a.price-b.price);
  if(sortBy==='high')list.sort((a,b)=>b.price-a.price);
  if(sortBy==='name')list.sort((a,b)=>a.name.localeCompare(b.name));
  if(sortBy==='newest'&&!q){const rk=p=>(p.featured?0:2)+(p.cat==='flower'?0:1);list.sort((a,b)=>rk(a)-rk(b))}else list.sort((a,b)=>(b.cat==='flower')-(a.cat==='flower'));
  const on=(t,v)=>shopFilter.type===t&&(v==null||shopFilter.val===v)?'on':'';
  V.innerHTML=`<div class="wrap shop">
   <aside class="side"><h3>Browse by</h3><ul>
    <li><button class="${on('all')}" data-f="all">All Products</button></li>
    <li><button class="${on('feat')}" data-f="feat">Most liked</button></li>
    ${CATS.map(c=>`<li><button class="${on('cat',c.id)}" data-f="cat" data-v="${c.id}">${c.name}</button></li>`).join('')}
    <li class="grp">Strain</li>
    ${STRAINS.map(x=>`<li><button class="${on('strain',x.id)}" data-f="strain" data-v="${x.id}">${x.name}</button></li>`).join('')}
    <li class="grp">Filter</li>
    ${tagsFor().map(t=>`<li><button class="${on('tag',t)}" data-f="tag" data-v="${esc(t)}">${esc(t)}</button></li>`).join('')}
   </ul></aside>
   <section>
    <div class="shophead"><span class="count">${list.length} products${shopFilter.type!=='all'?` · <b>${esc(filterLabel())}</b>`:''}</span>
     <button class="filterbtn" id="filterbtn" type="button">Filter &amp; Sort</button>
     <div class="row deskonly">
     <label class="row" style="color:var(--muted)">Sort by:<select id="sort"><option value="newest">Newest</option><option value="low">Price, low to high</option><option value="high">Price, high to low</option><option value="name">Name A–Z</option></select></label></div></div>
    <div class="grid">${list.map(p=>`<div class="card"><button class="img" data-p="${p.id}" aria-label="${esc(p.name)} details">${p.featured?'<span class="tag">Hot</span>':''}${art(p)}</button><button class="nm" data-p="${p.id}">${esc(p.name)}</button><div class="pr ${p.stock<=0?'oos':''}">${p.stock<=0?'Out of stock':fromPrice(p)}${p.size?` <span>· ${esc(p.size)}</span>`:''}</div>
     ${p.stock>0&&choices(p)?`<div class="cardbuy"><button type="button" class="btn addbtn" data-p="${p.id}">Choose ${esc((p.options.name||'option').toLowerCase())}</button></div>`:p.stock>0?`<div class="cardbuy"><div class="cq"><button type="button" data-cq2="-1" aria-label="Less">−</button><span class="num">1</span><button type="button" data-cq2="1" data-max="${p.stock}" aria-label="More">+</button></div><button type="button" class="btn addbtn" data-quick="${p.id}">Add to cart</button></div>`:''}</div>`).join('')||'<p class="note">No products match. Try another category.</p>'}</div>
   </section></div>`;
  $('#sort').value=sortBy;
}
let selOpt=null,curP=null;
function openProduct(id){
  const p=prod(id);if(!p)return;curP=id;
  const ch=choices(p);selOpt=ch?(ch.find(c=>c.stock>0)||{}).label||null:null;
  $('#layer').innerHTML=`<div class="scrim" data-close></div><div class="modal"><div class="box" role="dialog" aria-label="${esc(p.name)}">
   <div class="pimg">${art(p)}</div>
   <div class="pinfo" id="pinfo"></div></div></div>`;
  drawProduct(p);
}
function drawProduct(p){
  const ch=choices(p),maxOff=Math.max(0,...D.tiers.map(t=>t.pct_off)),minOff=Math.min(...D.tiers.map(t=>t.pct_off));
  const price=ch&&selOpt?itemPrice(p,selOpt):Number(p.price),stock=ch?(selOpt?itemStock(p,selOpt):0):p.stock;
  $('#pinfo').innerHTML=`<div class="row" style="justify-content:space-between"><span class="eyebrow">${catName(p.cat)}</span><button class="x" data-close aria-label="Close">×</button></div>
    <h2>${esc(p.name)}</h2>
    <div class="chips">${[p.strain,p.thc,p.size,...(p.tags||[])].filter(Boolean).slice(0,4).map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div>
    ${ch?`<div class="optgrp"><div class="eyebrow">${esc(p.options.name||'Options')}</div><div class="opts">${ch.map(c=>`<button type="button" class="opt${c.label===selOpt?' on':''}" data-opt="${esc(c.label)}" ${c.stock>0?'':'disabled'}><span>${esc(c.label)}</span><small>${c.stock>0?money(c.price):'Sold out'}</small></button>`).join('')}</div></div>`:''}
    <div class="num" style="font-size:26px;font-weight:600">${money(price)}</div>
    ${D.tiers.length?`<div class="note">Members pay ${money(price*(1-minOff/100))}–${money(price*(1-maxOff/100))}</div>`:''}
    ${p.stock<=0||(ch&&!selOpt)?'<div class="warnbox">Out of stock. Check back soon.</div>':`<div class="row"><div class="qty"><button data-mq="-1" aria-label="Less">−</button><span class="num" id="mq">1</span><button data-mq="1" aria-label="More">+</button></div><button class="btn" data-add="${p.id}">Add to cart</button></div>${stock<=3?`<div class="note">Only ${stock} left</div>`:''}`}
    ${p.description?`<p class="pdesc">${esc(p.description)}</p>`:''}`;
}
function addToCart(id,qty,opt){const p=prod(id);opt=choices(p)?opt:undefined;const ex=cart.find(x=>x.id===id&&(x.opt||null)===(opt||null));const n=Math.min(itemStock(p,opt),(ex?ex.qty:0)+qty);if(n<=0)return toast('That option is sold out','',true);ex?ex.qty=n:cart.push(opt?{id,opt,qty:n}:{id,qty:n});saveCart();toast(`Added ${p.name}${opt?' · '+opt:''}`,'',true)}
const effBase=()=>{const b=Number(D.settings.base_min),c=co&&co.city,m=c&&D.hhMin&&D.hhMin[c];return happyHourStatus().on&&m!=null?Math.min(b,m):b};
const cartSub=()=>cart.reduce((s,x)=>{const p=prod(x.id);return s+(p?itemPrice(p,x.opt):0)*x.qty},0);
function openCart(){
  saveCart();const sub=cartSub(),base=effBase(),low=sub<base;
  $('#layer').innerHTML=`<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-label="Cart"><header><h2 style="font-size:30px">Your cart</h2><button class="x" data-close aria-label="Close">×</button></header>
   <div class="body">${cart.length?cart.map((x,i)=>{const p=prod(x.id);return`<div class="line"><div class="th">${art(p)}</div><div><div style="font-size:14px">${esc(p.name)}</div>${x.opt?`<div class="note">${esc(x.opt)}</div>`:''}<div class="note num">${money(itemPrice(p,x.opt))}</div></div><div class="qty"><button data-cq="${i}" data-d="-1" aria-label="Less">−</button><span class="num">${x.qty}</span><button data-cq="${i}" data-d="1" aria-label="More">+</button></div></div>`}).join(''):'<p class="note">Your cart is empty. Tap a category on the home page to start.</p>'}</div>
   ${cart.length?`<div class="totals"><div><span>Subtotal</span><span class="num">${money(sub)}</span></div>${low?`<div class="warnbox">Add ${money(base-sub)} more. We don't deliver orders under $${base}.</div>`:''}${!D.settings.open?'<div class="warnbox">We are closed right now.</div>':''}<button class="btn" data-go="checkout" ${low||!D.settings.open?'disabled':''}>Check out · pay at the door</button></div>`:''}
  </aside>`;
}

/* ---------- checkout ---------- */
(()=>{try{const r=new URLSearchParams(location.search).get('ref');if(r)store.set('c420ref',r.toUpperCase().slice(0,8))}catch(e){}})();
let co=store.get('c420co',{name:'',phone:'',address:'',city:'',notes:''});co.age=false;if(!co.city&&store.get('c420zip',null))co.city=store.get('c420zip',null).city;
let quote=null,placing=false;
async function refreshQuote(){
  const {data,error}=await sb.rpc('quote_cart',{p_items:cart,p_city:co.city||null,p_phone:co.phone||null,p_ref:co.ref||null});
  quote=error?null:data;drawSummary();
}
function vCheckout(V){
  if(!cart.length){location.hash='#shop';return}
  V.innerHTML=`<div class="wrap page"><h1>Checkout</h1><p class="lede">Pay at the door with cash, Cash App (<b>$420Cargo</b>) or card tap. We'll call or text to confirm, then your driver sends an ETA.</p>
  <div class="checkout"><form class="form" id="cof" novalidate>
   <div class="two"><label>Full name<input id="co-name" required autocomplete="name" value="${esc(co.name)}"></label>
   <label>Mobile number<input id="co-phone" required inputmode="tel" autocomplete="tel" placeholder="(313) 555-0100" value="${esc(co.phone)}"></label></div>
   <label>Street address<input id="co-address" required autocomplete="street-address" value="${esc(co.address)}"></label>
   <label>City<select id="co-city" required><option value="">Choose your city</option>${allCities().map(c=>`<option ${c===co.city?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
   <div id="co-gift"></div>
   <label>Delivery notes (optional)<textarea id="co-notes" rows="2" maxlength="300" placeholder="Gate code, parking, best way to reach you">${esc(co.notes)}</textarea></label>
   <label>Referral code (optional)<input id="co-ref" autocomplete="off" maxlength="8" style="text-transform:uppercase;font-family:var(--f-mono);letter-spacing:.12em" placeholder="ABCDE" value="${esc(co.ref||store.get('c420ref','')||'')}"></label>
   <div class="paypick"><span class="eyebrow">How will you pay at the door?</span><div class="payopts">${PAYS.map(x=>`<button type="button" class="payopt${(co.pay||'cash')===x.id?' on':''}" data-pay="${x.id}"><b>${x.label}</b><small>${x.sub}</small></button>`).join('')}</div></div>
   <label class="check"><input type="checkbox" id="co-age"> <span>I'm 21 or older and will show a valid government ID to the driver. I'll meet the driver at their vehicle with payment ready.</span></label>
   <div id="co-err" class="warnbox" hidden></div>
   <button class="btn" type="submit" id="co-submit" style="justify-self:start;font-size:17px;padding:12px 24px">Place order</button>
   <p class="note">Missed deliveries carry a re-delivery fee of ${esc(D.settings.redeliver)}. Your city not listed? <a href="#areas">See our service area</a>.</p>
  </form>
  <aside class="summary" id="summary"><p class="note">Calculating…</p></aside></div></div>`;
  refreshQuote();
}
function drawGift(sub){
  const el=$('#co-gift');if(!el)return;const g=freeGiftFor(sub),cur=$('#co-giftsel')?.value||co.gift||'';
  el.innerHTML=`<label class="gift">Free with your order <small>(${esc(g.label)})</small><select id="co-giftsel">${g.choices.map(c=>`<option ${c===cur?'selected':''}>${esc(c)}</option>`).join('')}</select></label>`;
}
function drawSummary(){
  const el=$('#summary');if(!el)return;
  if(!quote){el.innerHTML='<p class="note">Couldn\'t load prices. Check your connection.</p>';return}
  const Q=quote;drawGift(Number(Q.subtotal)-Number(Q.discount));
  el.innerHTML=`<h2 style="font-size:26px">Order summary</h2>
   ${Q.lines.map(x=>`<div class="row" style="justify-content:space-between;font-size:14px"><span>${x.qty} × ${esc(x.name)}</span><span class="num">${money(x.price*x.qty)}</span></div>`).join('')}
   <div class="totals"><div><span>Subtotal</span><span class="num">${money(Q.subtotal)}</span></div>
   ${Q.tier?`<div style="color:var(--green)"><span>${esc(Q.tier_name)} member −${Q.pct_off}%</span><span class="num">−${money(Q.discount)}</span></div>`:''}
   <div${Q.hh_free?' style="color:var(--green)"':''}><span>Delivery${Q.hh_free?' · Happy Hour':Q.zone_min!=null?` ($${Number(Q.zone_min)} city minimum)`:''}</span><span class="num">${Q.fee?money(Q.fee):(Q.zone_min!=null?'Free':'Pick a city')}</span></div>
   ${Number(Q.ref_discount)?`<div style="color:var(--green)"><span>Referral discount</span><span class="num">−${money(Q.ref_discount)}</span></div>`:''}
   ${Number(Q.credit_used)?`<div style="color:var(--green)"><span>Your referral credit</span><span class="num">−${money(Q.credit_used)}</span></div>`:''}
   <div class="grand"><span>Due at the door</span><span class="num">${money(Q.total)}</span></div></div>
   ${Q.fee&&Q.happy_hour&&Q.hh_min!=null?`<p class="note" style="color:var(--yellow)">Happy Hour: add ${money(Q.hh_min-(Q.subtotal-Q.discount))} more to reach $${Number(Q.hh_min)} and delivery is free.</p>`:Q.fee&&Q.zone_min!=null?`<p class="note">Add ${money(Q.zone_min-(Q.subtotal-Q.discount))} more to reach your city's $${Number(Q.zone_min)} minimum and skip the fee.</p>`:''}
   ${Q.hh_free?`<p class="note" style="color:var(--green)">Happy Hour free delivery applied. Order by 3pm.</p>`:''}
   ${!Q.tier&&D.tiers.length?`<p class="note">Members save ${Math.min(...D.tiers.map(t=>t.pct_off))}–${Math.max(...D.tiers.map(t=>t.pct_off))}%. Enter the phone on your membership to apply it.</p>`:''}
   ${Q.ref_error?`<div class="warnbox">${esc(Q.ref_error)}</div>`:''}
   ${Q.errors.length?`<div class="warnbox">${esc(Q.errors[0])}</div>`:''}`;
  const b=$('#co-submit');if(b)b.textContent=`Place order · ${money(Q.total)}`;
}
function readCo(){const gs=$('#co-giftsel');co={pay:co.pay||'cash',ref:($('#co-ref')?.value||'').trim().toUpperCase(),gift:gs?gs.value:'',name:$('#co-name').value.trim(),phone:$('#co-phone').value.trim(),address:$('#co-address').value.trim(),city:$('#co-city').value,notes:$('#co-notes').value.trim(),age:$('#co-age').checked};store.set('c420co',{...co,age:undefined})}
async function placeOrder(){
  if(placing)return;readCo();const e=$('#co-err');e.hidden=true;
  const miss=[];if(!co.name)miss.push('your name');if(co.phone.replace(/\D/g,'').length<10)miss.push('a 10-digit mobile number');if(!co.address)miss.push('your street address');if(!co.city)miss.push('your city');
  if(miss.length){e.hidden=false;e.textContent='Please add '+miss.join(', ')+'.';return}
  if(!co.age){e.hidden=false;e.textContent='Confirm you are 21+ and will show ID at delivery.';return}
  placing=true;const b=$('#co-submit');b.disabled=true;b.textContent='Placing order…';
  const {data,error}=await sb.rpc('checkout',{p_ref:co.ref||null,p_items:cart,p_name:co.name,p_phone:co.phone,p_address:co.address,p_city:co.city,p_notes:['PAY: '+payLabel(co.pay),co.gift?'FREE: '+co.gift:'',co.notes].filter(Boolean).join(' · '),p_age_ok:co.age});
  placing=false;
  if(error){e.hidden=false;e.textContent=errMsg(error);b.disabled=false;refreshQuote();return}
  store.set('c420last',{...data,name:co.name,phone:co.phone,pay:co.pay||'cash'});try{localStorage.removeItem('c420ref')}catch(e){};co.ref='';store.set('c420co',{...co,age:undefined});cart=[];saveCart();
  loadAll().catch(()=>{});location.hash='#done';
}
function vDone(V){
  const o=store.get('c420last',null);if(!o){location.hash='#home';return}
  const link=o.my_code?`${location.origin}/?ref=${o.my_code}`:'';
  V.innerHTML=`<div class="wrap page">
  ${Number(o.free_win)?`<div class="winner"><small>🎉 Order #${esc(o.code)}</small><b>You hit the 420!</b><span>We took ${money(o.free_win)} off this order. Every order number ending in 420 is free, up to $${Number(D.promo?.win_cap||100)}.</span></div>`:''}
  <span class="eyebrow">Order received</span><h1>Thanks, ${esc(o.name.split(' ')[0])}</h1>
  <p class="lede">Order <b class="mono">${esc(o.code)}</b> is in. We'll call or text ${esc(o.phone)} to confirm, then your driver will send an ETA.</p>
  <div class="summary" style="max-width:480px">${Number(o.ref_discount)||Number(o.credit_used)?`<p class="note" style="margin:0;color:var(--green)">${Number(o.ref_discount)?`Referral −${money(o.ref_discount)}. `:''}${Number(o.credit_used)?`Credit −${money(o.credit_used)}.`:''}</p>`:''}<div class="totals"><div class="grand"><span>Due at the door · ${esc(payLabel(o.pay))}</span><span class="num">${money(o.total)}</span></div></div>
  ${o.pay==='cashapp'?`<p class="note" style="margin:0">When your driver arrives, send ${money(o.total)} to <b>$420Cargo</b> on Cash App and show the payment screen.</p><a class="btn cashapp" href="https://cash.app/$420Cargo/${Number(o.total).toFixed(2)}" target="_blank" rel="noopener">Open Cash App · $420Cargo</a>`:o.pay==='card'?`<p class="note" style="margin:0">Your driver will have a Square reader. Tap your card or phone to pay.</p>`:`<p class="note" style="margin:0">Exact change helps.</p>`}
  <p class="note" style="margin:0">Meet your driver at their vehicle with a valid 21+ ID.</p></div>
  ${o.my_code?`<div class="refbox"><div><small>Your referral code</small><b class="mono">${esc(o.my_code)}</b></div><p>Give friends $${Number(o.ref_new||10)} off their first order. You get $${Number(o.ref_reward||10)} credit when it's delivered, applied to your next order automatically.</p><div class="row"><button class="btn" id="copyref" data-link="${esc(link)}">Copy my link</button><span class="note mono" id="reflink">${esc(link)}</span></div></div>`:''}
  <p style="margin-top:22px"><a class="btn ghost" href="#shop" style="text-decoration:none">Back to the menu</a></p></div>`;
}

/* ---------- cargo drop ---------- */
const dropT=p=>new Date(p.drop_at).getTime();
const drops=()=>D.products.filter(p=>p.cat==='drop'&&p.drop_at).sort((a,b)=>dropT(a)-dropT(b));
function dropState(p,now=Date.now()){
  if(p.stock<=0)return'sold';
  if(now>=dropT(p))return'live';
  if(p.early_tier&&p.early_minutes>0&&now>=dropT(p)-p.early_minutes*60e3)return'early';
  return'soon';
}
function curDrop(){const d=drops();return d.find(p=>p.stock>0)||d[d.length-1]||null}
const dropNo=p=>'#'+String(p.drop_no||0).padStart(3,'0');
const tierName=id=>(D.tiers.find(t=>t.id===id)||{name:'Member'}).name;
function cd(ms){ms=Math.max(0,ms);const s=Math.floor(ms/1e3),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60,z=n=>String(n).padStart(2,'0');return{d,h:z(h),m:z(m),s:z(x)}}
function sellTime(p){if(!p.sold_out_at)return'';const s=Math.max(0,Math.round((new Date(p.sold_out_at)-dropT(p))/1e3));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}h ${m}m`:m?`${m}m ${x}s`:`${x}s`}
const dropWhen=p=>new Date(p.drop_at).toLocaleString('en-US',{timeZone:'America/Detroit',weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function dropBanner(){
  const p=curDrop();if(!p)return'';const st=dropState(p);
  if(st==='sold'&&Date.now()-dropT(p)>3*864e5)return'';
  const c=cd(dropT(p)-Date.now());
  const msg=st==='live'?`<b>LIVE NOW</b><span>${p.stock} left · ${money(p.price)}</span>`:st==='early'?`<b>${esc(tierName(p.early_tier))} early access is open</b><span>Public release in <i data-cd>${c.h}:${c.m}:${c.s}</i></span>`:st==='sold'?`<b>Sold out${p.sold_out_at?' in '+sellTime(p):''}</b><span>Next drop coming soon</span>`:`<b data-cd>${c.d?c.d+'d ':''}${c.h}:${c.m}:${c.s}</b><span>${esc(dropWhen(p))}</span>`;
  return`<a class="dropban ${st}" href="#drop"><span class="db-no">Cargo Drop ${dropNo(p)}</span><span class="db-msg">${msg}</span><span class="db-go">${st==='live'?'Cop it':'View drop'} →</span></a>`;
}
function dropFeature(){
  const p=curDrop();if(!p)return'';const st=dropState(p);
  if(st==='sold'&&Date.now()-dropT(p)>3*864e5)return'';
  const c=cd(dropT(p)-Date.now()),qty=Math.max(1,p.drop_qty||p.stock||1),value=Number(p.drop_value||0);
  const clock=st==='soon'||st==='early'?`<span class="df-cd num">${c.d?`<b data-fu="d">${c.d}</b>d `:''}<b data-fu="h">${c.h}</b>:<b data-fu="m">${c.m}</b>:<b data-fu="s">${c.s}</b></span>`:st==='live'?`<span class="df-cd num"><b>${p.stock}</b>/${qty} left</span>`:'';
  const sub=st==='sold'?`Gone${p.sold_out_at?' in '+sellTime(p):''} · next drop soon`:`${st==='live'?'':esc(dropWhen(p))+' · '}${money(p.price)}${value>Number(p.price)?` · ${money(value)}+ value`:''}`;
  return`<a class="dropfeat ${st}" href="#drop" data-fst="${st}">
   <div class="df-art">${p.image_url?art(p):dropArt(p)}</div>
   <div class="df-txt"><span class="df-eye">${st==='live'?'Live now':st==='sold'?'Sold out':st==='early'?esc(tierName(p.early_tier))+' early access':'Next drop'} · ${dropNo(p)}</span><b class="df-name">${esc(p.name)}</b><span class="df-when">${sub}</span></div>
   ${clock}
   <span class="df-go">${st==='live'?'Cop it':'View'} →</span></a>`;
}
function gcalLink(p){const f=d=>new Date(d).toISOString().replace(/[-:]|\.\d{3}/g,'');const e=new Date(dropT(p)+30*60e3);return`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Cargo Drop '+dropNo(p)+' · '+p.name)}&dates=${f(p.drop_at)}/${f(e)}&details=${encodeURIComponent(location.origin+'/#drop')}`}
let dropTick=null,dropPoll=null;
function stopDropTimers(){clearInterval(dropTick);clearInterval(dropPoll);dropTick=dropPoll=null}
function vDrop(V){
  const p=curDrop();
  if(!p){V.innerHTML=`<div class="wrap page drop"><span class="eyebrow">Cargo Drop</span><h1>No drop scheduled</h1><p class="lede">Limited mystery bags, numbered, never restocked. The next one gets announced here first.</p><p><a class="btn ghost" href="#shop" style="text-decoration:none">Shop the menu</a></p></div>`;return}
  V.innerHTML=`<div class="wrap page drop" id="dropwrap"></div>`;drawDrop(p);
  dropTick=setInterval(()=>{const q=curDrop();if(q)drawDrop(q,true)},1000);
  dropPoll=setInterval(pollDrop,8000);
}
async function pollDrop(){const p=curDrop();if(!p)return;const {data}=await sb.from('products').select('id,stock,sold_out_at,drop_at,price,active').eq('id',p.id).single();if(data){Object.assign(p,data);drawDrop(p)}}
function drawDrop(p,tickOnly){
  const st=dropState(p),c=cd(dropT(p)-Date.now()),qty=Math.max(1,p.drop_qty||p.stock||1),left=Math.max(0,p.stock),pct=Math.round(left/qty*100);
  const W=$('#dropwrap');if(!W)return;
  if(tickOnly&&W.dataset.st===st){W.querySelectorAll('[data-u]').forEach(e=>e.textContent=c[e.dataset.u]);const dd=W.querySelector('[data-d]');if(dd)dd.textContent=c.d;return}
  W.dataset.st=st;W.classList.toggle('spooky',/hallow/i.test(p.name));
  const past=drops().filter(x=>x!==p&&x.stock<=0).reverse().slice(0,6);
  const value=Number(p.drop_value||0);
  W.innerHTML=`
  <div class="dr-head"><span class="dr-no">Cargo Drop ${dropNo(p)}</span><span class="dr-st ${st}">${{soon:'Dropping soon',early:'Early access',live:'Live now',sold:'Sold out'}[st]}</span></div>
  <div class="dr-main">
   <div class="dr-art">${p.image_url?art(p):dropArt(p)}${st==='sold'?'<span class="dr-stamp">Sold out</span>':''}</div>
   <div class="dr-info">
    <h1>${esc(p.name)}</h1>
    <div class="dr-price"><b class="num">${money(p.price)}</b>${value>Number(p.price)?`<span>${money(value)}+ value</span>`:''}</div>
    ${p.description?`<p class="dr-desc">${esc(p.description)}</p>`:''}
    ${st==='soon'||st==='early'?`<div class="dr-cd" aria-label="Countdown">${c.d?`<div><b class="num" data-d>${c.d}</b><small>days</small></div>`:''}<div><b class="num" data-u="h">${c.h}</b><small>hrs</small></div><div><b class="num" data-u="m">${c.m}</b><small>min</small></div><div><b class="num" data-u="s">${c.s}</b><small>sec</small></div></div>
     <p class="note">Drops ${esc(dropWhen(p))} · Metro Detroit time</p>`:''}
    <div class="dr-bar"><div class="dr-fill" style="width:${st==='soon'||st==='early'?100:pct}%"></div></div>
    <div class="dr-left num">${st==='sold'?`0 / ${qty} left${p.sold_out_at?` · gone in ${sellTime(p)}`:''}`:st==='live'?`${left} / ${qty} left`:`${qty} bags · never restocked`}</div>
    ${st==='live'?`<button class="btn dr-cop" id="copit" data-cop="${p.id}">Cop it · ${money(p.price)}</button>`
     :st==='early'?`<div class="dr-early"><b>${esc(tierName(p.early_tier))} members: you're in.</b> Early access is open now. Use the phone number on your membership at checkout.</div><button class="btn dr-cop" id="copit" data-cop="${p.id}">Cop it early · ${money(p.price)}</button>`
     :st==='soon'?`<a class="btn ghost dr-cal" href="${gcalLink(p)}" target="_blank" rel="noopener">Add a reminder to my calendar</a>${p.early_tier&&p.early_minutes?`<p class="note">${esc(tierName(p.early_tier))} members get in ${p.early_minutes} minutes early. <a href="#members">See membership</a>.</p>`:''}`
     :`<a class="btn ghost" href="#shop" style="text-decoration:none">Shop the menu</a>`}
    <ul class="dr-rules"><li>Limit ${p.drop_limit||1} per customer, by phone number</li><li>Pay at the door (cash, Cash App or card), ${money(D.settings.base_min||0)} minimum still applies</li><li>Numbered and never restocked</li><li>Referral card in every bag</li></ul>
   </div>
  </div>
  ${past.length?`<h2 class="dr-past-h">Past drops</h2><div class="dr-past">${past.map(x=>`<div><span class="mono">${dropNo(x)}</span><b>${esc(x.name)}</b><small>${x.sold_out_at?'Sold out in '+sellTime(x):'Sold out'}</small></div>`).join('')}</div>`:''}`;
}
function dropArt(p){return`<svg viewBox="0 0 200 200" aria-hidden="true"><rect width="200" height="200" fill="#111"/><path d="M52 72h96l10 104H42z" fill="#f7c31b" stroke="#000" stroke-width="3"/><path d="M76 72c0-20 10-32 24-32s24 12 24 32" fill="none" stroke="#f7c31b" stroke-width="8"/><text x="100" y="138" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="54" fill="#000">?</text><text x="100" y="166" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="13" font-weight="600" fill="#000">DROP ${dropNo(p)}</text></svg>`}
async function copIt(id){
  const b=$('#copit');if(b){b.disabled=true;b.textContent='Checking…'}
  await pollDrop();const p=prod(id);
  if(!p||p.stock<=0){toast('Sold out','Every bag is gone. Watch for the next drop.',true);drawDrop(p);return}
  cart=cart.filter(x=>x.id!==id);cart.push({id,qty:1});saveCart();location.hash='#checkout';
}

/* ---------- membership ---------- */
function vMembers(V){
  V.innerHTML=`<div class="wrap page"><span class="eyebrow">Private membership</span><h1>Join the club</h1>
  <p class="lede">Monthly membership, paid at the door with any delivery (cash, Cash App or card). Apply below. We review every application and confirm by phone, then your discount applies automatically at checkout.</p>
  <div class="tiers">${D.tiers.map((t,i)=>`<div class="tier ${i===1?'hot':''}"><span class="eyebrow">${i===1?'Most popular':'Tier '+(i+1)}</span><h3>${esc(t.name)}</h3><div class="price">$${Number(t.price)}<small> / month</small></div><ul>${t.perks.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><button class="btn ${i===1?'':'ghost'}" data-tier="${t.id}">Apply for ${esc(t.name)}</button></div>`).join('')}</div>
  <form class="form" id="memf" novalidate><h2 style="font-size:30px">Membership application</h2>
   <div class="two"><label>Full name<input id="m-name" required autocomplete="name"></label><label>Mobile number<input id="m-phone" inputmode="tel" autocomplete="tel" required placeholder="(313) 555-0100"></label></div>
   <label>Date of birth<input id="m-dob" type="date" required autocomplete="bday" max="${new Date(Date.now()-21*365.25*864e5).toISOString().slice(0,10)}"></label>
   <label>Tier<select id="m-tier">${D.tiers.map(t=>`<option value="${t.id}">${esc(t.name)} · $${Number(t.price)}/mo</option>`).join('')}</select></label>
   <label class="check"><input type="checkbox" id="m-age"> <span>I'm 21+ and understand dues are paid to my driver each month.</span></label>
   <div id="m-err" class="warnbox" hidden></div>
   <button class="btn" type="submit" style="justify-self:start">Submit application</button></form></div>`;
}
async function applyMember(f){
  const name=$('#m-name').value.trim(),ph=$('#m-phone').value,err=$('#m-err');err.hidden=true;
  if(!name||ph.replace(/\D/g,'').length<10){err.hidden=false;err.textContent='Add your name and a 10-digit mobile number.';return}
  const dob=$('#m-dob').value;
  if(!dob){err.hidden=false;err.textContent='Add your date of birth.';return}
  const b=new Date(dob+'T12:00'),n=new Date(),age=n.getFullYear()-b.getFullYear()-((n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))?1:0);
  if(age<21){err.hidden=false;err.textContent='You must be 21 or older to become a member.';return}
  if(!$('#m-age').checked){err.hidden=false;err.textContent='Confirm you are 21+ and agree to monthly dues.';return}
  const {data,error}=await sb.rpc('apply_membership',{p_name:name,p_phone:ph,p_tier:$('#m-tier').value,p_birthdate:dob});
  if(error){err.hidden=false;err.textContent=errMsg(error);return}
  f.innerHTML=`<h2 style="font-size:30px">Application received</h2><p class="lede" style="margin:0">Thanks, ${esc(name.split(' ')[0])}. We'll call ${esc(data.phone)} to confirm. Your first month is collected with your next delivery.</p>`;
}

/* ---------- events ---------- */
function vEvents(V){
  const mine=store.get('c420rsvp',{});
  V.innerHTML=`<div class="wrap page"><span class="eyebrow">21+ · ID at the door</span><h1>Events</h1><p class="lede">Tastings, drops and pop-ups around Metro Detroit. Member events need an active membership. Exact addresses go to people who RSVP.</p>
  <div class="events">${D.events.map(e=>{const d=new Date(e.starts_on+'T12:00');return`<article class="event"><div class="date"><span>${d.toLocaleDateString('en-US',{month:'short'}).toUpperCase()}</span><b>${d.getDate()}</b><span>${d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()}</span></div>
   <div><div class="row">${e.members_only?'<span class="pill p-new">Members only</span>':'<span class="pill p-muted">Open to 21+</span>'}</div><h3 style="margin-top:6px">${esc(e.title)}</h3><p>${[e.time_label,e.place].filter(Boolean).map(esc).join(' · ')}</p>${e.description?`<p>${esc(e.description)}</p>`:''}</div>
   <button class="btn ${mine[e.id]?'green':''}" data-rsvp="${e.id}">${mine[e.id]?'Going ✓':'RSVP'}</button></article>`}).join('')||'<p class="note">No events on the calendar right now. Members hear about new drops and events first.</p>'}</div></div>`;
}
async function rsvp(id){
  const mine=store.get('c420rsvp',{});const going=!mine[id];
  const {error}=await sb.rpc('rsvp_event',{p_event:id,p_going:going});
  if(error){toast(errMsg(error),'',true);return}
  if(going)mine[id]=1;else delete mine[id];store.set('c420rsvp',mine);
  const ev=D.events.find(x=>x.id===id);if(going)toast(`You're on the list for ${ev.title}`,ev.members_only?'Bring your member ID and 21+ ID.':'Bring a valid 21+ ID.',true);
  vEvents($('#view'));
}

/* ---------- events wiring ---------- */
document.addEventListener('click',e=>{
  const t=e.target.closest('button,a,[data-close]');if(!t)return;
  if(t.matches('[data-close]')){$('#layer').innerHTML='';return}
  if(t.id==='cartbtn'){openCart();return}
  if(t.dataset.f){shopFilter={type:t.dataset.f,val:t.dataset.v||null};if(route==='shop'&&location.hash!=='#shop')history.replaceState(null,'','#shop');if(t.closest('.fsheet'))$('#layer').innerHTML='';if(route!=='shop')location.hash='#shop';else{vShop($('#view'));window.scrollTo(0,0)}return}
  if(t.id==='filterbtn'){openFilters();return}
  if(t.dataset.cq2){const box=t.closest('.cq'),sp=box.querySelector('span'),max=+box.querySelector('[data-max]').dataset.max;sp.textContent=Math.max(1,Math.min(max,+sp.textContent+ +t.dataset.cq2));return}
  if(t.dataset.quick){const n=+t.closest('.cardbuy').querySelector('.cq span').textContent;addToCart(t.dataset.quick,n);t.textContent='Added ✓';setTimeout(()=>{t.textContent='Add to cart'},1200);return}
  if(t.id==='jz-pickup'){$('#zip-out').innerHTML='<div class="zc-res no"><b>Pickup isn\'t available.</b><span>Cargo+420 is delivery only. Enter your ZIP code below.</span></div>';return}
  if(t.id==='menubtn'){const n=$('#nav'),o=!n.classList.contains('open');n.classList.toggle('open',o);t.setAttribute('aria-expanded',o);return}
  if(t.dataset.p){openProduct(t.dataset.p);return}
  if(t.dataset.mq){const el=$('#mq');el.textContent=Math.max(1,+el.textContent+ +t.dataset.mq);return}
  if(t.dataset.opt!==undefined){selOpt=t.dataset.opt;const p=prod(curP);if(p)drawProduct(p);return}
  if(t.dataset.add){addToCart(t.dataset.add,+$('#mq').textContent,selOpt);$('#layer').innerHTML='';return}
  if(t.dataset.cq!==undefined){const x=cart[+t.dataset.cq];if(!x)return;const p=prod(x.id);x.qty=Math.min(itemStock(p,x.opt),p.cat==='drop'?(p.drop_limit||1):1e9,x.qty+ +t.dataset.d);saveCart();openCart();return}
  if(t.dataset.go){$('#layer').innerHTML='';location.hash='#'+t.dataset.go;return}
  if(t.dataset.tier){$('#m-tier').value=t.dataset.tier;$('#memf').scrollIntoView({behavior:'smooth'});$('#m-name').focus({preventScroll:true});return}
  if(t.dataset.rsvp){rsvp(t.dataset.rsvp);return}
  if(t.dataset.pay){co.pay=t.dataset.pay;store.set('c420co',{...co,age:undefined});document.querySelectorAll('.payopt').forEach(b=>b.classList.toggle('on',b.dataset.pay===co.pay));return}
  if(t.dataset.cop){copIt(t.dataset.cop);return}
  if(t.id==='zipchip'){openZipModal();return}
  if(t.id==='copyref'){const l=t.dataset.link,msg=`Get $${Number(D.promo?.ref_new||10)} off your first Cargo+420 delivery: ${l}`;(navigator.share?navigator.share({text:msg}).catch(()=>{}):navigator.clipboard?.writeText(msg).then(()=>toast('Link copied','Send it to a friend.',true)).catch(()=>{}));return}
  if(t.id==='zip-loc'){useLocation();return}
  if(t.closest('.zc-res')&&t.matches('a[href="#shop"]')){$('#layer').innerHTML=''}
});
let qT;
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='sort'||t.id==='sort2'){sortBy=t.value;vShop($('#view'));return}
  if(t.id==='co-city'||t.id==='co-phone'||t.id==='co-ref'){readCo();refreshQuote();return}
});
document.addEventListener('input',e=>{
  if(e.target.id==='shopq'){clearTimeout(qT);qT=setTimeout(()=>{q=e.target.value;vShop($('#view'));const i=$('#shopq');i.focus();i.setSelectionRange(q.length,q.length)},250)}
  if(e.target.id==='shopq2'){clearTimeout(qT);qT=setTimeout(()=>{q=e.target.value;vShop($('#view'))},250)}
});
document.addEventListener('submit',e=>{e.preventDefault();if(e.target.id==='hsearch'){hsGo($('#hq').value);return}if(e.target.id==='cof')placeOrder();if(e.target.id==='memf')applyMember(e.target);if(e.target.id==='zipf')checkZip($('#zip-in').value)});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#layer').innerHTML=''});

/* ---------- header search + category bar ---------- */
function drawCatbar(){
  const el=$('#catbar .wrap');if(!el)return;
  const cur=route!=='shop'?'':shopFilter.type==='cat'||shopFilter.type==='strain'?shopFilter.val:shopFilter.type==='feat'?'liked':shopFilter.type==='all'&&!q?'all':'';
  const have=new Set(shopItems().map(p=>p.cat));
  el.innerHTML=`<a href="#shop" data-catall="1" class="${cur==='all'?'on':''}">Shop all</a>`+`<a href="#liked" class="${cur==='liked'?'on':''}">Most liked</a>`+CATS.filter(c=>have.has(c.id)).map(c=>`<a href="#${c.id}" class="${cur===c.id?'on':''}">${c.name}</a>`).join('')+`<span class="cb-div"></span>`+STRAINS.map(x=>`<a href="#${x.id}" class="cb-st ${cur===x.id?'on':''}">${x.name}</a>`).join('')+`<a href="#specials" class="cb-sp">Happy Hour</a>`;
}
function hsMatches(v){v=v.trim().toLowerCase();if(!v)return[];return shopItems().filter(p=>(p.name+' '+(p.tags||[]).join(' ')+' '+catName(p.cat)+' '+((choices(p)||[]).map(c=>c.label).join(' '))).toLowerCase().includes(v))}
function drawSuggest(v){
  const d=$('#hsdrop');if(!d)return;const m=hsMatches(v);
  if(!v.trim()){d.hidden=true;return}
  d.innerHTML=(m.length?m.slice(0,6).map(p=>`<button type="button" class="hs-row" data-p="${p.id}"><span class="hs-th">${art(p)}</span><span class="hs-tx"><b>${esc(p.name)}</b><small>${esc(catName(p.cat))} · ${p.stock<=0?'Out of stock':fromPrice(p)}</small></span></button>`).join('')+`<button type="submit" class="hs-all">See all ${m.length} result${m.length===1?'':'s'} →</button>`:`<p class="hs-none">No matches for “${esc(v)}”. Try a strain, brand or category.</p>`);
  d.hidden=false;
}
function hsGo(v){q=v.trim();shopFilter={type:'all',val:null};$('#hsdrop').hidden=true;$('#hq').blur();if(route!=='shop')location.hash='#shop';else{vShop($('#view'));drawCatbar();window.scrollTo(0,0)}}
let hsT;
$('#hq')?.addEventListener('input',e=>{clearTimeout(hsT);const v=e.target.value;hsT=setTimeout(()=>{drawSuggest(v);if(route==='shop'){q=v.trim();vShop($('#view'));drawCatbar()}},120)});
$('#hq')?.addEventListener('focus',e=>{if(e.target.value.trim())drawSuggest(e.target.value)});
$('#hq')?.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#hsdrop').hidden=true;e.target.blur()}if(e.key==='ArrowDown'){const f=document.querySelector('#hsdrop button');if(f){e.preventDefault();f.focus()}}});
$('#hsdrop')?.addEventListener('keydown',e=>{const bs=[...document.querySelectorAll('#hsdrop button')],i=bs.indexOf(document.activeElement);if(e.key==='ArrowDown'&&i<bs.length-1){e.preventDefault();bs[i+1].focus()}if(e.key==='ArrowUp'){e.preventDefault();i>0?bs[i-1].focus():$('#hq').focus()}if(e.key==='Escape'){$('#hsdrop').hidden=true;$('#hq').focus()}});
document.addEventListener('click',e=>{const f=$('#hsearch');if(f&&!f.contains(e.target))$('#hsdrop').hidden=true;if(e.target.closest('.hs-row'))$('#hsdrop').hidden=true;const a=e.target.closest('[data-catall]');if(a){shopFilter={type:'all',val:null};q='';const i=$('#hq');if(i)i.value='';if(route==='shop'){e.preventDefault();vShop($('#view'));drawCatbar();window.scrollTo(0,0)}}},true);
function setHdr(){const t=document.querySelector('.top');if(t)document.documentElement.style.setProperty('--hdr',t.offsetHeight+'px')}
window.addEventListener('resize',setHdr);

/* ---------- age gate + boot ---------- */
const gate=$('#gate');gate.hidden=store.get('c420age',0)===1;
$('#gate-yes').onclick=()=>{store.set('c420age',1);gate.hidden=true};
$('#gate-no').onclick=()=>{$('#gate-msg').hidden=false};
loadAll().then(()=>{go();setHdr()}).catch(err=>{$('#view').innerHTML=`<div class="wrap loading">We couldn't load the menu. Refresh the page to try again.<br><small>${esc(errMsg(err))}</small></div>`});
setInterval(()=>{if(route!=='home')return;const b=document.querySelector('.dropfeat');if(!b)return;const p=curDrop();if(!p)return;
  if(b.dataset.fst!==dropState(p)){const t=document.createElement('div');t.innerHTML=dropFeature();t.firstElementChild?b.replaceWith(t.firstElementChild):b.remove();return}
  const c=cd(dropT(p)-Date.now());b.querySelectorAll('[data-fu]').forEach(e=>e.textContent=c[e.dataset.fu])},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&['shop','home','drop'].includes(route))loadAll().then(render).catch(()=>{})});

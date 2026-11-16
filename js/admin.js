/* Cargo+420 owner dashboard (installable PWA) */
const A={orders:[],customers:[],drivers:[],members:[],products:[],zones:[],settings:{},tiers:[],events:[],zips:[]};
const SL={new:'New',confirmed:'Confirmed',out:'Out for delivery',delivered:'Delivered',cancelled:'Cancelled'};
const isToday=ts=>new Date(ts).toDateString()===new Date().toDateString();
const ago=ts=>{const m=Math.round((Date.now()-new Date(ts))/60000);if(m<1)return'just now';if(m<60)return m+'m ago';const h=Math.floor(m/60);if(h<24)return h+'h '+(m%60)+'m ago';return Math.floor(h/24)+'d ago'};
const tierName=id=>(A.tiers.find(t=>t.id===id)||{name:id}).name;
const drvName=id=>(A.drivers.find(d=>d.id===id)||{}).name||'';
const ls={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
let ROLE='owner',ROLE_NAME='';
const ROLE_TABS={owner:null,inventory:['inventory','drops'],marketing:['drops','events','customers','reports','analytics']};
const ROLE_LABEL={owner:'Owner',driver:'Driver',marketing:'Marketing',inventory:'Inventory'};
let custQuiet=false,tab='orders',ordFilter='active',custQ='',invQ='',flashIds=new Set(),user=null,channel=null;
const V=()=>$('#view');

/* ---------- service worker + push ---------- */
let swReg=null;
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').then(r=>{swReg=r;if(user)render()}).catch(()=>{});
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='push'&&document.visibilityState==='visible'){reloadData()}})}
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function b64ToU8(s){const p='='.repeat((4-s.length%4)%4);const b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...b].map(c=>c.charCodeAt(0)))}
async function pushState(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))return isIOS&&!standalone?'ios-install':'unsupported';
  if(isIOS&&!standalone)return'ios-install';
  if(Notification.permission==='denied')return'denied';
  const reg=swReg||await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
  return sub?'on':'off';
}
async function enablePush(){
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){toast('Alerts are blocked','Allow notifications for this app in your phone settings, then try again.');return render()}
    const reg=swReg||await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToU8(CFG.VAPID_PUBLIC)});
    const j=sub.toJSON();
    const label=(isIOS?'iPhone':/Android/.test(navigator.userAgent)?'Android':'Computer')+' · '+new Date().toLocaleDateString();
    const {error}=await sb.from('push_subscriptions').upsert({endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,user_id:user.id,label},{onConflict:'endpoint'});
    if(error)throw error;
    toast('Phone alerts are on','Every new order will buzz this device.',true);
  }catch(e){toast('Could not turn on alerts',errMsg(e))}
  render();
}
async function disablePush(){
  const reg=swReg||await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
  if(sub){await sb.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe()}
  toast('Alerts turned off on this device','',true);render();
}
async function testPush(){
  const {data:{session}}=await sb.auth.getSession();
  try{
    const r=await fetch(CFG.SUPABASE_URL+'/functions/v1/notify-order',{method:'POST',headers:{'Content-Type':'application/json',apikey:CFG.SUPABASE_KEY,Authorization:'Bearer '+session.access_token},body:'{}'});
    const j=await r.json();if(!r.ok)throw new Error(j.error||'Test failed');
    toast(`Test sent to ${j.sent} device${j.sent===1?'':'s'}`,j.sent?'It should arrive in a few seconds.':'Turn on alerts on a device first.',true);
  }catch(e){toast('Test alert failed',errMsg(e))}
}

/* ---------- in-app chime ---------- */
let actx=null;
function unlockAudio(){try{actx=actx||new (window.AudioContext||window.webkitAudioContext)();actx.resume()}catch(e){}}
document.addEventListener('pointerdown',unlockAudio,{once:true});
function chime(){if(!actx)return;try{const t=actx.currentTime;[880,1320,1760].forEach((f,i)=>{const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=f;g.gain.setValueAtTime(0,t+i*.14);g.gain.linearRampToValueAtTime(.25,t+i*.14+.02);g.gain.exponentialRampToValueAtTime(.001,t+i*.14+.4);o.connect(g).connect(actx.destination);o.start(t+i*.14);o.stop(t+i*.14+.45)})}catch(e){}}

/* ---------- auth ---------- */
function vAuth(mode='in',msg=''){
  $('#signout').hidden=true;
  V().innerHTML=`<form class="authbox" id="authf" data-mode="${mode}"><img src="img/logo.webp" alt="">
   <h1 style="font-size:34px;text-align:center">${mode==='up'?'Create your account':mode==='reset'?'Reset password':mode==='newpw'?'Set a new password':'Team sign in'}</h1>
   ${mode==='up'?'<label>Your name<input id="a-name" autocomplete="name" required></label>':''}
   ${mode!=='newpw'?'<label>Email<input id="a-email" type="email" autocomplete="username" required></label>':''}
   ${mode!=='reset'?`<label>Password<input id="a-pw" type="password" autocomplete="${mode==='in'?'current-password':'new-password'}" minlength="8" required></label>`:''}
   ${mode==='up'?`<label>Your role<select id="a-role" required><option value="">Choose your role</option><option value="driver">Driver</option><option value="inventory">Inventory</option><option value="marketing">Marketing</option><option value="owner">Owner</option></select></label>`:''}
   <button class="btn">${mode==='up'?'Create account':mode==='reset'?'Email me a reset link':mode==='newpw'?'Save password':'Sign in'}</button>
   ${msg?`<p class="warnbox">${esc(msg)}</p>`:''}
   <div class="row" style="justify-content:space-between">
    ${mode==='in'?'<button type="button" class="linkbtn" data-auth="reset">Forgot password?</button><button type="button" class="linkbtn" data-auth="up">New team member? Create an account</button>':'<button type="button" class="linkbtn" data-auth="in">Back to sign in</button>'}
   </div>
   ${mode==='up'?'<p class="note">Your role is a request. An owner approves it under Settings → Team before you can see anything.</p>':''}
  </form>`;
}
async function submitAuth(f){
  const mode=f.dataset.mode,email=$('#a-email')?.value.trim(),pw=$('#a-pw')?.value;
  const btn=f.querySelector('.btn');btn.disabled=true;
  let r;
  if(mode==='in')r=await sb.auth.signInWithPassword({email,password:pw});
  if(mode==='up'){const role=$('#a-role').value,name=($('#a-name').value||'').trim();if(!role||!name){btn.disabled=false;return vAuth('up','Add your name and choose your role.')}
    r=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+'/admin.html',data:{name,role}}});
    if(!r.error&&!r.data.session){return vAuth('in',`Check your email and tap the confirmation link, then sign in. An owner will approve your ${ROLE_LABEL[role]} access.`)}}
  if(mode==='reset'){r=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/admin.html'});if(!r.error)return vAuth('in','If that email has an account, a reset link is on its way.')}
  if(mode==='newpw'){r=await sb.auth.updateUser({password:pw});if(!r.error){toast('Password updated','',true);return boot()}}
  btn.disabled=false;
  if(r?.error)vAuth(mode,errMsg(r.error));
}

/* ---------- data ---------- */
async function reloadData(){
  const since=new Date(Date.now()-90*864e5).toISOString();
  const res=await Promise.all([
    sb.from('orders').select('*').or(`created_at.gte.${since},status.in.(new,confirmed,out)`).order('created_at',{ascending:false}).limit(3000),
    sb.from('customers').select('*').order('updated_at',{ascending:false}).limit(5000),
    sb.from('drivers').select('*').order('created_at'),
    sb.from('members').select('*').order('applied_at',{ascending:false}),
    sb.from('products').select('*').order('name'),
    sb.from('zones').select('*').order('sort'),
    sb.from('store_settings').select('*').eq('id',1).single(),
    sb.from('tiers').select('*').order('sort'),
    sb.from('events').select('*').order('starts_on'),
    sb.from('zip_codes').select('*').order('zip'),
    sb.from('promo_settings').select('*').eq('id',1).single()]);
  const bad=res.find(x=>x.error);if(bad)throw bad.error;
  [A.orders,A.customers,A.drivers,A.members,A.products,A.zones,A.settings,A.tiers,A.events,A.zips,A.promo]=res.map(x=>x.data);
  await loadYtd(false);render();
}
/* ---------- sales year to date ---------- */
let ytdT=null;
async function loadYtd(draw=true){const {data,error}=await sb.rpc('sales_ytd');if(!error&&data){A.ytd=data;if(draw&&tab==='orders'){const el=$('#ytd');if(el)el.outerHTML=ytdBar()}}}
function ytdSoon(){clearTimeout(ytdT);ytdT=setTimeout(()=>loadYtd(true),1500)}
const money$=n=>'$'+Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
function ytdBar(){
  const y=A.ytd;if(!y)return'<div id="ytd"></div>';
  const ms=(y.months||[]).map(Number),max=Math.max(1,...ms),now=new Date(),cur=now.getMonth(),L='JFMAMJJASOND';
  const thisM=ms[cur]||0,avg=y.orders?y.total/y.orders:0;
  return`<section class="ytd" id="ytd"><div class="ytd-l"><span class="eyebrow">Sales year to date · ${y.year}</span><b class="num">${money$(y.total)}</b><span class="ytd-sub">${y.orders} delivered order${y.orders===1?'':'s'} · avg ${money$(avg)} · ${now.toLocaleString('en-US',{month:'long'})} ${money$(thisM)}</span></div>
   <div class="ytd-m" aria-label="Sales by month">${ms.map((v,i)=>`<div class="${i===cur?'cur':i>cur?'fut':''}" title="${new Date(y.year,i,1).toLocaleString('en-US',{month:'long'})}: ${money$(v)}"><i style="--h:${i>cur?0:Math.max(v?.06:.02,v/max).toFixed(3)}"></i><small>${L[i]}</small></div>`).join('')}</div></section>`;
}
function subscribe(){
  if(channel)sb.removeChannel(channel);
  channel=sb.channel('owner-live')
   .on('postgres_changes',{event:'*',schema:'public',table:'orders'},async p=>{
     if(p.eventType==='INSERT'){const o=p.new;if(!A.orders.some(x=>x.id===o.id))A.orders.unshift(o);flashIds.add(o.id);setTimeout(()=>flashIds.delete(o.id),8000);
       toast(`New order ${o.code} · ${money(o.total)}`,`${o.cust_name} · ${o.city} · ${payOf(o)}`);chime();titleFlash();
       const {data}=await sb.from('customers').select('*').eq('phone',o.cust_phone).maybeSingle();if(data){A.customers=A.customers.filter(c=>c.id!==data.id);A.customers.unshift(data)}
       sb.from('products').select('*').order('name').then(r=>{if(r.data)A.products=r.data;render()});}
     else if(p.eventType==='UPDATE'){const i=A.orders.findIndex(x=>x.id===p.new.id);if(i>=0)A.orders[i]=p.new;else A.orders.unshift(p.new);ytdSoon()}
     else if(p.eventType==='DELETE'){A.orders=A.orders.filter(x=>x.id!==p.old.id)}
     render();})
   .on('postgres_changes',{event:'*',schema:'public',table:'members'},p=>{
     if(p.eventType==='INSERT'){A.members.unshift(p.new);if(p.new.status==='pending'){toast('New membership application',`${p.new.name} · ${tierName(p.new.tier)}`);chime()}}
     else if(p.eventType==='UPDATE'){const i=A.members.findIndex(x=>x.id===p.new.id);if(i>=0)A.members[i]=p.new}
     else A.members=A.members.filter(x=>x.id!==p.old.id);
     render();})
   .subscribe(s=>{liveOk=s==='SUBSCRIBED';const el=$('#livetxt');if(el)el.textContent=liveOk?'Live':'Reconnecting…'});
}
let liveOk=false,titleTimer=null;
function titleFlash(){clearInterval(titleTimer);let k=0;titleTimer=setInterval(()=>{document.title=k++%2?'Cargo+420 Orders':'● New order';if(k>12){clearInterval(titleTimer);document.title='Cargo+420 Orders'}},900)}
async function upd(table,id,patch){
  const {data,error}=await sb.from(table).update(patch).eq('id',id).select().single();
  if(error){toast('Not saved',errMsg(error));return null}
  const arr=A[table];const i=arr.findIndex(x=>x.id===id);if(i>=0)arr[i]=data;return data;
}

/* ---------- shell ---------- */
async function render(){
  if(!user)return;
  const today=A.orders.filter(o=>isToday(o.created_at)&&o.status!=='cancelled');
  const sales=today.filter(o=>o.status==='delivered').reduce((s,o)=>s+Number(o.collected??o.total),0);
  const street=A.orders.filter(o=>o.status==='out'&&isCash(o)).reduce((s,o)=>s+Number(o.total),0)+A.orders.filter(o=>o.status==='delivered'&&!o.cash_in&&isCash(o)).reduce((s,o)=>s+Number(o.collected??o.total),0);
  const nNew=A.orders.filter(o=>o.status==='new').length,pend=A.members.filter(m=>m.status==='pending').length,low=A.products.filter(p=>p.active&&p.cat!=='drop'&&p.stock<=3).length;
  const liveDrop=A.products.some(p=>p.cat==='drop'&&p.active&&p.stock>0&&p.drop_at&&new Date(p.drop_at)<=new Date())?'LIVE':0;
  let tabs=[['orders','Orders',nNew],['customers','Customers'],['drivers','Drivers & cash'],['inventory','Inventory',low],['drops','Drops',liveDrop],['members','Members',pend],['events','Events'],['reports','Reports'],['analytics','Analytics'],['settings','Settings']];
  if(ROLE_TABS[ROLE]){tabs=tabs.filter(t=>ROLE_TABS[ROLE].includes(t[0]));if(!ROLE_TABS[ROLE].includes(tab))tab=ROLE_TABS[ROLE][0]}
  const owner=ROLE==='owner';
  const ps=owner?await pushState():null;
  const focus=document.activeElement?.id;
  V().innerHTML=`<div class="wrap adm">
   <div class="admtop"><div><span class="eyebrow">Cargo+420 · ${ROLE_LABEL[ROLE]} dashboard${ROLE_NAME?' · '+esc(ROLE_NAME):''}</span><h1 style="font-size:40px">${tab==='orders'?'Live orders':tabs.find(t=>t[0]===tab)[1]}</h1></div>
    <div class="row"><span class="live"><i style="${liveOk?'':'background:var(--warn)'}"></i><span id="livetxt">${liveOk?'Live':'Connecting…'}</span></span>
     ${owner?`<button class="btn sm ${A.settings.open?'green':'red'}" id="openbtn">${A.settings.open?'Taking orders':'Closed · not taking orders'}</button>`:''}</div></div>
   ${owner?alertCard(ps):''}
   ${owner&&tab==='orders'?ytdBar():''}
   <div class="kpis" ${owner?'':'hidden'}>
    <div class="kpi"><div class="l">Today's sales (collected)</div><div class="v">${money(sales)}</div></div>
    <div class="kpi"><div class="l">Orders today</div><div class="v">${today.length}</div></div>
    <div class="kpi"><div class="l">Avg ticket</div><div class="v">${money(today.length?today.reduce((s,o)=>s+Number(o.total),0)/today.length:0)}</div></div>
    <div class="kpi cash"><div class="l">Cash on the street</div><div class="v">${money(street)}</div></div>
   </div>
   <div class="tabs" role="tablist">${tabs.map(([id,l,b])=>`<button role="tab" class="${tab===id?'on':''}" data-tab="${id}">${l}${b?`<span class="b">${b}</span>`:''}</button>`).join('')}</div>
   <div id="admbody"></div></div>`;
  ({orders:aOrders,customers:aCustomers,drivers:aDrivers,inventory:aInventory,drops:aDrops,members:aMembers,events:aEvents,reports:aReports,analytics:aAnalytics,settings:aSettings}[tab])($('#admbody'));
  if(!owner)document.querySelectorAll('#admbody [data-cnote],#admbody [data-idv]').forEach(e=>e.disabled=true);
  if(owner&&tab==='settings')loadTeam();
  if(focus&&$('#'+focus)){const el=$('#'+focus);el.focus();if(el.setSelectionRange&&typeof el.value==='string')try{el.setSelectionRange(el.value.length,el.value.length)}catch(e){}}
}
function alertCard(ps){
  if(ps==='on')return`<div class="row note" style="justify-content:flex-end"><span>🔔 Phone alerts are on for this device.</span><button class="linkbtn" id="testpush">Send test alert</button><button class="linkbtn" id="offpush">Turn off here</button></div>`;
  if(ps==='ios-install')return`<div class="install"><b>Get order alerts on this iPhone</b><ol><li>Tap the Share button in Safari.</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li><li>Open <b>Cargo Orders</b> from your home screen, sign in, and tap <b>Turn on phone alerts</b>.</li></ol><span class="note">iPhone needs iOS 16.4 or newer.</span></div>`;
  if(ps==='denied')return`<div class="warnbox">Notifications are blocked for this app. Turn them on in your phone or browser settings for this site, then reload.</div>`;
  if(ps==='unsupported')return`<div class="note">This browser can't receive push alerts. Use Chrome on Android, Safari on iPhone (installed to the home screen), or Chrome/Edge/Safari on a computer.</div>`;
  return`<div class="install"><b>Get a buzz on your phone for every new order</b><span class="note">Works even when the app is closed. No text messages involved.</span><div class="row"><button class="btn" id="onpush">Turn on phone alerts</button>${!standalone&&!isIOS?'<span class="note">Tip: install this dashboard (browser menu → Install app / Add to Home screen) so it opens like an app.</span>':''}</div></div>`;
}

/* ---------- orders ---------- */
function itemRow(i){
  const P=A.products.find(x=>x.id===i.id),nm=P?P.name:String(i.name||'').split(' — ')[0],opt=i.opt||(P?'':(String(i.name||'').split(' — ')[1]||''));
  return`<div class="oi"><div class="oi-th">${P?art(P):art({id:String(i.id||i.name),name:i.name,cat:'flower'})}</div><div class="oi-t"><b><span class="num">${i.qty}×</span> ${esc(nm)}</b>${opt?`<small>${esc(opt)}</small>`:''}</div><span class="oi-p num">${money(Number(i.price)*i.qty)}</span></div>`;
}
function aOrders(B){
  const act=o=>['new','confirmed','out'].includes(o.status);
  const match=(o,s)=>s==='active'?act(o):s==='today'?isToday(o.created_at):o.status===s;
  const fs=[['active','Active'],['new','New'],['confirmed','Confirmed'],['out','Out for delivery'],['delivered','Delivered'],['today','All today'],['cancelled','Cancelled']];
  let list=A.orders.filter(o=>match(o,ordFilter));if(ordFilter==='delivered'||ordFilter==='cancelled')list=list.slice(0,80);
  B.innerHTML=`<div style="display:grid;gap:12px"><div class="filters">${fs.map(([id,l])=>`<button class="${ordFilter===id?'on':''}" data-of="${id}">${l} <span class="num">${A.orders.filter(o=>match(o,id)).length}</span></button>`).join('')}</div>
  <div class="olist">${list.map(o=>{const c=A.customers.find(c=>c.id===o.customer_id);return`<article class="order s-${o.status} ${flashIds.has(o.id)?'flash':''}">
   <div><div class="row"><span class="id">${esc(o.code)}</span><span class="pill p-${o.status}">${SL[o.status]}</span></div><div class="meta">${new Date(o.created_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})} · ${ago(o.created_at)}</div>
    <div style="margin-top:6px;font-weight:600">${esc(o.cust_name)} ${o.tier?`<span class="pill p-muted">${esc(tierName(o.tier))}</span>`:''}${Number(o.free_win)?`<span class="pill p-new">420 WINNER −${money(o.free_win)}</span>`:''}${o.ref_code?`<span class="pill p-muted">Referred · ${esc(o.ref_code)}</span>`:''}${Number(o.credit_used)?`<span class="pill p-muted">Credit −${money(o.credit_used)}</span>`:''}</div><div class="meta"><a href="tel:${esc(o.cust_phone.replace(/\D/g,''))}">${esc(o.cust_phone)}</a></div>
    ${c&&!c.id_verified?'<div class="meta" style="color:var(--warn)">ID not yet verified</div>':''}</div>
   <div><div class="meta">${esc(o.address)}, ${esc(o.city)} · <a href="https://maps.google.com/?q=${encodeURIComponent(o.address+', '+o.city+', MI')}" target="_blank" rel="noopener">Map</a></div><div class="paytag pay-${payOf(o)==='Cash'?'cash':payOf(o).startsWith('Cash App')?'cashapp':'card'}">Pays: ${esc(payOf(o))}</div>${noteOf(o)?`<div class="meta" style="color:var(--yellow)">Note: ${esc(noteOf(o))}</div>`:''}
    <div class="oitems">${o.items.map(itemRow).join('')}</div></div>
   <div><div class="tot">${money(o.total)}</div><div class="meta" style="text-align:right">${Number(o.discount)?`member −${money(o.discount)} · `:''}${Number(o.fee)?`fee ${money(o.fee)}`:'no fee'}</div>
    ${o.status==='delivered'?`<div class="meta" style="text-align:right">Cash ${o.cash_in?'turned in':'with '+esc(drvName(o.driver_id)||'driver')}</div>`:''}</div>
   <div class="acts">${o.status==='cancelled'||o.status==='delivered'?`<span class="meta">${o.driver_id?'Driver: '+esc(drvName(o.driver_id)):''}</span>`:`
    <select data-drv="${o.id}" aria-label="Assign driver"><option value="">Assign driver</option>${A.drivers.filter(d=>d.active||d.id===o.driver_id).map(d=>`<option value="${d.id}" ${o.driver_id===d.id?'selected':''}>${esc(d.name)}</option>`).join('')}</select>
    ${o.status==='new'?`<button class="btn sm" data-st="${o.id}" data-to="confirmed">Confirm order</button>`:''}
    ${o.status==='confirmed'?`<button class="btn sm" data-st="${o.id}" data-to="out" ${o.driver_id?'':'disabled title="Assign a driver first"'}>Send out</button>`:''}
    ${o.status==='out'?`<button class="btn green sm" data-st="${o.id}" data-to="delivered">Delivered · paid</button>`:''}
    <button class="btn red sm" data-cancel="${o.id}">Cancel</button>`}</div>
  </article>`}).join('')||'<p class="note">No orders here right now. New orders appear at the top with a chime and a phone alert.</p>'}</div></div>`;
}
/* ---------- customers ---------- */
function aCustomers(B){
  const stats={};A.orders.forEach(o=>{if(o.status==='cancelled'||!o.customer_id)return;const s=stats[o.customer_id]||(stats[o.customer_id]={n:0,spent:0,last:null});s.n++;s.spent+=Number(o.total);if(!s.last||o.created_at>s.last)s.last=o.created_at});
  let list=A.customers.map(c=>({...c,...(stats[c.id]||{n:0,spent:0,last:null}),m:A.members.find(m=>m.phone===c.phone&&m.status==='active')}));
  if(custQ)list=list.filter(c=>[c.name,c.phone,c.city,c.address,c.ref_code||''].join(' ').toLowerCase().includes(custQ.toLowerCase()));
  const quietCut=Date.now()-21*864e5,isQuiet=c=>c.last&&new Date(c.last).getTime()<quietCut;
  const quietN=list.filter(isQuiet).length;
  if(custQuiet)list=list.filter(isQuiet).sort((a,b)=>new Date(a.last)-new Date(b.last));
  const refs={};A.customers.forEach(c=>{if(c.referred_by)refs[c.referred_by]=(refs[c.referred_by]||0)+1});
  B.innerHTML=`<div style="display:grid;gap:12px"><div class="row" style="justify-content:space-between"><input id="custq" placeholder="Search name, phone, city" value="${esc(custQ)}" style="max-width:320px"><div class="filters"><button class="${custQuiet?'':'on'}" data-quiet="0">All</button><button class="${custQuiet?'on':''}" data-quiet="1">Quiet 21+ days <span class="num">${quietN}</span></button></div><span class="note">${list.length} customers · order stats cover the last 90 days</span></div>
  ${custQuiet?`<div class="install"><b>Win them back</b><span class="note">Text each person yourself, one at a time, from your own phone. Tap a number to call, or copy this message:</span><div class="row"><span class="mono" style="font-size:13px" id="wbmsg">Hey, it's Cargo+420! Haven't seen you in a minute. Happy Hour is Mon–Thu 11am–3pm with a $25 minimum in Detroit. cargo420.onrender.com</span><button class="btn sm" id="copywb">Copy message</button></div></div>`:''}
  <div class="tblwrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Address</th><th class="r">Orders</th><th class="r">Spent</th><th>Last order</th><th>Membership</th><th>Referral code</th><th class="r">Credit</th><th class="r">Referred</th><th>ID verified</th><th>Notes</th></tr></thead><tbody>
  ${list.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td class="mono"><a href="tel:${esc(c.phone.replace(/\D/g,''))}">${esc(c.phone)}</a></td><td>${esc(c.address||'')}${c.city?', '+esc(c.city):''}</td><td class="r num">${c.n}</td><td class="r num">${money(c.spent)}</td><td>${c.last?ago(c.last):'—'}</td>
   <td>${c.m?`<span class="pill p-new">${esc(tierName(c.m.tier))}</span>`:'<span class="note">—</span>'}</td>
   <td class="mono">${esc(c.ref_code||'')}</td><td class="r num">${Number(c.credit)?money(c.credit):'—'}</td><td class="r num">${refs[c.id]||0}</td>
   <td><label class="toggle"><input type="checkbox" data-idv="${c.id}" ${c.id_verified?'checked':''}> ${c.id_verified?'Yes':'No'}</label></td>
   <td><input data-cnote="${c.id}" value="${esc(c.notes||'')}" placeholder="Add note" style="min-width:200px"></td></tr>`).join('')||'<tr><td colspan="9" class="note">Customers appear here after their first order.</td></tr>'}</tbody></table></div></div>`;
}
/* ---------- drivers & cash ---------- */
const payOf=o=>{const m=/PAY: ([^·]+)/.exec(o.notes||'');return m?m[1].trim():'Cash'};
const isCash=o=>payOf(o)==='Cash';
const noteOf=o=>(o.notes||'').replace(/PAY: [^·]+(· )?/,'').trim();
function aDrivers(B){
  const sum=a=>a.reduce((s,o)=>s+Number(o.collected??o.total),0);
  const cards=A.drivers.filter(d=>d.active).map(d=>{const mine=A.orders.filter(o=>o.driver_id===d.id);const out=mine.filter(o=>o.status==='out'),conf=mine.filter(o=>o.status==='confirmed'),held=mine.filter(o=>o.status==='delivered'&&!o.cash_in&&isCash(o)),inT=mine.filter(o=>o.cash_in&&o.cash_in_at&&isToday(o.cash_in_at));
   return`<div class="dcard"><div class="row" style="justify-content:space-between"><h3>${esc(d.name)}</h3><button class="linkbtn" data-drvoff="${d.id}">Remove</button></div>
    <label style="font-size:12px">Driver login email<input type="email" data-drvemail="${d.id}" value="${esc(d.email||'')}" placeholder="driver@email.com" style="padding:6px 9px;font-size:13px"></label>
    <div class="kv"><span>Queued (confirmed)</span><b>${conf.length}</b></div>
    <div class="kv"><span>On route now</span><b>${out.length} · ${money(sum(out))} to collect</b></div>
    <div class="kv" style="color:var(--yellow)"><span>Cash in hand</span><b>${money(sum(held))}</b></div>
    <div class="kv"><span>Turned in today</span><b>${money(sum(inT))}</b></div>
    ${held.length?`<div class="note">${held.map(o=>esc(o.code)+' '+money(o.collected??o.total)).join(' · ')}</div>`:''}
    <button class="btn sm" data-cashin="${d.id}" ${held.length?'':'disabled'}>Cash turned in · ${money(sum(held))}</button></div>`}).join('');
  const un=A.orders.filter(o=>!o.driver_id&&['new','confirmed'].includes(o.status)).length;
  B.innerHTML=`<div style="display:grid;gap:14px">${un?`<div class="warnbox">${un} active order${un>1?'s':''} still need a driver. Assign from the Orders tab.</div>`:''}<div class="drivers">${cards||'<p class="note">Add your drivers below so you can assign orders and track cash.</p>'}</div>
   <form class="row" id="drvf"><input id="drv-name" placeholder="New driver name" style="max-width:220px" required><input id="drv-email" type="email" placeholder="Login email (optional)" style="max-width:260px"><button class="btn ghost sm">Add driver</button></form>
   <p class="note" style="margin:0">Drivers sign in at this same dashboard address with the email you enter here. They only see the driver screen: active orders, taking an order, On my way and Delivered. No customers list, sales, inventory or settings.</p></div>`;
}
/* ---------- inventory ---------- */
let editing=null;
function aInventory(B){
  let list=A.products.filter(p=>p.cat!=='drop').sort((a,b)=>(b.active-a.active)||a.stock-b.stock||a.name.localeCompare(b.name));
  if(invQ)list=list.filter(p=>(p.name+' '+catName(p.cat)).toLowerCase().includes(invQ.toLowerCase()));
  B.innerHTML=`<div style="display:grid;gap:12px">
   <div class="row" style="justify-content:space-between"><input id="invq" placeholder="Search products" value="${esc(invQ)}" style="max-width:280px"><button class="btn sm" data-edit="new">Add product</button></div>
   <div id="pformwrap"></div>
   <p class="note" style="margin:0">Stock drops when an order is placed and comes back if you cancel it. At 0 the shop shows “Out of stock”.</p>
   <div class="tblwrap"><table><thead><tr><th></th><th>Product</th><th>Category</th><th class="r">Price</th><th class="r">Stock</th><th>Status</th><th>Hot</th><th>On menu</th><th></th></tr></thead><tbody>
  ${list.map(p=>`<tr style="${p.active?'':'opacity:.55'}"><td><div class="thumb">${art(p)}</div></td><td><b>${esc(p.name)}</b></td><td>${catName(p.cat)}</td><td class="r"><input class="n num" type="number" step="0.5" min="0" data-price="${p.id}" value="${Number(p.price)}"></td><td class="r">${p.options?`<button class="linkbtn" data-edit="${p.id}" title="Stock is set per option">${p.stock} · options</button>`:`<input class="n num" type="number" min="0" data-stock="${p.id}" value="${p.stock}">`}</td>
   <td>${p.stock<=0?'<span class="pill p-cancelled">Sold out</span>':p.stock<=3?'<span class="pill p-out">Low</span>':'<span class="pill p-delivered">In stock</span>'}</td>
   <td><input type="checkbox" data-feat="${p.id}" ${p.featured?'checked':''} aria-label="Hot"></td><td><input type="checkbox" data-active="${p.id}" ${p.active?'checked':''} aria-label="On menu"></td><td><button class="linkbtn" data-edit="${p.id}">Edit</button></td></tr>`).join('')}</tbody></table></div></div>`;
  if(editing)drawPForm();
}
function drawPForm(){
  const w=$('#pformwrap');if(!w)return;const p=editing==='new'?{name:'',cat:'flower',price:0,stock:0,tags:[],thc:'',size:'',strain:'',description:'',featured:false,active:true,image_url:null}:A.products.find(x=>x.id===editing);if(!p){editing=null;return}
  w.innerHTML=`<form class="pform" id="pform"><div class="row" style="justify-content:space-between"><h3 style="font-size:24px">${editing==='new'?'Add product':'Edit '+esc(p.name)}</h3><button type="button" class="x" data-edit="" aria-label="Close">×</button></div>
   <div class="two"><label>Name<input id="pf-name" required value="${esc(p.name)}"></label><label>Category<select id="pf-cat">${CATS.map(c=>`<option value="${c.id}" ${p.cat===c.id?'selected':''}>${c.name}</option>`).join('')}</select></label></div>
   <div class="three"><label>Price ($)<input id="pf-price" type="number" step="0.01" min="0" value="${Number(p.price)}"></label><label>Stock<input id="pf-stock" type="number" min="0" value="${p.stock}"></label><label>Size<input id="pf-size" value="${esc(p.size||'')}" placeholder="3.5g"></label></div>
   <div class="three"><label>THC / strength<input id="pf-thc" value="${esc(p.thc||'')}" placeholder="28% THC"></label><label>Strain type<input id="pf-strain" value="${esc(p.strain||'')}" placeholder="Hybrid"></label><label>Filters (comma separated)<input id="pf-tags" value="${esc(p.tags.join(', '))}" placeholder="Hybrid, 3.5 grams"></label></div>
   <label>Description<textarea id="pf-desc" rows="2">${esc(p.description||'')}</textarea></label>
   <div class="two"><label>Option name (leave blank if none)<input id="pf-optname" value="${esc(p.options?.name||'')}" placeholder="Strain, Size, Flavor"></label><div></div></div>
   <label>Options, one per line: name | price | stock<textarea id="pf-opts" rows="4" class="mono" style="font-size:13px" placeholder="3.5g | 25 | 20
28g | 90 | 5">${esc((p.options?.choices||[]).map(c=>`${c.label} | ${c.price} | ${c.stock}`).join('\n'))}</textarea></label>
   <p class="note" style="margin:0">With options, the customer must pick one. Price and stock above are then filled in from the options.</p>
   <div class="row"><div class="thumb" style="width:72px;height:72px">${art({...p,id:p.id||'new'})}</div><label style="flex:1">Photo (JPG, PNG or WebP, under 5 MB)<input id="pf-photo" type="file" accept="image/jpeg,image/png,image/webp"></label></div>
   <div class="row"><label class="toggle"><input type="checkbox" id="pf-feat" ${p.featured?'checked':''}> Hot / most liked</label><label class="toggle"><input type="checkbox" id="pf-active" ${p.active?'checked':''}> Show on menu</label></div>
   <div class="row"><button class="btn" id="pf-save">Save product</button>${editing!=='new'?`<button type="button" class="btn red sm" data-pdel="${p.id}">Delete product</button><span id="pdel-c" hidden><button type="button" class="btn red sm" data-pdelyes="${p.id}">Yes, delete it</button></span>`:''}</div></form>`;
}
async function saveProduct(){
  const btn=$('#pf-save');btn.disabled=true;btn.textContent='Saving…';
  const rec={name:$('#pf-name').value.trim(),cat:$('#pf-cat').value,price:Math.max(0,+$('#pf-price').value||0),stock:Math.max(0,parseInt($('#pf-stock').value)||0),size:$('#pf-size').value.trim()||null,thc:$('#pf-thc').value.trim()||null,strain:$('#pf-strain').value.trim()||null,
    tags:$('#pf-tags').value.split(',').map(s=>s.trim()).filter(Boolean),description:$('#pf-desc').value.trim()||null,featured:$('#pf-feat').checked,active:$('#pf-active').checked};
  const optLines=$('#pf-opts').value.split('\n').map(l=>l.trim()).filter(Boolean);
  if(optLines.length){
    const bad=[];const ch=optLines.map(l=>{const [label,price,stock]=l.split('|').map(x=>(x||'').trim());if(!label||isNaN(parseFloat(price)))bad.push(l);return{label,price:Math.max(0,parseFloat(price)||0),stock:Math.max(0,parseInt(stock)||0)}});
    if(bad.length){toast('Fix the option lines','Use: name | price | stock. Problem: '+bad[0]);btn.disabled=false;btn.textContent='Save product';return}
    rec.options={name:$('#pf-optname').value.trim()||'Option',choices:ch};rec.price=Math.min(...ch.map(c=>c.price));rec.stock=ch.reduce((s,c)=>s+c.stock,0);
  }else rec.options=null;
  if(!rec.name){toast('Add a product name','',true);btn.disabled=false;btn.textContent='Save product';return}
  const file=$('#pf-photo').files[0];
  try{
    if(file){if(file.size>5*1024*1024)throw new Error('That photo is over 5 MB. Pick a smaller one.');
      const path=`${Date.now()}-${file.name.replace(/[^\w.-]+/g,'_')}`;
      const up=await sb.storage.from('products').upload(path,file,{cacheControl:'31536000',contentType:file.type});if(up.error)throw up.error;
      rec.image_url=sb.storage.from('products').getPublicUrl(path).data.publicUrl;}
    if(editing==='new'){const {data,error}=await sb.from('products').insert(rec).select().single();if(error)throw error;A.products.push(data)}
    else{const d=await upd('products',editing,rec);if(!d)throw new Error('Not saved')}
    toast('Product saved','It shows on the store right away.',true);editing=null;render();
  }catch(e){toast('Product not saved',errMsg(e));btn.disabled=false;btn.textContent='Save product'}
}
/* ---------- cargo drops ---------- */
let dEditing=null;
const dNo=p=>'#'+String(p.drop_no||0).padStart(3,'0');
function dStatus(p){const now=Date.now(),t=p.drop_at?new Date(p.drop_at).getTime():0;if(!p.active)return['Hidden','p-muted'];if(p.stock<=0)return['Sold out','p-cancelled'];if(t&&now>=t)return['Live','p-delivered'];if(t&&p.early_tier&&p.early_minutes&&now>=t-p.early_minutes*60e3)return['Early access','p-out'];return['Scheduled','p-new']}
function dSellTime(p){if(!p.sold_out_at||!p.drop_at)return'—';const s=Math.max(0,Math.round((new Date(p.sold_out_at)-new Date(p.drop_at))/1e3));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return h?`${h}h ${m}m`:m?`${m}m ${x}s`:`${x}s`}
function dropOrders(id){return A.orders.filter(o=>o.status!=='cancelled'&&o.items.some(i=>i.id===id))}
function aDrops(B){
  const list=A.products.filter(p=>p.cat==='drop').sort((a,b)=>(b.drop_no||0)-(a.drop_no||0));
  B.innerHTML=`<div style="display:grid;gap:14px">
   <div class="row" style="justify-content:space-between"><p class="note" style="margin:0;max-width:640px">A Cargo Drop is a numbered mystery bag with a fixed number of units and a release time. It stays hidden from the shop, counts down on the Drop page and the home page, then sells until it hits zero. Limit per customer is checked by phone number.</p><button class="btn sm" data-dedit="new">New drop</button></div>
   <div id="dformwrap"></div>
   <div class="tblwrap"><table><thead><tr><th>Drop</th><th>Name</th><th>Release</th><th class="r">Price</th><th class="r">Sold</th><th>Sold out in</th><th>Status</th><th></th></tr></thead><tbody>
   ${list.map(p=>{const [l,c]=dStatus(p),q=p.drop_qty||0,sold=Math.max(0,q-p.stock);return`<tr><td class="mono"><b>${dNo(p)}</b></td><td><b>${esc(p.name)}</b></td><td>${p.drop_at?new Date(p.drop_at).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'—'}</td><td class="r num">${money(p.price)}</td><td class="r num">${sold} / ${q}</td><td class="num">${dSellTime(p)}</td><td><span class="pill ${c}">${l}</span></td><td><button class="linkbtn" data-dedit="${p.id}">Edit</button></td></tr>`}).join('')||'<tr><td colspan="8" class="note">No drops yet. Create Drop #001.</td></tr>'}
   </tbody></table></div></div>`;
  if(dEditing)drawDForm();
}
function localDT(iso){if(!iso)return'';const d=new Date(iso);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function drawDForm(){
  const w=$('#dformwrap');if(!w)return;
  const next=Math.max(0,...A.products.filter(p=>p.cat==='drop').map(p=>p.drop_no||0))+1;
  const p=dEditing==='new'?{name:'Mystery Bag',price:50,drop_value:80,drop_qty:25,stock:25,drop_no:next,drop_limit:1,early_tier:(A.tiers.find(t=>/black/i.test(t.name))||A.tiers[A.tiers.length-1]||{}).id||'',early_minutes:15,drop_at:null,description:'',active:true,image_url:null}:A.products.find(x=>x.id===dEditing);
  if(!p){dEditing=null;return}
  const sold=dEditing==='new'?0:Math.max(0,(p.drop_qty||0)-p.stock);
  w.innerHTML=`<form class="pform" id="dform"><div class="row" style="justify-content:space-between"><h3 style="font-size:24px">${dEditing==='new'?'New Cargo Drop':'Edit drop '+dNo(p)}</h3><button type="button" class="x" data-dedit="" aria-label="Close">×</button></div>
   <div class="three"><label>Drop number<input id="df-no" type="number" min="1" value="${p.drop_no||next}"></label><label>Name<input id="df-name" required value="${esc(p.name)}" placeholder="Mystery Bag"></label><label>Release (your local time)<input id="df-at" type="datetime-local" required value="${localDT(p.drop_at)}"></label></div>
   <div class="three"><label>Price ($)<input id="df-price" type="number" step="0.01" min="0" value="${Number(p.price)}"></label><label>Value shown ($)<input id="df-value" type="number" step="0.01" min="0" value="${Number(p.drop_value||0)}"></label><label>Total units<input id="df-qty" type="number" min="1" value="${p.drop_qty||p.stock}"></label></div>
   <div class="three"><label>Limit per customer<input id="df-limit" type="number" min="1" value="${p.drop_limit||1}"></label><label>Early access tier<select id="df-tier"><option value="">None</option>${A.tiers.map(t=>`<option value="${t.id}" ${p.early_tier===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><label>Early access (minutes before)<input id="df-early" type="number" min="0" value="${p.early_minutes||0}"></label></div>
   <label>Teaser / what's inside<textarea id="df-desc" rows="2" placeholder="An eighth of top shelf, 2 pre-rolls, a 100mg edible and one surprise. Value $80+.">${esc(p.description||'')}</textarea></label>
   <div class="row"><div class="thumb" style="width:72px;height:72px">${art({...p,id:p.id||'new',cat:'drop'})}</div><label style="flex:1">Photo (optional; a mystery-bag graphic shows if blank)<input id="df-photo" type="file" accept="image/jpeg,image/png,image/webp"></label></div>
   ${sold?`<p class="note" style="margin:0">${sold} already sold. Changing total units keeps the sold count and adjusts what's left.</p>`:''}
   <div class="row"><label class="toggle"><input type="checkbox" id="df-active" ${p.active?'checked':''}> Show on the site</label></div>
   <div class="row"><button class="btn" id="df-save">Save drop</button>${dEditing!=='new'?`<button type="button" class="btn ghost sm" data-dnow="${p.id}">Release now</button>${sold?'':`<button type="button" class="btn red sm" data-pdel="${p.id}">Delete drop</button><span id="pdel-c" hidden><button type="button" class="btn red sm" data-pdelyes="${p.id}">Yes, delete it</button></span>`}`:''}</div></form>`;
}
async function saveDrop(){
  const btn=$('#df-save');btn.disabled=true;btn.textContent='Saving…';
  const at=$('#df-at').value,qty=Math.max(1,parseInt($('#df-qty').value)||1);
  const old=dEditing==='new'?null:A.products.find(x=>x.id===dEditing);const sold=old?Math.max(0,(old.drop_qty||0)-old.stock):0;
  const rec={cat:'drop',name:$('#df-name').value.trim()||'Mystery Bag',drop_no:parseInt($('#df-no').value)||1,drop_at:at?new Date(at).toISOString():null,price:Math.max(0,+$('#df-price').value||0),drop_value:Math.max(0,+$('#df-value').value||0)||null,
    drop_qty:qty,stock:Math.max(0,qty-sold),drop_limit:Math.max(1,parseInt($('#df-limit').value)||1),early_tier:$('#df-tier').value||null,early_minutes:Math.max(0,parseInt($('#df-early').value)||0),description:$('#df-desc').value.trim()||null,active:$('#df-active').checked,tags:[],featured:false,options:null,size:'Mystery bag'};
  if(rec.stock>0)rec.sold_out_at=null;
  if(!rec.drop_at){toast('Pick a release time','',true);btn.disabled=false;btn.textContent='Save drop';return}
  const file=$('#df-photo').files[0];
  try{
    if(file){if(file.size>5*1024*1024)throw new Error('That photo is over 5 MB. Pick a smaller one.');
      const path=`drops/${Date.now()}-${file.name.replace(/[^\w.-]+/g,'_')}`;
      const up=await sb.storage.from('products').upload(path,file,{cacheControl:'31536000',contentType:file.type});if(up.error)throw up.error;
      rec.image_url=sb.storage.from('products').getPublicUrl(path).data.publicUrl;}
    if(dEditing==='new'){const {data,error}=await sb.from('products').insert(rec).select().single();if(error)throw error;A.products.push(data)}
    else{const d=await upd('products',dEditing,rec);if(!d)throw new Error('Not saved')}
    toast(`Drop ${dNo(rec)} saved`,'The countdown is live on the Drop page.',true);dEditing=null;render();
  }catch(e){toast('Drop not saved',errMsg(e));btn.disabled=false;btn.textContent='Save drop'}
}

/* ---------- members ---------- */
const plusDays=(d,n)=>{const x=d?new Date(d+'T12:00'):new Date();const base=x<new Date()?new Date():x;base.setDate(base.getDate()+n);return base.toISOString().slice(0,10)};
function aMembers(B){
  const pend=A.members.filter(m=>m.status==='pending'),act=A.members.filter(m=>m.status==='active');
  const price=id=>Number((A.tiers.find(t=>t.id===id)||{}).price||0);
  const late=m=>m.next_due&&new Date(m.next_due+'T23:59')<new Date();
  const dob=m=>m.birthdate?new Date(m.birthdate+'T12:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
  B.innerHTML=`<div style="display:grid;gap:16px">
   <div class="kpis"><div class="kpi"><div class="l">Active members</div><div class="v">${act.length}</div></div><div class="kpi"><div class="l">Monthly dues</div><div class="v">${money(act.reduce((s,m)=>s+price(m.tier),0))}</div></div><div class="kpi"><div class="l">Applications</div><div class="v">${pend.length}</div></div><div class="kpi cash"><div class="l">Dues overdue</div><div class="v">${act.filter(late).length}</div></div></div>
   <h2 style="font-size:26px">Applications</h2>
   ${pend.length?`<div class="tblwrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Birthdate</th><th>Tier</th><th>Applied</th><th></th></tr></thead><tbody>${pend.map(m=>`<tr><td><b>${esc(m.name)}</b></td><td class="mono"><a href="tel:${esc(m.phone.replace(/\D/g,''))}">${esc(m.phone)}</a></td><td>${dob(m)}</td><td>${esc(tierName(m.tier))}</td><td>${ago(m.applied_at)}</td><td class="row"><button class="btn green sm" data-mem="${m.id}" data-act="approve">Approve</button><button class="btn red sm" data-mem="${m.id}" data-act="decline">Decline</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="note">No applications waiting.</p>'}
   <h2 style="font-size:26px">Active members</h2>
   ${act.length?`<div class="tblwrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Birthdate</th><th>Tier</th><th class="r">Dues</th><th>Next due</th><th></th></tr></thead><tbody>${act.map(m=>`<tr><td><b>${esc(m.name)}</b></td><td class="mono">${esc(m.phone)}</td><td>${dob(m)}</td><td><span class="pill p-new">${esc(tierName(m.tier))}</span></td><td class="r num">${money(price(m.tier))}</td><td>${late(m)?'<span class="pill p-cancelled">Overdue</span> ':''}${m.next_due?new Date(m.next_due+'T12:00').toLocaleDateString():'—'}</td><td class="row"><button class="btn sm" data-mem="${m.id}" data-act="paid">Cash received · +30 days</button><button class="btn ghost sm" data-mem="${m.id}" data-act="end">End</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="note">No active members yet. Approve an application to start.</p>'}</div>`;
}
/* ---------- events ---------- */
function aEvents(B){
  B.innerHTML=`<div style="display:grid;gap:14px"><div class="tblwrap"><table><thead><tr><th>Date</th><th>Event</th><th>Where</th><th>Access</th><th class="r">RSVPs</th><th></th></tr></thead><tbody>
  ${A.events.map(e=>`<tr><td>${new Date(e.starts_on+'T12:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}${e.time_label?' · '+esc(e.time_label):''}</td><td><b>${esc(e.title)}</b></td><td>${esc(e.place||'')}</td><td>${e.members_only?'Members':'Open 21+'}</td><td class="r num">${e.rsvp_count}</td><td><button class="btn red sm" data-delev="${e.id}">Remove</button></td></tr>`).join('')||'<tr><td colspan="6" class="note">No events yet. Add one below and it shows on the Events page.</td></tr>'}</tbody></table></div>
  <form class="form" id="evf" style="max-width:none"><h2 style="font-size:26px">Add event</h2><div class="two"><label>Title<input id="ev-title" required></label><label>Date<input id="ev-date" type="date" required></label></div>
   <div class="two"><label>Time<input id="ev-time" placeholder="7–10 PM"></label><label>Location (shown publicly)<input id="ev-place" placeholder="Midtown Detroit · address sent to RSVPs"></label></div>
   <label>Description<input id="ev-desc"></label><label class="check"><input type="checkbox" id="ev-mem"> <span>Members only</span></label><button class="btn" style="justify-self:start">Publish event</button></form></div>`;
}
/* ---------- reports ---------- */
function aReports(B){
  const days=[];for(let d=6;d>=0;d--){const t=new Date();t.setDate(t.getDate()-d);const ds=t.toDateString();const os=A.orders.filter(o=>o.status==='delivered'&&new Date(o.delivered_at||o.created_at).toDateString()===ds);days.push({lbl:t.toLocaleDateString('en-US',{weekday:'short'}),v:os.reduce((s,o)=>s+Number(o.collected??o.total),0),n:os.length})}
  const hrs=[];for(let h=10;h<=23;h++){const os=A.orders.filter(o=>isToday(o.created_at)&&o.status!=='cancelled'&&new Date(o.created_at).getHours()===h);hrs.push({lbl:h>12?(h-12)+'p':h===12?'12p':h+'a',v:os.reduce((s,o)=>s+Number(o.total),0)})}
  const top={};A.orders.filter(o=>o.status==='delivered').forEach(o=>o.items.forEach(i=>{top[i.name]=(top[i.name]||0)+i.price*i.qty}));
  const topL=Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,8);
  B.innerHTML=`<div style="display:grid;gap:16px"><div class="kpis"><div class="kpi"><div class="l">7-day sales</div><div class="v">${money0(days.reduce((s,d)=>s+d.v,0))}</div></div><div class="kpi"><div class="l">7-day orders</div><div class="v">${days.reduce((s,d)=>s+d.n,0)}</div></div><div class="kpi"><div class="l">Best day</div><div class="v">${days.some(d=>d.v)?days.slice().sort((a,b)=>b.v-a.v)[0].lbl:'—'}</div></div><div class="kpi"><div class="l">Customers</div><div class="v">${A.customers.length}</div></div></div>
  <div class="cols"><div class="chart"><div class="eyebrow">Sales collected · last 7 days</div>${bars(days,'var(--yellow)')}</div><div class="chart"><div class="eyebrow">Today's orders by hour ($)</div>${bars(hrs,'var(--green)')}</div></div>
  <div class="cols"><div class="chart"><div class="eyebrow">Top products by revenue · 90 days</div><div style="display:grid;gap:6px;margin-top:10px">${topL.map(([n,v])=>`<div><div class="row" style="justify-content:space-between;font-size:13px"><span>${esc(n)}</span><span class="num">${money0(v)}</span></div><div style="height:6px;background:var(--panel2);border-radius:3px"><div style="height:6px;border-radius:3px;background:var(--yellow);width:${(v/topL[0][1]*100).toFixed(1)}%"></div></div></div>`).join('')||'<p class="note">Delivered orders will show here.</p>'}</div></div>
   <div class="chart" style="display:grid;gap:10px;align-content:start"><div class="eyebrow">Export</div><p class="note" style="margin:0">Download orders as a spreadsheet file (opens in Excel or Google Sheets).</p><div class="row"><button class="btn sm" data-csv="today">Today's orders</button><button class="btn ghost sm" data-csv="90">Last 90 days</button></div></div></div></div>`;
}
function bars(data,color,cur=true,W=520,H=200){
  const pl=48,pb=24,pt=12,max=Math.max(1,...data.map(d=>d.v));
  const step=max>4000?1000:max>2000?500:max>800?200:max>300?100:max>100?50:cur?25:max>40?10:max>20?5:max>8?2:1;const top=Math.ceil(max/step)*step;
  const bw=(W-pl-8)/data.length;let s='';
  for(let v=0;v<=top;v+=step){const y=pt+(H-pt-pb)*(1-v/top);s+=`<line x1="${pl}" x2="${W-4}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pl-6}" y="${y+4}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="JetBrains Mono,monospace">${cur?'$':''}${v.toLocaleString()}</text>`}
  data.forEach((d,i)=>{const h=(H-pt-pb)*d.v/top;const x=pl+i*bw+bw*.18;s+=`<rect x="${x}" y="${H-pb-h}" width="${bw*.64}" height="${Math.max(0,h)}" rx="2" fill="${color}" opacity="${i===data.length-1?1:.75}"><title>${d.tip||d.lbl}: ${cur?money(d.v):d.v.toLocaleString()}</title></rect><text x="${x+bw*.32}" y="${H-8}" text-anchor="middle" font-size="10" fill="var(--muted)">${d.lbl}</text>`});
  return`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart" style="width:100%;height:auto">${s}</svg>`;
}
function downloadCsv(which){
  const rows=[['order','placed','status','customer','phone','address','city','items','subtotal','discount','fee','total','collected','driver','cash_turned_in']];
  A.orders.filter(o=>which==='today'?isToday(o.created_at):true).forEach(o=>rows.push([o.code,new Date(o.created_at).toLocaleString(),o.status,o.cust_name,o.cust_phone,o.address,o.city,o.items.map(i=>i.qty+'x '+i.name).join('; '),o.subtotal,o.discount,o.fee,o.total,o.collected??'',drvName(o.driver_id),o.cash_in?'yes':'no']));
  const csv=rows.map(r=>r.map(v=>{v=String(v??'');return/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`cargo420-orders-${which}-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();
}
/* ---------- analytics: visits + site speed ---------- */
let aDays=30;const AN={};
const PAGE_LBL={home:'Home',shop:'Shop all',drop:'Drop page',specials:'Happy Hour',members:'Membership',events:'Events',areas:'Service area',checkout:'Checkout',done:'Order placed',liked:'Most liked',indica:'Indica',sativa:'Sativa',hybrid:'Hybrid'};
const pageLbl=p=>PAGE_LBL[p]||(typeof catName==='function'&&CATS.some(c=>c.id===p)?catName(p):p);
const SPEED={lcp:[2500,4000,'Main content shows'],fcp:[1800,3000,'First paint'],ttfb:[800,1800,'Server response'],load:[3000,6000,'Fully loaded'],inp:[200,500,'Tap response'],cls:[.1,.25,'Layout stability']};
const rate=(k,v)=>v==null?'na':v<=SPEED[k][0]?'good':v<=SPEED[k][1]?'ok':'poor';
const fmtMs=v=>v==null?'—':v<1000?Math.round(v)+' ms':(v/1000).toFixed(1)+' s';
async function loadAnalytics(force){
  if(AN[aDays]&&!force&&Date.now()-AN[aDays].t<60e3)return AN[aDays].d;
  const {data,error}=await sb.rpc('site_analytics',{p_days:aDays});if(error)throw error;AN[aDays]={t:Date.now(),d:data};return data;
}
function aAnalytics(B){
  B.innerHTML=`<div class="loading">Loading analytics…</div>`;
  loadAnalytics().then(d=>{if(tab==='analytics')drawAnalytics(B,d)}).catch(e=>{B.innerHTML=`<div class="warnbox">Couldn't load analytics. ${esc(errMsg(e))}</div>`});
}
function drawAnalytics(B,d){
  const pct=(a,b)=>b?Math.round((a-b)/b*100):null;const ch=pct(d.visitors,d.prev_visitors);
  const conv=d.visitors?(d.orders/d.visitors*100):0;
  const daily=[];for(let i=aDays-1;i>=0;i--){const t=new Date();t.setDate(t.getDate()-i);const k=t.toLocaleDateString('en-CA',{timeZone:'America/Detroit'});const r=d.daily.find(x=>x.d===k);const every=aDays<=7?1:aDays<=30?5:15;daily.push({lbl:(aDays-1-i)%every===0||i===0?t.toLocaleDateString('en-US',aDays<=7?{weekday:'short'}:{month:'numeric',day:'numeric'}):'',tip:t.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}),v:r?r.visitors:0})}
  const hrs=[];for(let h=8;h<=23;h++)hrs.push({lbl:h%2?'':(h>12?(h-12)+'p':h===12?'12p':h+'a'),tip:(h%12||12)+(h<12?'am':'pm'),v:Number((d.hours||{})[h]||0)});
  const list=(rows,lbl,val)=>{const mx=Math.max(1,...rows.map(val));return rows.length?rows.map(r=>`<div><div class="row" style="justify-content:space-between;font-size:13px"><span>${esc(lbl(r))}</span><span class="num">${val(r).toLocaleString()}</span></div><div class="an-bar"><i style="width:${Math.max(2,val(r)/mx*100)}%"></i></div></div>`).join(''):'<p class="note" style="margin:0">No data yet.</p>'};
  const split=o=>{const tot=Object.values(o).reduce((a,b)=>a+b,0)||1;return Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="an-chip"><b>${Math.round(v/tot*100)}%</b> ${esc(k[0].toUpperCase()+k.slice(1))}</span>`).join('')||'<span class="note">—</span>'};
  const P=d.perf||{};const n=P.samples||0;
  const card=k=>{const v=P[k==='load'?'load':k];const r=rate(k,v);return`<div class="sp-m sp-${r}"><div class="l">${SPEED[k][2]}</div><div class="v">${k==='cls'?(v==null?'—':Number(v).toFixed(2)):fmtMs(v)}</div><div class="s">${r==='good'?'Good':r==='ok'?'Needs work':r==='poor'?'Slow':'No data yet'}</div></div>`};
  const lr=rate('lcp',P.lcp);
  const verdict=!n?'Speed data starts collecting with the next visits. Check back after a few dozen customers have loaded the site.':lr==='good'?`Fast. 3 out of 4 visits show the main content in ${fmtMs(P.lcp)} or less (Google's target is under 2.5 s).`:lr==='ok'?`Okay, but some visitors wait. 3 out of 4 visits show the main content in ${fmtMs(P.lcp)}; Google's target is under 2.5 s.`:`Slow for many visitors. 3 out of 4 visits take up to ${fmtMs(P.lcp)} to show the main content; Google's target is under 2.5 s.`;
  const pd=d.perf_device||{};
  B.innerHTML=`<div class="an" style="display:grid;gap:16px">
   <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><div class="seg">${[7,30,90].map(x=>`<button class="${aDays===x?'on':''}" data-adays="${x}">${x} days</button>`).join('')}</div><span class="note" style="margin:0"><span class="an-live"></span>${d.live_now} on the site now · ${d.today_visitors} visitors today <button class="linkbtn" data-arefresh="1">Refresh</button></span></div>
   <h2 style="font-size:26px;margin:0">Website speed</h2>
   <div class="chart sp-verdict sp-${n?lr:'na'}"><b>${!n?'Collecting':lr==='good'?'Fast':lr==='ok'?'Okay':'Slow'}</b><span>${verdict}</span></div>
   <div class="sp-grid">${['lcp','fcp','ttfb','load','inp','cls'].map(card).join('')}</div>
   <p class="note" style="margin:0">Measured on real customer visits (${n} page loads in this period). Each number is what 3 out of 4 visitors got or better.${Object.keys(pd).length?' By device: '+Object.entries(pd).map(([k,v])=>`${esc(k)} ${fmtMs(v.lcp)} (${v.n} loads)`).join(' · ')+'.':''}</p>
   <h2 style="font-size:26px;margin-top:6px">Visits</h2>
   <div class="kpis">
    <div class="kpi"><div class="l">Visitors</div><div class="v">${d.visitors.toLocaleString()}</div><div class="an-sub">${ch==null?'first period tracked':`<b class="${ch>=0?'up':'down'}">${ch>=0?'▲':'▼'} ${Math.abs(ch)}%</b> vs previous ${aDays} days`}</div></div>
    <div class="kpi"><div class="l">Page views</div><div class="v">${d.views.toLocaleString()}</div><div class="an-sub">${d.sessions?(d.views/d.sessions).toFixed(1):'0'} pages per visit</div></div>
    <div class="kpi cash"><div class="l">Visit → order</div><div class="v">${conv.toFixed(1)}%</div><div class="an-sub">${d.orders} online orders · ${d.checkout_visitors} reached checkout</div></div>
    <div class="kpi"><div class="l">Bounce rate</div><div class="v">${d.bounce??0}%</div><div class="an-sub">left after one page</div></div>
   </div>
   <div class="chart"><div class="eyebrow">Visitors per day</div>${bars(daily,'var(--yellow)',false,innerWidth<700?520:1100,innerWidth<700?240:220)}</div>
   <div class="cols">
    <div class="chart"><div class="eyebrow">Top pages</div><div style="display:grid;gap:8px;margin-top:10px">${list(d.pages,r=>pageLbl(r.path),r=>r.views)}</div></div>
    <div class="chart"><div class="eyebrow">Where visitors come from</div><div style="display:grid;gap:8px;margin-top:10px">${list(d.referrers,r=>r.src,r=>r.visitors)}</div></div>
   </div>
   <div class="cols">
    <div class="chart"><div class="eyebrow">Busiest hours (page views)</div>${bars(hrs,'var(--green)',false)}</div>
    <div class="chart" style="display:grid;gap:12px;align-content:start"><div class="eyebrow">Devices</div><div class="an-chips">${split(d.devices||{})}</div><div class="eyebrow">Browsers</div><div class="an-chips">${split(d.browsers||{})}</div></div>
   </div>
  </div>`;
}

/* ---------- settings ---------- */
function aSettings(B){
  B.innerHTML=`<section class="team" id="teamwrap"><p class="note">Loading team…</p></section><form class="form" id="setf" style="max-width:820px"><h2 style="font-size:26px">Store</h2>
   <div class="two"><label>Delivery hours (shown on the site)<input id="s-hours" value="${esc(A.settings.hours)}"></label><label>Minimum order, every city ($)<input id="s-base" type="number" min="0" value="${Number(A.settings.base_min)}"></label></div>
   <label>Re-delivery fee wording<input id="s-redel" value="${esc(A.settings.redeliver)}"></label>
   <h2 style="font-size:26px;margin-top:10px">Delivery zones</h2><p class="note" style="margin:0">If an order is under the zone minimum, the fee is added. Cities are comma separated and show in the checkout city list.</p>
   ${A.zones.map(z=>`<div class="pform"><div class="two"><label>Zone minimum ($)<input type="number" min="0" data-zmin="${z.id}" value="${Number(z.min_order)}"></label><label>Fee if under minimum ($)<input type="number" min="0" data-zfee="${z.id}" value="${Number(z.fee)}"></label></div><label>Cities<textarea rows="2" data-zcities="${z.id}">${esc(z.cities.join(', '))}</textarea></label></div>`).join('')}
   <h2 style="font-size:26px;margin-top:10px">Referrals &amp; 420 free order</h2>
   <div class="pform"><div class="three"><label>New customer gets ($ off first order)<input id="s-refnew" type="number" min="0" value="${Number(A.promo?.ref_new??10)}"></label><label>Referrer earns ($ credit after delivery)<input id="s-refrew" type="number" min="0" value="${Number(A.promo?.ref_reward??10)}"></label><label>420 free order cap ($, 0 = off)<input id="s-wincap" type="number" min="0" value="${Number(A.promo?.win_cap??100)}"></label></div><p class="note" style="margin:0">Every order number ending in 420 (1420, 2420, …) is free up to the cap.</p></div>
   <h2 style="font-size:26px;margin-top:10px">ZIP codes</h2><p class="note" style="margin:0">Powers the “Do we deliver to you?” checker. One per line: ZIP, then the city exactly as it's written in a zone above.</p>
   <label class="sr" for="s-zips">ZIP codes</label><textarea id="s-zips" rows="8" class="mono" style="font-size:13px">${esc(A.zips.map(z=>z.zip+' '+z.city).join('\n'))}</textarea>
   <h2 style="font-size:26px;margin-top:10px">Membership tiers</h2>
   ${A.tiers.map(t=>`<div class="pform"><b>${esc(t.name)}</b><div class="two"><label>Monthly dues ($)<input type="number" min="0" data-tprice="${t.id}" value="${Number(t.price)}"></label><label>Discount (%)<input type="number" min="0" max="90" data-tpct="${t.id}" value="${t.pct_off}"></label></div><label class="toggle"><input type="checkbox" data-twaive="${t.id}" ${t.waive_fee?'checked':''}> Waive the under-minimum delivery fee</label><label>Perks (one per line)<textarea rows="3" data-tperks="${t.id}">${esc(t.perks.join('\n'))}</textarea></label></div>`).join('')}
   <button class="btn" style="justify-self:start">Save settings</button></form>`;
}
async function saveSettings(){
  try{
    let r=await sb.from('store_settings').update({hours:$('#s-hours').value.trim(),redeliver:$('#s-redel').value.trim(),base_min:Math.max(0,+$('#s-base').value||0),updated_at:new Date().toISOString()}).eq('id',1);if(r.error)throw r.error;
    for(const z of A.zones){r=await sb.from('zones').update({min_order:+$(`[data-zmin="${z.id}"]`).value||0,fee:+$(`[data-zfee="${z.id}"]`).value||0,cities:$(`[data-zcities="${z.id}"]`).value.split(',').map(s=>s.trim()).filter(Boolean)}).eq('id',z.id);if(r.error)throw r.error}
    const cities=new Set(A.zones.flatMap(z=>$(`[data-zcities="${z.id}"]`).value.split(',').map(s=>s.trim()).filter(Boolean)));
    const want=new Map();const badZ=[];
    $('#s-zips').value.split('\n').map(l=>l.trim()).filter(Boolean).forEach(l=>{const m=l.match(/^(\d{5})\s+(.+)$/);if(!m||!cities.has(m[2].trim()))badZ.push(l);else want.set(m[1],m[2].trim())});
    if(badZ.length)throw new Error('Fix these ZIP lines (use a 5-digit ZIP and a city from a zone): '+badZ.slice(0,3).join(' | '));
    const gone=A.zips.filter(z=>!want.has(z.zip)).map(z=>z.zip);
    if(gone.length){r=await sb.from('zip_codes').delete().in('zip',gone);if(r.error)throw r.error}
    const up=[...want].filter(([zip,city])=>!A.zips.some(z=>z.zip===zip&&z.city===city)).map(([zip,city])=>({zip,city}));
    if(up.length){r=await sb.from('zip_codes').upsert(up,{onConflict:'zip'});if(r.error)throw r.error}
    r=await sb.from('promo_settings').update({ref_new:Math.max(0,+$('#s-refnew').value||0),ref_reward:Math.max(0,+$('#s-refrew').value||0),win_cap:Math.max(0,+$('#s-wincap').value||0)}).eq('id',1);if(r.error)throw r.error;
    for(const t of A.tiers){r=await sb.from('tiers').update({price:+$(`[data-tprice="${t.id}"]`).value||0,pct_off:Math.min(90,Math.max(0,parseInt($(`[data-tpct="${t.id}"]`).value)||0)),waive_fee:$(`[data-twaive="${t.id}"]`).checked,perks:$(`[data-tperks="${t.id}"]`).value.split('\n').map(s=>s.trim()).filter(Boolean)}).eq('id',t.id);if(r.error)throw r.error}
    toast('Settings saved','The store uses them right away.',true);await reloadData();
  }catch(e){toast('Settings not saved',errMsg(e))}
}

/* ---------- interactions ---------- */
let pendingCancel=null;
document.addEventListener('click',async e=>{
  const t=e.target.closest('button,a');if(!t)return;
  if(t.dataset.auth){vAuth(t.dataset.auth);return}
  if(t.id==='signout'){await sb.auth.signOut();location.reload();return}
  if(t.dataset.tab){tab=t.dataset.tab;history.replaceState(null,'','#'+tab);render();return}
  if(t.dataset.of){ordFilter=t.dataset.of;render();return}
  if(t.dataset.quiet!==undefined){custQuiet=t.dataset.quiet==='1';render();return}
  if(t.id==='copywb'){navigator.clipboard?.writeText($('#wbmsg').textContent).then(()=>toast('Message copied','',true)).catch(()=>{});return}
  if(t.id==='onpush'){enablePush();return}
  if(t.id==='offpush'){disablePush();return}
  if(t.id==='testpush'){testPush();return}
  if(t.id==='openbtn'){const d=await sb.from('store_settings').update({open:!A.settings.open}).eq('id',1).select().single();if(d.error)return toast('Not saved',errMsg(d.error));A.settings=d.data;toast(A.settings.open?'Store is taking orders':'Store closed','',true);render();return}
  if(t.dataset.st){t.disabled=true;const o=await upd('orders',t.dataset.st,{status:t.dataset.to});if(o){toast(`${o.code} → ${SL[o.status]}`,'',true);if(o.status==='delivered'){const c=A.customers.find(c=>c.id===o.customer_id);if(c)c.id_verified=true}}render();return}
  if(t.dataset.cancel){if(pendingCancel!==t.dataset.cancel){pendingCancel=t.dataset.cancel;t.textContent='Tap again to cancel';setTimeout(()=>{if(pendingCancel===t.dataset.cancel){pendingCancel=null;t.textContent='Cancel'}},4000);return}
    pendingCancel=null;const o=await upd('orders',t.dataset.cancel,{status:'cancelled'});if(o)toast(`${o.code} cancelled`,'Items were put back in stock.',true);render();return}
  if(t.dataset.cashin){const ids=A.orders.filter(o=>o.driver_id===t.dataset.cashin&&o.status==='delivered'&&!o.cash_in&&isCash(o)).map(o=>o.id);
    const {data,error}=await sb.from('orders').update({cash_in:true}).in('id',ids).select();if(error)return toast('Not saved',errMsg(error));
    data.forEach(n=>{const i=A.orders.findIndex(x=>x.id===n.id);if(i>=0)A.orders[i]=n});toast('Cash turned in and logged','',true);render();return}
  if(t.dataset.drvoff){await upd('drivers',t.dataset.drvoff,{active:false});render();return}
  if(t.dataset.mem){const act=t.dataset.act,m=A.members.find(x=>x.id===t.dataset.mem);const patch=act==='approve'?{status:'active',next_due:plusDays(null,30)}:act==='decline'?{status:'declined'}:act==='paid'?{next_due:plusDays(m.next_due,30)}:{status:'ended'};
    const d=await upd('members',m.id,patch);if(d)toast(act==='approve'?`${d.name} approved`:act==='paid'?`Dues logged for ${d.name}`:'Membership updated',act==='approve'?'Collect the first month in cash on their next delivery.':'',true);render();return}
  if(t.dataset.delev){const {error}=await sb.from('events').delete().eq('id',t.dataset.delev);if(error)return toast('Not removed',errMsg(error));A.events=A.events.filter(x=>x.id!==t.dataset.delev);render();return}
  if(t.dataset.edit!==undefined){editing=t.dataset.edit||null;if(editing){aInventory($('#admbody'));$('#pformwrap').scrollIntoView({behavior:'smooth',block:'start'})}else{const w=$('#pformwrap');if(w)w.innerHTML=''}return}
  if(t.dataset.dedit!==undefined){dEditing=t.dataset.dedit||null;if(dEditing){aDrops($('#admbody'));$('#dformwrap').scrollIntoView({behavior:'smooth',block:'start'})}else{const w=$('#dformwrap');if(w)w.innerHTML=''}return}
  if(t.dataset.dnow){const d=await upd('products',t.dataset.dnow,{drop_at:new Date().toISOString(),active:true});if(d)toast(`Drop ${dNo(d)} is live`,'',true);dEditing=null;render();return}
  if(t.dataset.pdel){$('#pdel-c').hidden=false;return}
  if(t.dataset.pdelyes){const {error}=await sb.from('products').delete().eq('id',t.dataset.pdelyes);if(error)return toast('Not deleted',errMsg(error));A.products=A.products.filter(p=>p.id!==t.dataset.pdelyes);editing=null;dEditing=null;render();return}
  if(t.dataset.csv){downloadCsv(t.dataset.csv);return}
  if(t.dataset.adays){aDays=+t.dataset.adays;aAnalytics($('#admbody'));return}
  if(t.dataset.arefresh){delete AN[aDays];aAnalytics($('#admbody'));return}
});
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t.dataset.drv){await upd('orders',t.dataset.drv,{driver_id:t.value||null});render();return}
  if(t.dataset.drvemail){const em=t.value.trim().toLowerCase()||null;if(await upd('drivers',t.dataset.drvemail,{email:em}))toast(em?'Driver login saved':'Driver login removed',em?`${em} can now sign in as a driver.`:'',true);return}
  if(t.dataset.idv){await upd('customers',t.dataset.idv,{id_verified:t.checked});render();return}
  if(t.dataset.cnote){if(await upd('customers',t.dataset.cnote,{notes:t.value.trim()||null}))toast('Note saved','',true);return}
  if(t.dataset.price){await upd('products',t.dataset.price,{price:Math.max(0,+t.value||0)});return}
  if(t.dataset.stock){await upd('products',t.dataset.stock,{stock:Math.max(0,parseInt(t.value)||0)});render();return}
  if(t.dataset.feat){await upd('products',t.dataset.feat,{featured:t.checked});return}
  if(t.dataset.active){await upd('products',t.dataset.active,{active:t.checked});render();return}
});
let qT;
document.addEventListener('input',e=>{
  if(e.target.id==='custq'){clearTimeout(qT);qT=setTimeout(()=>{custQ=e.target.value;render()},250)}
  if(e.target.id==='invq'){clearTimeout(qT);qT=setTimeout(()=>{invQ=e.target.value;render()},250)}
});
document.addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target;
  if(f.id==='authf')return submitAuth(f);
  if(f.id==='drvf'){const n=$('#drv-name').value.trim();if(!n)return;const em=($('#drv-email')?.value||'').trim().toLowerCase()||null;const {data,error}=await sb.from('drivers').insert({name:n,email:em}).select().single();if(error)return toast('Not saved',errMsg(error));A.drivers.push(data);render();return}
  if(f.id==='evf'){const rec={title:$('#ev-title').value.trim(),starts_on:$('#ev-date').value,time_label:$('#ev-time').value.trim()||null,place:$('#ev-place').value.trim()||null,description:$('#ev-desc').value.trim()||null,members_only:$('#ev-mem').checked};
    if(!rec.title||!rec.starts_on)return toast('Add a title and date','',true);
    const {data,error}=await sb.from('events').insert(rec).select().single();if(error)return toast('Not saved',errMsg(error));A.events.push(data);A.events.sort((a,b)=>a.starts_on.localeCompare(b.starts_on));toast('Event published','It now shows on the Events page.',true);render();return}
  if(f.id==='pform')return saveProduct();
  if(f.id==='dform')return saveDrop();
  if(f.id==='setf')return saveSettings();
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&user)reloadData().catch(()=>{})});
setInterval(()=>{if(user&&tab==='orders'&&!document.activeElement?.matches('input,select,textarea'))render()},60000);

/* ---------- boot ---------- */
let booting=false;
async function boot(){if(booting)return;booting=true;try{await bootInner()}finally{booting=false}}
async function bootInner(){
  const h=location.hash.slice(1);if(['orders','customers','drivers','inventory','drops','members','events','reports','settings'].includes(h))tab=h;
  const {data:{session}}=await sb.auth.getSession();
  if(!session){user=null;return vAuth('in')}
  user=session.user;
  const {data:ok}=await sb.rpc('is_admin');
  if(!ok){const {data:me}=await sb.rpc('my_role');
    if(me&&me.role==='driver')return driverBoot({id:me.id,name:me.name});
    if(me&&ROLE_TABS[me.role]){ROLE=me.role;ROLE_NAME=me.name||'';if(!ROLE_TABS[ROLE].includes(tab))tab=ROLE_TABS[ROLE][0];$('#signout').hidden=false;try{await reloadData();subscribe()}catch(e){V().innerHTML=`<div class="wrap loading">Couldn't load the dashboard. ${esc(errMsg(e))}</div>`}return}
    if(me&&me.role==='pending'){$('#signout').hidden=false;V().innerHTML=`<div class="authbox"><img src="img/logo.webp" alt=""><h1 style="font-size:30px;text-align:center">${me.status==='declined'?'Request declined':'Waiting for approval'}</h1><p class="note" style="text-align:center">${esc(user.email)} asked for <b>${esc(ROLE_LABEL[me.requested]||me.requested)}</b> access. ${me.status==='declined'?'An owner declined this request. Talk to your manager.':'An owner needs to approve it under Settings → Team. Refresh this page once they do.'}</p><button class="btn ghost" onclick="location.reload()">Refresh</button></div>`;return}V().innerHTML=`<div class="authbox"><h1 style="font-size:30px">No owner access</h1><p class="note">${esc(user.email)} is signed in but isn't set up as an owner. Ask the owner to add this account.</p><button class="btn ghost" id="signout2">Sign out</button></div>`;$('#signout2').onclick=async()=>{await sb.auth.signOut();location.reload()};return}
  $('#signout').hidden=false;
  try{await reloadData();subscribe()}catch(e){V().innerHTML=`<div class="wrap loading">Couldn't load the dashboard. ${esc(errMsg(e))}</div>`}
}
sb.auth.onAuthStateChange((ev)=>{if(ev==='PASSWORD_RECOVERY'){user=null;vAuth('newpw')}else if(ev==='SIGNED_IN'&&!user)boot()});
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(h&&h!==tab&&user){tab=h;render()}});
boot();

/* ================= DRIVER MODE ================= */
let DRV=null,DO=[],dTab='available',dPoll=null,dKnown=null,dPend=null;
async function driverBoot(d){
  DRV=d;document.title='Cargo+420 Driver';$('#signout').hidden=false;
  const p=await sb.from('products').select('id,name,cat,image_url').eq('active',true);if(p.data)A.products=p.data;
  await drvLoad();clearInterval(dPoll);dPoll=setInterval(()=>{if(!document.hidden)drvLoad()},20000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&DRV)drvLoad()});
}
async function drvLoad(){
  const {data,error}=await sb.rpc('driver_orders');
  if(error){V().innerHTML=`<div class="wrap loading">${esc(errMsg(error))}</div>`;return}
  DO=data||[];
  const avail=DO.filter(o=>!o.driver_id&&['new','confirmed'].includes(o.status)).map(o=>o.id);
  if(dKnown&&avail.some(id=>!dKnown.has(id))){chime();toast('New order available','Tap Available to take it.')}
  dKnown=new Set(avail);drvRender();
}
function drvCard(o){
  const mine=o.mine,pay=payOf(o),note=noteOf(o).replace(/^Imported from Wix #\d+ ?·? ?/,'');
  const tel=String(o.cust_phone||'').replace(/\D/g,'');
  let acts='';
  if(o.status==='delivered')acts=`<span class="pill p-delivered">Delivered ${new Date(o.delivered_at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span>`;
  else if(!o.driver_id)acts=`<button class="btn dbtn" data-dact="take" data-o="${o.id}">Take this order</button>`;
  else if(!mine)acts=`<span class="pill p-muted">Taken by ${esc(o.driver_name||'another driver')}</span>`;
  else if(o.status==='out')acts=`<button class="btn green dbtn" data-dact="delivered" data-o="${o.id}">${dPend===o.id?'Tap again to confirm':'Delivered · '+esc(pay)+' collected'}</button><button class="linkbtn" data-dact="release" data-o="${o.id}">Release</button>`;
  else acts=`<button class="btn dbtn" data-dact="out" data-o="${o.id}">On my way</button><button class="linkbtn" data-dact="release" data-o="${o.id}">Release</button>`;
  return`<article class="dorder s-${o.status}">
   <div class="do-top"><span class="id">${esc(o.code)}</span><span class="pill p-${o.status}">${o.status==='new'?'Not confirmed yet':SL[o.status]}</span><span class="meta">${ago(o.created_at)}</span></div>
   <div class="do-cust"><b>${esc(o.cust_name)}</b>${tel?`<a class="btn ghost sm" href="tel:${tel}">Call</a><a class="btn ghost sm" href="sms:${tel}">Text</a>`:''}</div>
   <a class="do-addr" href="https://maps.google.com/?q=${encodeURIComponent(o.address+', '+o.city+', MI')}" target="_blank" rel="noopener">${esc(o.address)}, ${esc(o.city)} <u>Directions</u></a>
   ${note?`<div class="meta" style="color:var(--yellow)">Note: ${esc(note)}</div>`:''}
   <div class="oitems">${(o.items||[]).map(itemRow).join('')}</div>
   <div class="do-foot"><div><span class="paytag pay-${pay==='Cash'?'cash':pay.startsWith('Cash App')?'cashapp':'card'}">${esc(pay)}</span><div class="do-tot num">${money(o.total)}</div></div><div class="do-acts">${acts}</div></div>
  </article>`;
}
function drvRender(){
  const avail=DO.filter(o=>['new','confirmed'].includes(o.status)&&o.driver_id!==DRV.id);
  const mine=DO.filter(o=>o.mine&&['new','confirmed','out'].includes(o.status));
  const done=DO.filter(o=>o.mine&&o.status==='delivered');
  const cashDone=done.filter(o=>payOf(o)==='Cash').reduce((s,o)=>s+Number(o.collected??o.total),0);
  const list={available:avail,mine,done}[dTab];
  V().innerHTML=`<div class="wrap adm drv">
   <div class="admtop"><div><span class="eyebrow">Cargo+420 · Driver</span><h1 style="font-size:36px">Hi, ${esc(DRV.name)}</h1></div><button class="btn ghost sm" id="drefresh">Refresh</button></div>
   <div class="kpis"><div class="kpi"><div class="l">My active</div><div class="v">${mine.length}</div></div><div class="kpi"><div class="l">Delivered today</div><div class="v">${done.length}</div></div><div class="kpi cash"><div class="l">Cash to turn in</div><div class="v">${money(cashDone)}</div></div></div>
   <div class="tabs" role="tablist">${[['available','Available',avail.filter(o=>!o.driver_id).length],['mine','My orders',mine.length],['done','Done today',0]].map(([id,l,b])=>`<button role="tab" class="${dTab===id?'on':''}" data-dtab="${id}">${l}${b?`<span class="b">${b}</span>`:''}</button>`).join('')}</div>
   <div class="olist">${list.map(drvCard).join('')||`<p class="note">${dTab==='available'?'No open orders right now. New ones show up here automatically.':dTab==='mine'?'You have no active orders. Take one from Available.':'Nothing delivered yet today.'}</p>`}</div>
   <p class="note">Orders refresh every 20 seconds. Keep this page open to hear a chime when a new order comes in.</p></div>`;
}
document.addEventListener('click',async e=>{
  if(!DRV)return;const t=e.target.closest('button');if(!t)return;
  if(t.dataset.dtab){dTab=t.dataset.dtab;drvRender();return}
  if(t.id==='drefresh'){drvLoad();return}
  if(t.dataset.dact){
    const a=t.dataset.dact,id=t.dataset.o;
    if(a==='delivered'&&dPend!==id){dPend=id;drvRender();setTimeout(()=>{if(dPend===id){dPend=null;drvRender()}},4000);return}
    dPend=null;t.disabled=true;
    const {error}=await sb.rpc('driver_action',{p_order:id,p_action:a});
    if(error)toast('Not updated',errMsg(error));
    else{toast({take:'Order is yours',out:'Marked on the way',delivered:'Delivered. Nice work.',release:'Order released'}[a],'',true);if(a==='take')dTab='mine';if(a==='delivered')dTab='mine'}
    drvLoad();
  }
});

/* ================= TEAM (owner) ================= */
const roleSel=(cur,attr)=>`<select ${attr}>${['owner','driver','inventory','marketing'].map(r=>`<option value="${r}" ${r===cur?'selected':''}>${ROLE_LABEL[r]}</option>`).join('')}</select>`;
async function loadTeam(){
  const w=$('#teamwrap');if(!w)return;
  const {data:T,error}=await sb.rpc('team_list');if(!$('#teamwrap'))return;
  if(error){w.innerHTML=`<p class="warnbox">${esc(errMsg(error))}</p>`;return}
  const people=[...T.owners.map(o=>({email:o.email,role:'owner',me:o.me})),...T.drivers.map(d=>({email:d.email,name:d.name,role:'driver'})),...T.staff.map(x=>({email:x.email,name:x.name,role:x.role}))];
  w.innerHTML=`<h2 style="font-size:26px">Team</h2>
   <p class="note" style="margin:0">Owner: everything. Driver: driver screen only. Inventory: Inventory &amp; Drops. Marketing: Drops, Events, Customers (view) &amp; Reports.</p>
   ${T.requests.length?`<h3 class="tm-h">Waiting for approval <span class="b">${T.requests.length}</span></h3><div class="tm-list">${T.requests.map(r=>`<div class="tm-row req"><div><b>${esc(r.name||r.email)}</b><small>${esc(r.email)} · asked for ${esc(ROLE_LABEL[r.role])}${r.confirmed?'':' · email not confirmed yet'}</small></div><div class="tm-acts">${roleSel(r.role,`data-treqrole="${r.id}"`)}<button class="btn green sm" data-tapprove="${esc(r.email)}" data-rid="${r.id}" data-name="${esc(r.name||'')}">Approve</button><button class="btn red sm" data-tdecline="${r.id}">Decline</button></div></div>`).join('')}</div>`:''}
   <h3 class="tm-h">People with access</h3>
   <div class="tm-list">${people.map(x=>`<div class="tm-row"><div><b>${esc(x.name||x.email)}</b><small>${esc(x.email)}${x.me?' · you':''}</small></div><div class="tm-acts">${x.me?`<span class="pill p-new">Owner</span>`:`${roleSel(x.role,`data-tsetrole="${esc(x.email)}"`)}<button class="linkbtn" data-tremove="${esc(x.email)}">${pendRemove===x.email?'Tap again to remove':'Remove'}</button>`}</div></div>`).join('')}</div>
   <form class="tm-add" id="teamf"><input id="tm-email" type="email" placeholder="Email" required><input id="tm-name" placeholder="Name"><select id="tm-role"><option value="driver">Driver</option><option value="inventory">Inventory</option><option value="marketing">Marketing</option><option value="owner">Owner</option></select><button class="btn sm">Add person</button></form>
   <p class="note" style="margin:0">Adding someone by email gives them access as soon as they create an account with that email and confirm it.</p>`;
}
let pendRemove=null;
async function teamSet(email,role,name){const {error}=await sb.rpc('team_set',{p_email:email,p_role:role,p_name:name||null});if(error){toast('Not saved',errMsg(error));return false}return true}
document.addEventListener('click',async e=>{
  if(ROLE!=='owner'||DRV)return;const t=e.target.closest('button');if(!t)return;
  if(t.dataset.tapprove){const role=document.querySelector(`[data-treqrole="${t.dataset.rid}"]`).value;t.disabled=true;if(await teamSet(t.dataset.tapprove,role,t.dataset.name))toast('Approved',`${t.dataset.tapprove} now has ${ROLE_LABEL[role]} access.`,true);if(role==='driver')await reloadData();loadTeam();return}
  if(t.dataset.tdecline){t.disabled=true;const {error}=await sb.rpc('team_decline',{p_id:t.dataset.tdecline});if(error)toast('Not saved',errMsg(error));else toast('Request declined','',true);loadTeam();return}
  if(t.dataset.tremove){const em=t.dataset.tremove;if(pendRemove!==em){pendRemove=em;loadTeam();setTimeout(()=>{if(pendRemove===em){pendRemove=null;loadTeam()}},4000);return}pendRemove=null;if(await teamSet(em,'none'))toast('Access removed',em,true);loadTeam();return}
});
document.addEventListener('change',async e=>{
  if(ROLE!=='owner'||DRV)return;const t=e.target;
  if(t.dataset.tsetrole){if(await teamSet(t.dataset.tsetrole,t.value))toast('Role updated',`${t.dataset.tsetrole} → ${ROLE_LABEL[t.value]}`,true);if(t.value==='driver')await reloadData();loadTeam()}
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='teamf')return;e.preventDefault();e.stopImmediatePropagation();
  const em=$('#tm-email').value.trim(),role=$('#tm-role').value,nm=$('#tm-name').value.trim();if(!em)return;
  if(await teamSet(em,role,nm)){toast('Person added',`${em} · ${ROLE_LABEL[role]}`,true);if(role==='driver')await reloadData();loadTeam()}
},true);

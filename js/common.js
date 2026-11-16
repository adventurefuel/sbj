/* Cargo+420 shared helpers */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'$'+(Math.round(n*100)/100).toFixed(2);
const money0=n=>'$'+Math.round(n).toLocaleString();
function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
const CFG=window.C420_CONFIG||{};
const sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
const CATS=[
 {id:'flower',name:'Flower',blurb:'Indica · Sativa · Hybrid'},
 {id:'edibles',name:'Edibles',blurb:'Treats · Gummies · Suckers'},
 {id:'cbd',name:'CBD',blurb:'Tinctures · Balms · Gummies'},
 {id:'concentrates',name:'Concentrates',blurb:'Hash · Kief · Badder'},
 {id:'mushrooms',name:'Mushrooms',blurb:'Functional blends'},
 {id:'vapes',name:'Vapes',blurb:'Disposables · Carts'},
 {id:'enhance',name:'Sexual Enhancements',blurb:'Oils · Gummies'},
 {id:'smoke',name:'Smokers Supplies',blurb:'Wraps · Papers · Glass'},
 {id:'kratom',name:'Kratom',blurb:'Powders'},
];
const ICONS={
 flower:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M24 42V24M24 24c0-9 0-14 0-20 4 6 5 13 0 20zM24 24c-5-6-11-9-18-9 3 7 10 10 18 9zM24 24c5-6 11-9 18-9-3 7-10 10-18 9zM24 26c-4 2-9 3-14 2 3 4 9 5 14-2zM24 26c4 2 9 3 14 2-3 4-9 5-14-2z"/></svg>',
 edibles:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><rect x="7" y="16" width="34" height="22" rx="4"/><path d="M7 24h34M18 16v22M30 16v22"/><path d="M15 10c2-3 6-3 8 0M27 10c2-3 6-3 8 0"/></svg>',
 cbd:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><rect x="15" y="18" width="18" height="24" rx="3"/><path d="M19 18v-5h10v5M22 13V6h4v7"/><path d="M20 30h8"/></svg>',
 concentrates:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><ellipse cx="24" cy="34" rx="16" ry="6"/><path d="M8 34V26c0-3 7-6 16-6s16 3 16 6v8"/><path d="M18 16c0-4 6-6 6-10 0 4 6 6 6 10a6 6 0 0 1-12 0z"/></svg>',
 mushrooms:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M6 24C6 14 14 7 24 7s18 7 18 17z"/><path d="M18 24v12a6 6 0 0 0 12 0V24"/><circle cx="16" cy="16" r="2"/><circle cx="29" cy="13" r="2"/></svg>',
 vapes:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><rect x="19" y="14" width="10" height="30" rx="3"/><path d="M21 14V6h6v8M19 26h10"/></svg>',
 enhance:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M24 40S7 30 7 18a8 8 0 0 1 17-4 8 8 0 0 1 17 4c0 12-17 22-17 22z"/></svg>',
 smoke:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M6 32l30-14 4 8-30 14z"/><path d="M40 18c2-4 0-8-3-10M44 16c2-5-1-10-4-12"/></svg>',
 back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H4M10 6l-6 6 6 6"/></svg>',
 pin:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
 search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
 plane:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2.5 11.2 21 3l-8.2 18.5-2.4-7.9z"/></svg>',
 route:'<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><rect x="16" y="6" width="32" height="52" rx="5"/><path d="M26 50h12"/><path d="M24 20c6 0 4 8 10 8s6-8 10-8" stroke-dasharray="3 4"/><path d="M44 12a5 5 0 0 0-5 5c0 4 5 9 5 9s5-5 5-9a5 5 0 0 0-5-5z" fill="#41d63a" stroke="#000"/><rect x="22" y="34" width="20" height="9" rx="2" fill="#f7c31b" stroke="#000"/></svg>',
 all:'<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6"><rect x="7" y="7" width="14" height="14"/><rect x="27" y="7" width="14" height="14"/><rect x="7" y="27" width="14" height="14"/><rect x="27" y="27" width="14" height="14"/></svg>'
};
const catName=id=>(CATS.find(c=>c.id===id)||{name:id}).name;
/* fallback product art when no photo has been uploaded */
function art(p){
  if(p.image_url)return `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`;
  if(p.cat==='drop')return `<svg viewBox="0 0 200 200" aria-hidden="true"><rect width="200" height="200" fill="#111"/><path d="M52 72h96l10 104H42z" fill="#f7c31b" stroke="#000" stroke-width="3"/><path d="M76 72c0-20 10-32 24-32s24 12 24 32" fill="none" stroke="#f7c31b" stroke-width="8"/><text x="100" y="146" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="58" fill="#000">?</text></svg>`;
  const r=rng(hash(p.id)); const h=Math.floor(r()*360);
  const c1=`hsl(${h} 60% 50%)`, c2=`hsl(${(h+40)%360} 70% 60%)`;
  if(p.cat==='flower'){
    let s='';const g=[95+r()*25|0,40+r()*15|0];
    for(let i=0;i<26;i++){const a=r()*Math.PI*2,d=r()*46,x=100+Math.cos(a)*d*1.05,y=104+Math.sin(a)*d*1.2,rr=14+r()*16;
      s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}" fill="hsl(${g[0]+r()*20|0} ${g[1]}% ${30+r()*20|0}%)"/>`}
    for(let i=0;i<30;i++){const x=55+r()*90,y=55+r()*100;s+=`<path d="M${x.toFixed(0)} ${y.toFixed(0)}q${(r()*10-5).toFixed(0)} -6 ${(r()*12-6).toFixed(0)} -10" stroke="hsl(${20+r()*20|0} 80% 50%)" stroke-width="2" fill="none"/>`}
    for(let i=0;i<40;i++){s+=`<circle cx="${(55+r()*90).toFixed(0)}" cy="${(55+r()*100).toFixed(0)}" r="1.4" fill="#f2f6ea"/>`}
    return `<svg viewBox="0 0 200 200" aria-hidden="true">${s}</svg>`;
  }
  if(p.cat==='edibles'){
    return `<svg viewBox="0 0 200 200" aria-hidden="true"><rect x="38" y="62" width="124" height="90" rx="14" fill="${c1}"/><rect x="38" y="62" width="124" height="30" rx="14" fill="${c2}"/><circle cx="70" cy="120" r="6" fill="#fff8"/><circle cx="100" cy="130" r="5" fill="#fff8"/><circle cx="130" cy="116" r="6" fill="#fff8"/><text x="100" y="84" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="18" fill="#111">${esc(p.thc||'THC')}</text></svg>`;
  }
  if(p.cat==='cbd'){
    return `<svg viewBox="0 0 200 200" aria-hidden="true"><rect x="70" y="72" width="60" height="96" rx="10" fill="hsl(${h} 35% 30%)"/><rect x="78" y="48" width="44" height="26" rx="4" fill="#222"/><rect x="92" y="22" width="16" height="28" rx="6" fill="#444"/><rect x="74" y="104" width="52" height="38" fill="#f6f2e4"/><text x="100" y="130" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="20" fill="#2a6a2a">CBD</text></svg>`;
  }
  if(p.cat==='concentrates'){
    return `<svg viewBox="0 0 200 200" aria-hidden="true"><ellipse cx="100" cy="140" rx="64" ry="18" fill="#ddd"/><path d="M48 132c0-26 24-46 52-46s52 20 52 46c0 8-24 14-52 14s-52-6-52-14z" fill="hsl(${36+h%20} 85% 52%)"/><path d="M70 112c10-14 30-20 46-14" stroke="#fff9" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;
  }
  if(p.cat==='mushrooms'){
    return `<svg viewBox="0 0 200 200" aria-hidden="true"><path d="M86 100h28v56a14 14 0 0 1-28 0z" fill="#efe6d2"/><path d="M36 104c0-38 28-64 64-64s64 26 64 64z" fill="hsl(${20+h%30} 55% 42%)"/><circle cx="74" cy="72" r="8" fill="#fff3"/><circle cx="118" cy="62" r="6" fill="#fff3"/><circle cx="136" cy="86" r="5" fill="#fff3"/></svg>`;
  }
  if(p.cat==='vapes'){
    return `<svg viewBox="0 0 200 200" aria-hidden="true"><g transform="rotate(-18 100 100)"><rect x="84" y="40" width="32" height="128" rx="10" fill="#111"/><rect x="90" y="22" width="20" height="22" rx="4" fill="${c1}"/><rect x="88" y="70" width="24" height="44" rx="3" fill="${c2}"/><circle cx="100" cy="150" r="4" fill="${c2}"/></g></svg>`;
  }
  if(p.cat==='enhance'){
    return `<svg viewBox="0 0 200 200" aria-hidden="true"><rect x="72" y="70" width="56" height="96" rx="12" fill="hsl(${330+h%30} 60% 38%)"/><rect x="86" y="46" width="28" height="26" rx="4" fill="#c9a24a"/><path d="M100 136s-18-10-18-22a9 9 0 0 1 18-4 9 9 0 0 1 18 4c0 12-18 22-18 22z" fill="#fff"/></svg>`;
  }
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><rect x="40" y="56" width="120" height="88" rx="6" fill="${c1}"/><rect x="40" y="56" width="120" height="24" fill="#111"/><text x="100" y="118" text-anchor="middle" font-family="Anton,Impact,sans-serif" font-size="22" fill="#fff">${esc(p.name.split(' ')[0].toUpperCase())}</text></svg>`;
}
function toast(msg,sub,plain){const el=document.createElement('div');el.className='toast'+(plain?' plain':'');el.innerHTML=esc(msg)+(sub?`<small>${esc(sub)}</small>`:'');$('#toasts').appendChild(el);setTimeout(()=>el.remove(),plain?2600:7000)}
const errMsg=e=>(e&&(e.message||e.error_description||e.msg))||'Something went wrong. Check your connection and try again.';

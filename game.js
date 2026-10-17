'use strict';
const SPECIES=[
[1,'妙蛙种子','草',1],[4,'小火龙','火',1],[7,'杰尼龟','水',1],[10,'绿毛虫','虫',1],[16,'波波','飞行',1],[25,'皮卡丘','电',2],[35,'皮皮','妖精',2],[37,'六尾','火',2],[39,'胖丁','妖精',1],[43,'走路草','草',1],[54,'可达鸭','水',1],[58,'卡蒂狗','火',2],[63,'凯西','超能力',2],[79,'呆呆兽','水',1],[92,'鬼斯','幽灵',2],[95,'大岩蛇','岩石',2],[129,'鲤鱼王','水',1],[131,'拉普拉斯','水',3],[132,'百变怪','一般',3],[133,'伊布','一般',2],[143,'卡比兽','一般',3],[147,'迷你龙','龙',3],[151,'梦幻','超能力',4],[175,'波克比','妖精',2],[179,'咩利羊','电',1],[196,'太阳伊布','超能力',3],[197,'月亮伊布','恶',3],[252,'木守宫','草',2],[255,'火稚鸡','火',2],[258,'水跃鱼','水',2]
].map(([id,name,type,rarity])=>({id,name,type,rarity}));
const SAVE_KEY = 'pocket-field-v1'; // Preserve saves from the earlier releases.
const $ = selector => document.querySelector(selector);
const today = () => new Date().toLocaleDateString('sv-SE');
const fresh = () => ({version:1, energy:20, coins:100, date:today(), caught:{}, recent:[], shots:0, speed:1});
function validSave(s) {
  return s && s.version === 1 && Number.isSafeInteger(s.coins) && s.coins >= 0 &&
    Number.isSafeInteger(s.shots) && s.shots >= 0 && s.caught && typeof s.caught === 'object' && !Array.isArray(s.caught) &&
    Object.entries(s.caught).every(([id,v]) => SPECIES.some(p=>String(p.id)===id) && v && Number.isSafeInteger(v.count) && v.count>0 && Number.isSafeInteger(v.shiny) && v.shiny>=0 && v.shiny<=v.count) &&
    Array.isArray(s.recent) && s.recent.length<=12 && s.recent.every(r=>r && SPECIES.some(p=>p.id===r.id) && typeof r.shiny==='boolean') &&
    (s.speed === undefined || (Number.isFinite(s.speed) && s.speed>=.5 && s.speed<=5));
}
let state = fresh(), storageOK = true;
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) { const parsed = JSON.parse(raw); if (validSave(parsed)) state = parsed; else storageOK = false; }
} catch { storageOK = false; }
let dirty = false, saveClock = 0, toastTimer;
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); dirty = false; }
  catch { storageOK = false; toast('无法保存进度，请使用导出存档备份'); }
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>$('#toast').classList.remove('show'), 2600);
}
function sprite(p, shiny=false) { return `assets/sprites/${p.id}${shiny?'-shiny':''}.png`; }
function pokeImage(p, shiny=false) {
  const img = new Image(); img.src = sprite(p,shiny); img.alt = p.name; img.loading = 'lazy';
  img.onerror = () => { img.onerror=null; img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="23" fill="#e8e4c9" stroke="#98777b" stroke-width="3"/><path d="M17 40h46" stroke="#98777b" stroke-width="3"/><circle cx="40" cy="40" r="7" fill="#fdf7dc" stroke="#98777b" stroke-width="3"/></svg>'); };
  return img;
}
let filter='all', activeTab='explore', autoEnabled=true, speed=state.speed||1;
let balls=[], nextBallIn=0, simTime=0, accumulator=0, lastTime=null, nextId=1;
let boardHits=0, signalHits=0, electricHits=0, captures=0;
const MAX_BALLS=48, SPAWN_INTERVAL=.65;
const rarityNames=['','常见伙伴','特别伙伴','稀有伙伴','传说伙伴'];
function renderStats() {
  $('#shotTotal').textContent=state.shots;
  $('#coins').textContent=state.coins;
  $('#progress').textContent=`${Object.keys(state.caught).length} / ${SPECIES.length}`;
  $('#caughtTotal').textContent=`${Object.values(state.caught).reduce((sum,v)=>sum+v.count,0)} 位伙伴`;
}
function renderRecent() {
  const root=$('#recent'); root.replaceChildren();
  if (!state.recent.length) { const p=document.createElement('p');p.className='empty';p.textContent='精灵球正在探索，第一位伙伴很快就到。';root.append(p); }
  state.recent.slice(0,4).forEach(r=>{
    const p=SPECIES.find(p=>p.id===r.id), card=document.createElement('div');card.className='recent-item';
    const name=document.createElement('strong');name.textContent=p.name+(r.shiny?' ✦':'');
    const type=document.createElement('small');type.textContent=r.shiny?'闪光伙伴':p.type+'系 · 自动收藏';
    card.append(pokeImage(p,r.shiny),name,type);root.append(card);
  });
}
function renderDex() {
  const root=$('#dex');root.replaceChildren();
  SPECIES.filter(p=>filter==='all'||(filter==='caught'?state.caught[p.id]:state.caught[p.id]?.shiny)).forEach(p=>{
    const c=state.caught[p.id], card=document.createElement('div');card.className='dex-card'+(c?'':' locked');
    const num=document.createElement('small');num.textContent='#'+String(p.id).padStart(3,'0');
    const name=document.createElement('strong');name.textContent=c?p.name:'未发现';
    const count=document.createElement('small');count.textContent=c?`${p.type} · ×${c.count}`:'等待一次相遇';
    card.append(num,pokeImage(p,!!c?.shiny),name,count);
    if(c?.shiny){const star=document.createElement('span');star.className='shiny-star';star.textContent='✦ '+c.shiny;card.append(star);}
    root.append(card);
  });
  if(!root.children.length){const p=document.createElement('p');p.className='empty';p.textContent='还没有这样的伙伴，继续探索吧。';root.append(p);}
}
function renderAuto() {
  $('#launch').setAttribute('aria-checked',String(autoEnabled));
  $('#autoLabel').textContent='自动投球：'+(autoEnabled?'开':'关');
  $('#autoAction').textContent=autoEnabled?'暂停 Ⅱ':'继续 ▷';
  $('#boardStatus').textContent=autoEnabled?'● 自动探索中':'Ⅱ 已暂停';
  $('#speed').value=speed;$('#speedValue').textContent=speed+'×';
}
function render() { renderStats(); renderRecent(); if(activeTab==='collection')renderDex();renderAuto(); }
let audioOn=false, audioCtx, lastSound=0;
function sound(freq=500) {
  if(!audioOn || performance.now()-lastSound<80)return;
  try {
    audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();lastSound=performance.now();
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.frequency.value=freq;
    g.gain.setValueAtTime(.025,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.1);o.start();o.stop(audioCtx.currentTime+.1);
  } catch {}
}
function showCatch(target,p,shiny,source) {
  target.replaceChildren();target.classList.toggle('shiny',shiny);
  const text=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('p');
  name.textContent=(shiny?'✦ 闪光！':'')+p.name+' ×1';
  detail.textContent=`${source} · ${rarityNames[p.rarity]} · 自动收入图鉴（共 ${state.caught[p.id].count} 只）`;
  text.append(name,detail);target.append(pokeImage(p,shiny),text);
}
function capture(boost=0,source='三地探索') {
  const roll=Math.random(), tier=roll<.015+boost*.002?4:roll<.12+boost*.012?3:roll<.44+boost*.015?2:1;
  const pool=SPECIES.filter(p=>p.rarity===tier),p=pool[Math.floor(Math.random()*pool.length)],shiny=Math.random()<(source==='精灵扭蛋'?.05:Math.min(.12,.05+boost*.005));
  const c=state.caught[p.id]??{count:0,shiny:0};c.count++;if(shiny)c.shiny++;state.caught[p.id]=c;
  state.recent.unshift({id:p.id,shiny});state.recent=state.recent.slice(0,12);dirty=true;
  showCatch($('#latestCatch'),p,shiny,source);
  if(source==='精灵扭蛋')showCatch($('#gachaResult'),p,shiny,source);
  renderStats();if(activeTab==='collection')renderDex();if(activeTab==='explore')renderRecent();
  if(shiny)toast('✦ 闪光 '+p.name+' 已自动加入图鉴');
  sound(shiny?1000:720);return {id:p.id,shiny};
}
$('#launch').onclick=()=>{autoEnabled=!autoEnabled;lastTime=null;accumulator=0;renderAuto();};
$('#speed').oninput=()=>{speed=Number($('#speed').value);state.speed=speed;renderAuto();save();};
$('#burst').onclick=()=>{
  if(!autoEnabled)return toast('已暂停，打开自动投球后再加投');
  for(let i=0;i<5;i++)launchBall();renderStats();
};
$('#gacha').onclick=()=>{
  if(state.coins<50)return toast('需要 50 金币，自动探索可获得金币');
  state.coins-=50;capture(3,'精灵扭蛋');save(); // No modal, confirmation, or change to autoEnabled.
};
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  activeTab=b.dataset.tab;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));
  document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==activeTab);
  if(activeTab==='explore'){renderRecent();resize();}if(activeTab==='collection')renderDex();
});
document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{
  filter=b.dataset.filter;document.querySelectorAll('.filter').forEach(t=>t.classList.toggle('active',t===b));renderDex();
});
$('#export').onclick=()=>{
  save();const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`pocket-field-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('#import').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  if(autoEnabled)return toast('请先暂停自动投球，再导入存档');
  if(file.size>100000)return toast('存档文件过大');
  try {
    const parsed=JSON.parse(await file.text());if(!validSave(parsed))throw Error();
    if(!confirm('导入会替换当前进度。建议先导出备份，确定继续吗？'))return;
    state=parsed;balls=[];nextBallIn=0;speed=state.speed||1;save();render();toast('存档已导入，打开开关即可继续');
  } catch { toast('无法读取存档，请选择本游戏导出的 JSON 文件'); }
};
// 120 Hz fixed steps, small balls, dense staggered pins, low restitution and gravity.
// The video is only a visual reference; its exact physics constants are unavailable.
const canvas=$('#board'),ctx=canvas.getContext('2d'),W=400,H=520;
const BALL_RADIUS=3.4,GRAVITY=210,MAX_FALL=185;
const pegs=[];
for(let row=0;row<12;row++)for(let col=0;col<12;col++){
  const x=15+col*33+(row%2?16.5:0),y=63+row*31;
  if(x>389 || Math.hypot(x-200,y-315)<53 || Math.hypot(x-111,y-116)<30 || Math.hypot(x-289,y-116)<30)continue;
  pegs.push({x,y,r:2.8,lit:0});
}
const bumpers=[{x:111,y:116,r:18,kind:'energy',lit:0},{x:289,y:116,r:18,kind:'signal',lit:0}];
const rails=[{x1:173,y1:448,x2:191,y2:483},{x1:227,y1:448,x2:209,y2:483}];
const wheel={x:200,y:315,r:34,rotation:0};
const effects=[];
const mapImage=new Image();mapImage.src='assets/town.svg';
const guardianImages=[150,248].map(id=>{const img=new Image();img.src=`assets/sprites/${id}.png`;return img;});
let backgroundCanvas;
function resize() {
  const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);draw();
}
window.addEventListener('resize',resize);
mapImage.onload=()=>{backgroundCanvas=document.createElement('canvas');backgroundCanvas.width=W;backgroundCanvas.height=H;const c=backgroundCanvas.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(mapImage,0,0,W,H);draw();};
function circle(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function label(text,x,y,width=90,color='#f4f3db'){
  ctx.fillStyle=color;ctx.fillRect(x-width/2,y-9,width,14);ctx.strokeStyle='#b7bf9f';ctx.lineWidth=.7;ctx.strokeRect(x-width/2,y-9,width,14);
  ctx.fillStyle='#5e674b';ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.fillText(text,x,y+1);
}
function drawBall(b){
  ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.spin);
  circle(0,1,BALL_RADIUS+.6,'#5e70604d');circle(0,0,BALL_RADIUS+.4,'#526451');
  ctx.beginPath();ctx.arc(0,0,BALL_RADIUS,Math.PI,Math.PI*2);ctx.fillStyle='#bf3e51';ctx.fill();
  ctx.beginPath();ctx.arc(0,0,BALL_RADIUS,0,Math.PI);ctx.fillStyle='#fff9e2';ctx.fill();
  ctx.strokeStyle='#56604e';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-BALL_RADIUS,0);ctx.lineTo(BALL_RADIUS,0);ctx.stroke();circle(0,0,1.1,'#f7f5e6');ctx.restore();
}
function draw(){
  ctx.clearRect(0,0,W,H);if(backgroundCanvas)ctx.drawImage(backgroundCanvas,0,0);else{ctx.fillStyle='#c5d3b0';ctx.fillRect(0,0,W,H);}
  // Fog sits behind the pins, never over the moving balls.
  const fog=ctx.createLinearGradient(0,0,0,75);fog.addColorStop(0,'#eff1dfd9');fog.addColorStop(1,'#eff1df00');ctx.fillStyle=fog;ctx.fillRect(0,0,W,75);
  for(const p of pegs){circle(p.x+.6,p.y+1.3,p.r+.3,'#788866');circle(p.x,p.y,p.r,p.lit>0?'#f9d779':'#e8edce');circle(p.x-.6,p.y-.8,1.1,'#fafbec');}
  for(const b of bumpers){circle(b.x,b.y+1,b.r+4,'#97a583');circle(b.x,b.y,b.r+3,'#f9f4d8');circle(b.x,b.y,b.r,b.lit>0?'#ffeab0':b.kind==='energy'?'#e6cf66':'#d4dddd');
    if(b.kind==='energy'){ctx.fillStyle='#625831';ctx.beginPath();ctx.moveTo(b.x+2,b.y-12);ctx.lineTo(b.x-7,b.y+2);ctx.lineTo(b.x,b.y+1);ctx.lineTo(b.x-3,b.y+12);ctx.lineTo(b.x+8,b.y-3);ctx.lineTo(b.x+2,b.y-2);ctx.closePath();ctx.fill();}
    else{ctx.lineWidth=3;ctx.strokeStyle='#ae344f';ctx.beginPath();ctx.arc(b.x,b.y,12,Math.PI,Math.PI*2);ctx.stroke();ctx.strokeStyle='#697660';ctx.beginPath();ctx.arc(b.x,b.y,12,0,Math.PI);ctx.stroke();ctx.beginPath();ctx.moveTo(b.x-12,b.y);ctx.lineTo(b.x+12,b.y);ctx.stroke();circle(b.x,b.y,4,'#f6f2d7');circle(b.x,b.y,2,'#a34355');}
  }
  label(`碰撞蓄能 ${electricHits}/30`,111,150,98);label(`精灵信号 ${signalHits}/50`,289,150,98);
  // Four rotating red-and-white arcs with physical gaps.
  ctx.lineCap='round';for(let i=0;i<4;i++){const a=wheel.rotation+i*Math.PI/2;ctx.strokeStyle='#778872';ctx.lineWidth=6;ctx.beginPath();ctx.arc(wheel.x,wheel.y+1,wheel.r,a,a+1.03);ctx.stroke();ctx.strokeStyle=i%2?'#f3f0d9':'#b83b51';ctx.lineWidth=4;ctx.beginPath();ctx.arc(wheel.x,wheel.y,wheel.r,a,a+1.03);ctx.stroke();}
  circle(wheel.x,wheel.y,8,'#a99547');circle(wheel.x,wheel.y,5,'#e3c867');circle(wheel.x-1,wheel.y-1,2,'#faf0b3');label('✦ 穿过中心，提高闪光机遇',200,267,152);
  for(const r of rails){ctx.strokeStyle='#703c49';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(r.x1,r.y1);ctx.lineTo(r.x2,r.y2);ctx.stroke();ctx.strokeStyle='#c64f65';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(r.x1,r.y1);ctx.lineTo(r.x2,r.y2);ctx.stroke();}
  ctx.strokeStyle='#81394e';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(188,484);ctx.lineTo(212,484);ctx.stroke();label('落入口，捕捉精灵',200,435,109);
  ctx.strokeStyle='#a9b59b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,450);ctx.lineTo(400,450);ctx.stroke();
  label('草丛探索',87,438,88,'#dbd1e4');label('秘境探索',313,438,88,'#d3e3bf');
  guardianImages.forEach((img,i)=>{if(img.complete&&img.naturalWidth){ctx.imageSmoothingEnabled=false;ctx.drawImage(img,i?277:49,452,73,66);}});
  for(const b of balls)drawBall(b);
  for(const e of effects){ctx.globalAlpha=Math.min(1,e.life*2);ctx.textAlign='center';ctx.font='bold 9px sans-serif';ctx.fillStyle=e.color;ctx.fillText(e.text,e.x,e.y);ctx.globalAlpha=1;}
  if(!autoEnabled){ctx.fillStyle='#38432b26';ctx.fillRect(0,0,W,H);label('Ⅱ 已暂停 · 点击上方开关继续',200,210,183,'#fff7e6');}
}
function launchBall(){
  if(balls.length>=MAX_BALLS)return;
  const aim=Number($('#aim').value), x=Math.max(12,Math.min(388,28+Math.random()*344+aim*30));
  balls.push({id:nextId++,x,y:21+Math.random()*6,vx:aim*40+(Math.random()-.5)*30,vy:25+Math.random()*18,age:0,hits:0,coins:0,lucky:false,spin:Math.random()*6,lastPeg:null});
  state.shots++;dirty=true;
}
function impact(b,nx,ny,restitution=.64,boost=0){
  const dot=b.vx*nx+b.vy*ny;if(dot>=0)return false;
  b.vx-=(1+restitution)*dot*nx;b.vy-=(1+restitution)*dot*ny;
  b.vx+=nx*boost;b.vy+=ny*boost;b.spin+=nx*.4;b.hits++;boardHits++;return true;
}
function collidePeg(b,p){
  const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy),r=BALL_RADIUS+p.r;
  if(d>=r)return;
  const nx=d>.001?dx/d:(b.id%2?1:-1)*.2,ny=d>.001?dy/d:-1;
  b.x=p.x+nx*(r+.08);b.y=p.y+ny*(r+.08);
  if(impact(b,nx,ny,p.kind ? .76 : .62,p.r>10?13:0)){
    p.lit=.18;b.coins+=p.r>10?3:1;
    if(p.kind==='energy')electricHits++;if(p.kind==='signal')signalHits++;
    // A small asymmetric nudge prevents perfectly balanced balls on a pin.
    if(Math.abs(b.vx)<8)b.vx+=(b.id%2?1:-1)*13;
  }
}
function collideRail(b,r){
  const dx=r.x2-r.x1,dy=r.y2-r.y1,t=Math.max(0,Math.min(1,((b.x-r.x1)*dx+(b.y-r.y1)*dy)/(dx*dx+dy*dy)));
  const x=r.x1+t*dx,y=r.y1+t*dy,bx=b.x-x,by=b.y-y,d=Math.hypot(bx,by),radius=BALL_RADIUS+3;
  if(d<radius){const nx=d?bx/d:0,ny=d?by/d:-1;b.x=x+nx*(radius+.1);b.y=y+ny*(radius+.1);impact(b,nx,ny,.5);}
}
function finishBall(b){
  const funnel=Math.abs(b.x-200)<28,zone=funnel?'中央捕获口':b.x<200?'草丛探索':'秘境探索';
  state.coins+=b.coins+5+(funnel?8:0);captures++;dirty=true;
  capture(Math.min(5,b.hits/10)+(b.lucky?3:0)+(funnel?1:0),zone);
  if(effects.length<12)effects.push({x:Math.max(40,Math.min(360,b.x)),y:479,text:`+${b.coins+5+(funnel?8:0)} 金币`,life:1.2,color:'#745c2d'});
}
function step(dt){
  simTime+=dt;wheel.rotation=simTime*.85;
  for(const p of pegs)p.lit=Math.max(0,p.lit-dt);for(const b of bumpers)b.lit=Math.max(0,b.lit-dt);
  for(let i=effects.length-1;i>=0;i--){effects[i].life-=dt;effects[i].y-=12*dt;if(effects[i].life<=0)effects.splice(i,1);}
  for(let i=balls.length-1;i>=0;i--){
    const b=balls[i];b.age+=dt;b.vy=Math.min(MAX_FALL,b.vy+GRAVITY*dt);b.x+=b.vx*dt;b.y+=b.vy*dt;b.spin+=b.vx*dt*.04;
    if(b.x<5){b.x=5;b.vx=Math.abs(b.vx)*.72;}if(b.x>395){b.x=395;b.vx=-Math.abs(b.vx)*.72;}if(b.y<6){b.y=6;b.vy=Math.abs(b.vy);}
    for(const p of pegs)if(Math.abs(b.x-p.x)<8&&Math.abs(b.y-p.y)<8)collidePeg(b,p);
    for(const p of bumpers)collidePeg(b,p);
    const dx=b.x-wheel.x,dy=b.y-wheel.y,d=Math.hypot(dx,dy);
    if(d<17&&!b.lucky){b.lucky=true;effects.push({x:200,y:295,text:'✦ 幸运穿环',life:1,color:'#8b6432'});}
    const angle=((Math.atan2(dy,dx)-wheel.rotation)%(Math.PI/2)+Math.PI/2)%(Math.PI/2);
    if(Math.abs(d-wheel.r)<BALL_RADIUS+2&&angle<1.03&&d>.001){
      const side=d>=wheel.r?1:-1,nx=dx/d*side,ny=dy/d*side;
      b.x=wheel.x+dx/d*(wheel.r+side*(BALL_RADIUS+2.1));b.y=wheel.y+dy/d*(wheel.r+side*(BALL_RADIUS+2.1));
      if(impact(b,nx,ny,.72)){b.vx+=-dy/d*12;b.vy+=dx/d*12;}
    }
    for(const r of rails)collideRail(b,r);
    b.vx=Math.max(-160,Math.min(160,b.vx));
    // Resolve rare stuck balls after 24 simulated seconds to keep the board bounded.
    if(b.y>492||b.age>24){balls.splice(i,1);finishBall(b);}
  }
}
let statsClock=0;
function frame(t){
  if(lastTime===null)lastTime=t;
  const elapsed=Math.max(0,Math.min((t-lastTime)/1000,.05));lastTime=t;
  if(autoEnabled&&!document.hidden){
    nextBallIn-=elapsed*speed;
    while(nextBallIn<=0){launchBall();nextBallIn+=SPAWN_INTERVAL;}
    // Rate changes faster than gravity so higher rates produce a denser field.
    accumulator+=elapsed*Math.sqrt(speed);
    while(accumulator>=1/120){step(1/120);accumulator-=1/120;}
  }else accumulator=0;
  statsClock+=elapsed;saveClock+=elapsed;
  if(statsClock>.2){$('#ballCount').textContent=`场上 ${balls.length} 球 · 已捕获 ${captures}`;renderStats();statsClock=0;}
  if(saveClock>1){if(dirty)save();saveClock=0;}
  if(activeTab==='explore')draw();requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{lastTime=null;accumulator=0;if(document.hidden)save();});
window.addEventListener('pagehide',save);
render();resize();save();launchBall();nextBallIn=SPAWN_INTERVAL;requestAnimationFrame(frame);
if(!storageOK)toast('存档读取异常，请导出备份并检查浏览器设置');

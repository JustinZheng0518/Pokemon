'use strict';
const Rules=PocketRules,{SPECIES,CHARGE_TARGET}=Rules;
const SAVE_KEY='pocket-field-v1';
const $=s=>document.querySelector(s);
let state=Rules.fresh(),storageOK=true,unreadableSave=false;
try{
  const raw=localStorage.getItem(SAVE_KEY);
  if(raw){const parsed=JSON.parse(raw);if(Rules.validSave(parsed))state=Rules.migrate(parsed);else{storageOK=false;unreadableSave=true;}}
}catch{storageOK=false;unreadableSave=true;}
let dirty=false,saveClock=0,toastTimer;
function save(){
  // Never overwrite a corrupt or unsupported save on initial load.
  if(unreadableSave)return;
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));dirty=false;}
  catch{storageOK=false;toast('无法保存进度，请导出存档备份');}
}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2800);}
function pokeImage(p,shiny=false){
  const img=new Image();img.src=`assets/sprites/${p.id}${shiny?'-shiny':''}.png`;img.alt=p.name;img.loading='lazy';
  img.onerror=()=>{img.onerror=null;img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="23" fill="#e8e4c9" stroke="#98777b" stroke-width="3"/><path d="M17 40h46" stroke="#98777b" stroke-width="3"/><circle cx="40" cy="40" r="7" fill="#fdf7dc" stroke="#98777b" stroke-width="3"/></svg>');};return img;
}
let filter='all',activeTab='explore',autoEnabled=true,speed=state.speed||1;
let balls=[],nextBallIn=0,simTime=0,accumulator=0,lastTime=null,nextId=1;
let boardHits=0,landings=0;
const MAX_BALLS=80,SPAWN_INTERVAL=.65;
function renderStats(){
  $('#shotTotal').textContent=state.shots;$('#coins').textContent=state.coins;
  $('#progress').textContent=`${Object.keys(state.caught).length} / ${SPECIES.length}`;
  $('#caughtTotal').textContent=`${Object.values(state.caught).reduce((n,c)=>n+c.count,0)} 位伙伴`;
}
function renderRecent(){
  const root=$('#recent');root.replaceChildren();
  if(!state.recent.length){const p=document.createElement('p');p.className='empty';p.textContent='获得的精灵先保留在待收获区，点击「全部收获」后加入图鉴。';root.append(p);}
  state.recent.slice(0,4).forEach(r=>{
    const p=SPECIES.find(p=>p.id===r.id),card=document.createElement('div');card.className='recent-item';
    const name=document.createElement('strong');name.textContent=p.name+(r.shiny?' ✦':'');
    const detail=document.createElement('small');detail.textContent=r.shiny?'闪光伙伴':p.type+'系 · 已领取';
    card.append(pokeImage(p,r.shiny),name,detail);root.append(card);
  });
}
function renderDex(){
  const root=$('#dex');root.replaceChildren();
  SPECIES.filter(p=>filter==='all'||(filter==='caught'?state.caught[p.id]:state.caught[p.id]?.shiny)).forEach(p=>{
    const c=state.caught[p.id],card=document.createElement('div');card.className='dex-card'+(c?'':' locked');
    const num=document.createElement('small');num.textContent='#'+String(p.id).padStart(3,'0');
    const name=document.createElement('strong');name.textContent=c?p.name:'未发现';
    const detail=document.createElement('small');detail.textContent=c?`${p.type} · ×${c.count}`:p.rarity===5?'传说专属捕捉':p.rarity===4?'幻之精灵':'等待一次相遇';
    card.append(num,pokeImage(p,!!c?.shiny),name,detail);
    if(c?.shiny){const star=document.createElement('span');star.className='shiny-star';star.textContent='✦ '+c.shiny;card.append(star);}
    root.append(card);
  });
  if(!root.children.length){const p=document.createElement('p');p.className='empty';p.textContent='还没有这样的伙伴，继续探索并收获吧。';root.append(p);}
}
function renderAuto(){
  $('#launch').setAttribute('aria-checked',String(autoEnabled));$('#autoLabel').textContent='自动投球：'+(autoEnabled?'开':'关');
  $('#autoAction').textContent=autoEnabled?'暂停 Ⅱ':'继续 ▷';$('#boardStatus').textContent=autoEnabled?'● 自动探索中':'Ⅱ 已暂停';
  $('#speed').value=speed;$('#speedValue').textContent=speed+'×';
}
function renderLegends(){
  for(let side=0;side<2;side++){
    const ready=state.charge[side]>=CHARGE_TARGET,button=$('#catch'+side),chance=Math.round(Rules.catchChance(state,side)*100);
    $('#legend'+side).classList.toggle('ready',ready);$('#chargeBar'+side).value=state.charge[side];
    $('#chargeText'+side).textContent=`${state.charge[side]} / ${CHARGE_TARGET}`;
    $('#legendState'+side).textContent=ready?'✦ 已出现，等待捕捉':'研究充能中';
    button.disabled=!ready||state.inventory.ultraBall<1;
    button.textContent=!ready?'充能满后可捕捉':state.inventory.ultraBall<1?'需要高级球 · 商店可购买':`投掷高级球 · ${chance}%`;
    $('#chance'+side).textContent=state.failures[side]>=4?'研究助力：本次必定成功':`失败保留充能 · 已尝试 ${state.failures[side]} 次`;
  }
  $('#bagUltra').textContent=state.inventory.ultraBall;$('#bagBerry').textContent=state.inventory.razzBerry;
  $('#useBerry').checked=state.useBerry;$('#chargeEach').textContent=Rules.chargePerBall(state);
}
function renderPending(){
  const count=Rules.countPending(state),root=$('#pending');root.replaceChildren();
  $('#pendingSummary').textContent=`${count} 只精灵 · ${state.pending.coins} 金币`;
  $('#claim').disabled=!count&&!state.pending.coins;
  if(!count){const p=document.createElement('p');p.className='empty';p.textContent=state.pending.coins?'金币也能单独领取；精灵奖励正在路上。':'精灵信号、中央黄球和传说捕捉的成果会汇总在这里。';root.append(p);}
  // Aggregate by species and color, so a long session never creates an unbounded DOM.
  state.pending.entries.forEach(e=>{
    const p=SPECIES.find(p=>p.id===e.id),card=document.createElement('div');card.className='pending-card'+(e.shiny?' shiny':'');
    const name=document.createElement('strong');name.textContent=p.name+(e.shiny?' ✦':'');
    const amount=document.createElement('small');amount.textContent=`待收获 ×${e.count}`;
    card.append(pokeImage(p,e.shiny),name,amount);root.append(card);
  });
}
function renderShop(){
  const root=$('#shopItems');root.replaceChildren();
  for(const [key,item] of Object.entries(Rules.SHOP)){
    const card=document.createElement('article');card.className='shop-item';
    const icon=document.createElement('span');icon.className='item-icon '+key;icon.textContent=key==='ultraBall'?'H':key==='razzBerry'?'♧':'◇';
    const copy=document.createElement('div');copy.className='item-copy';const title=document.createElement('h3');title.textContent=item.name;
    const desc=document.createElement('p');desc.textContent=item.description;copy.append(title,desc);
    const buy=document.createElement('button');buy.dataset.buy=key;buy.disabled=state.coins<item.price;buy.textContent=`${item.price} 金币`;
    buy.onclick=()=>{
      const result=Rules.buy(state,key);
      if(!result.ok)return toast('可用金币不足，请先收获探索成果');
      dirty=true;save();renderStats();renderLegends();renderShop();$('#shopStatus').textContent=`已购买 ${item.name} ×1，加入背包。`;
    };
    card.append(icon,copy,buy);root.append(card);
  }
  const inventory=$('#inventory');inventory.replaceChildren();
  for(const [key,item]of Object.entries(Rules.SHOP)){const row=document.createElement('div');row.className='bag-count';const name=document.createElement('span');name.textContent=item.name;const qty=document.createElement('strong');qty.textContent='×'+state.inventory[key];row.append(name,qty);inventory.append(row);}
  $('#train').disabled=state.inventory.rareCandy<1||state.level>=5;
  $('#levelText').textContent=`研究伙伴 Lv.${state.level} / 5 · 每颗侧区落球充能 ${Rules.chargePerBall(state)}（每级 +25）`;
}
function render(){renderStats();renderAuto();renderLegends();renderPending();renderRecent();if(activeTab==='collection')renderDex();if(activeTab==='shop')renderShop();}
function rewardChanged(){dirty=true;if(activeTab==='explore'){renderPending();renderLegends();}}
function floatText(text,x,y,color='#8b6432'){
  if(effects.length<18)effects.push({x,y,text,life:1.2,color});
}
$('#launch').onclick=()=>{autoEnabled=!autoEnabled;lastTime=null;accumulator=0;renderAuto();};
$('#speed').oninput=()=>{speed=Number($('#speed').value);state.speed=speed;renderAuto();save();};
$('#burst').onclick=()=>{if(!autoEnabled)return toast('已暂停，打开自动投球后再加投');for(let i=0;i<5;i++)launchBall();renderStats();};
$('#useBerry').onchange=()=>{state.useBerry=$('#useBerry').checked;save();renderLegends();};
for(let side=0;side<2;side++)$('#catch'+side).onclick=()=>{
  const result=Rules.attemptLegend(state,side),name=SPECIES.find(p=>p.id===Rules.LEGEND_IDS[side]).name;
  if(!result.ok)return toast(result.reason==='ball'?'需要高级球，请在商店购买':'充能尚未达到 12500');
  $('#captureStatus').textContent=result.success?`${name} 捕捉成功！已放入待收获区，点击「全部收获」一起领取。`:`${name} 挣脱了高级球，充能保留！下次成功率 ${Math.round(Rules.catchChance(state,side)*100)}%。`;
  dirty=true;save();renderLegends();renderPending();
};
$('#claim').onclick=()=>{
  const result=Rules.claim(state);if(!result.count&&!result.coins)return;
  dirty=true;save();render();$('#claimStatus').textContent=`本次一起收获 ${result.count} 只精灵、${result.coins} 金币。探索仍在继续。`;
};
$('#train').onclick=()=>{
  const result=Rules.train(state);if(!result.ok)return;
  save();renderShop();renderLegends();$('#shopStatus').textContent=`研究伙伴提升到 Lv.${state.level}，左右落点每球充能 ${Rules.chargePerBall(state)}！`;
};
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  activeTab=b.dataset.tab;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));
  document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==activeTab);
  if(activeTab==='explore'){renderPending();renderLegends();renderRecent();resize();}
  if(activeTab==='collection')renderDex();if(activeTab==='shop')renderShop();
});
document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('.filter').forEach(t=>t.classList.toggle('active',t===b));renderDex();});
$('#export').onclick=()=>{
  save();const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`pocket-field-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('#import').onchange=async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  if(autoEnabled)return toast('请先暂停自动投球，再导入存档');if(file.size>100000)return toast('存档文件过大');
  try{
    const parsed=JSON.parse(await file.text());if(!Rules.validSave(parsed))throw Error();
    if(!confirm('导入会替换当前进度，包括待收获成果。建议先导出备份，确定继续吗？'))return;
    state=Rules.migrate(parsed);unreadableSave=false;balls=[];nextBallIn=0;speed=state.speed||1;save();render();toast('存档已导入，打开开关即可继续');
  }catch{toast('无法读取存档，请选择本游戏导出的 JSON 文件');}
};
const canvas=$('#board'),ctx=canvas.getContext('2d'),W=400,H=520;
const BALL_RADIUS=3.4,GRAVITY=210,MAX_FALL=185;
const pegs=[];
for(let row=0;row<12;row++)for(let col=0;col<12;col++){
  const x=15+col*33+(row%2?16.5:0),y=63+row*31;
  if(x>389 || Math.hypot(x-200,y-315)<53 || Math.hypot(x-111,y-116)<30 || Math.hypot(x-289,y-116)<30)continue;
  pegs.push({x,y,r:2.8,lit:0});
}
const bumpers=[{x:111,y:116,r:18,kind:'energy',lit:0},{x:289,y:116,r:18,kind:'signal',lit:0}];
const rails=[{x1:183,y1:443,x2:190,y2:492},{x1:217,y1:443,x2:210,y2:492}];
const wheel={x:200,y:315,r:34,rotation:0};
const effects=[];
const mapImage=new Image();mapImage.src='assets/town.svg';
const guardianImages=[150,249].map(id=>{const img=new Image();img.src=`assets/sprites/${id}.png`;return img;});
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
  label(`电磁脉冲 ${state.energyHits}/30`,111,150,98);label(`精灵信号 ${state.signalHits}/50`,289,150,98);
  // Four rotating red-and-white arcs with physical gaps.
  ctx.lineCap='round';for(let i=0;i<4;i++){const a=wheel.rotation+i*Math.PI/2;ctx.strokeStyle='#778872';ctx.lineWidth=6;ctx.beginPath();ctx.arc(wheel.x,wheel.y+1,wheel.r,a,a+1.03);ctx.stroke();ctx.strokeStyle=i%2?'#f3f0d9':'#b83b51';ctx.lineWidth=4;ctx.beginPath();ctx.arc(wheel.x,wheel.y,wheel.r,a,a+1.03);ctx.stroke();}
  circle(wheel.x,wheel.y,8,'#a99547');circle(wheel.x,wheel.y,5,'#e3c867');circle(wheel.x-1,wheel.y-1,2,'#faf0b3');label('✦ 碰到黄色球，必得闪光',200,267,152);
  for(const r of rails){ctx.strokeStyle='#703c49';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(r.x1,r.y1);ctx.lineTo(r.x2,r.y2);ctx.stroke();ctx.strokeStyle='#c64f65';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(r.x1,r.y1);ctx.lineTo(r.x2,r.y2);ctx.stroke();}
  label('中缝 5% 精灵',200,435,91);
  ctx.strokeStyle='#a9b59b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,450);ctx.lineTo(400,450);ctx.stroke();
  label(`超梦 ${state.charge[0]}/12500`,87,438,119,'#dbd1e4');label(`洛奇亚 ${state.charge[1]}/12500`,313,438,119,'#d3e3bf');
  guardianImages.forEach((img,i)=>{if(img.complete&&img.naturalWidth){ctx.imageSmoothingEnabled=false;ctx.drawImage(img,i?277:49,449,73,66);}});
  for(let side=0;side<2;side++){ctx.fillStyle='#6b7058';ctx.fillRect(side?256:26,506,118,4);ctx.fillStyle=side?'#9bbfc9':'#b29ac3';ctx.fillRect(side?256:26,506,118*state.charge[side]/CHARGE_TARGET,4);}
  for(const b of balls)drawBall(b);
  for(const e of effects){ctx.globalAlpha=Math.min(1,e.life*2);ctx.textAlign='center';ctx.font='bold 9px sans-serif';ctx.fillStyle=e.color;ctx.fillText(e.text,e.x,e.y);ctx.globalAlpha=1;}
  if(!autoEnabled){ctx.fillStyle='#38432b26';ctx.fillRect(0,0,W,H);label('Ⅱ 已暂停 · 点击上方开关继续',200,210,183,'#fff7e6');}
}
function launchBall(){
  if(balls.length>=MAX_BALLS)return;
  const aim=Number($('#aim').value), x=Math.max(12,Math.min(388,28+Math.random()*344+aim*30));
  balls.push({id:nextId++,x,y:21+Math.random()*6,vx:aim*40+(Math.random()-.5)*30,vy:25+Math.random()*18,age:0,hits:0,coins:0,yellowHit:false,spin:Math.random()*6,lastPeg:null});
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
    if(p.kind==='energy'&&Rules.energyHit(state)){floatText('电磁脉冲：双侧 +1000',111,95);rewardChanged();}
    if(p.kind==='signal'){const reward=Rules.signalHit(state);if(reward){floatText('精灵信号：获得伙伴',289,95);rewardChanged();}}
    if(p.kind)dirty=true;
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
  const result=Rules.settleBall(state,b);landings++;
  if(result.zone==='left'||result.zone==='right')floatText('+'+Rules.chargePerBall(state),result.zone==='left'?87:313,474);
  if(result.reward)floatText('发现精灵 · 待收获',200,466);
  rewardChanged();
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
    if(d<7+BALL_RADIUS&&!b.yellowHit){
      b.yellowHit=true;Rules.yellowHit(state);floatText('✦ 闪光精灵 · 待收获',200,291);rewardChanged();
      const nx=d?dx/d:0,ny=d?dy/d:-1;b.x=wheel.x+nx*(7+BALL_RADIUS+.1);b.y=wheel.y+ny*(7+BALL_RADIUS+.1);impact(b,nx,ny,.65);
    }
    const angle=((Math.atan2(dy,dx)-wheel.rotation)%(Math.PI/2)+Math.PI/2)%(Math.PI/2);
    if(Math.abs(d-wheel.r)<BALL_RADIUS+2&&angle<1.03&&d>.001){
      const side=d>=wheel.r?1:-1,nx=dx/d*side,ny=dy/d*side;
      b.x=wheel.x+dx/d*(wheel.r+side*(BALL_RADIUS+2.1));b.y=wheel.y+dy/d*(wheel.r+side*(BALL_RADIUS+2.1));
      if(impact(b,nx,ny,.72)){b.vx+=-dy/d*12;b.vy+=dx/d*12;}
    }
    for(const r of rails)collideRail(b,r);
    b.vx=Math.max(-160,Math.min(160,b.vx));
    // Resolve rare stuck balls after 24 simulated seconds to keep the board bounded.
    if(b.y>492||b.age>24){b.timedOut=b.y<=492;balls.splice(i,1);finishBall(b);}
  }
}
let statsClock=0;
function advance(elapsed){
  if(!autoEnabled)return;
  nextBallIn-=elapsed*speed;
  while(nextBallIn<=0){launchBall();nextBallIn+=SPAWN_INTERVAL;}
  // Critical: spawn rate never scales the physics clock, gravity or wheel rotation.
  accumulator+=elapsed;
  while(accumulator>=1/120){step(1/120);accumulator-=1/120;}
}
function frame(t){
  if(lastTime===null)lastTime=t;
  const elapsed=Math.max(0,Math.min((t-lastTime)/1000,.05));lastTime=t;
  if(!document.hidden)advance(elapsed);else accumulator=0;
  statsClock+=elapsed;saveClock+=elapsed;
  if(statsClock>.2){$('#ballCount').textContent=`场上 ${balls.length} 球 · 已落球 ${landings}`;renderStats();statsClock=0;}
  if(saveClock>1){if(dirty)save();saveClock=0;}
  if(activeTab==='explore')draw();requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{lastTime=null;accumulator=0;if(document.hidden)save();});
window.addEventListener('pagehide',save);
render();resize();save();launchBall();nextBallIn=SPAWN_INTERVAL;requestAnimationFrame(frame);
if(!storageOK)toast('旧存档读取异常，已保留原文件；请先备份或导入有效存档');

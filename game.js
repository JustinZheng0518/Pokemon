'use strict';
const SPECIES=[
[1,'妙蛙种子','草',1],[4,'小火龙','火',1],[7,'杰尼龟','水',1],[10,'绿毛虫','虫',1],[16,'波波','飞行',1],[25,'皮卡丘','电',2],[35,'皮皮','妖精',2],[37,'六尾','火',2],[39,'胖丁','妖精',1],[43,'走路草','草',1],[54,'可达鸭','水',1],[58,'卡蒂狗','火',2],[63,'凯西','超能力',2],[79,'呆呆兽','水',1],[92,'鬼斯','幽灵',2],[95,'大岩蛇','岩石',2],[129,'鲤鱼王','水',1],[131,'拉普拉斯','水',3],[132,'百变怪','一般',3],[133,'伊布','一般',2],[143,'卡比兽','一般',3],[147,'迷你龙','龙',3],[151,'梦幻','超能力',4],[175,'波克比','妖精',2],[179,'咩利羊','电',1],[196,'太阳伊布','超能力',3],[197,'月亮伊布','恶',3],[252,'木守宫','草',2],[255,'火稚鸡','火',2],[258,'水跃鱼','水',2]
].map(([id,name,type,rarity])=>({id,name,type,rarity}));
const SAVE_KEY='pocket-field-v1';
const $=s=>document.querySelector(s);
const today=()=>new Date().toLocaleDateString('sv-SE');
const fresh=()=>({version:1,energy:20,coins:100,date:today(),caught:{},recent:[],shots:0});
function validSave(s){return s&&s.version===1&&Number.isInteger(s.energy)&&s.energy>=0&&s.energy<=1000000&&Number.isInteger(s.coins)&&s.coins>=0&&s.coins<=100000000&&Number.isInteger(s.shots)&&s.shots>=0&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)&&s.caught&&typeof s.caught==='object'&&!Array.isArray(s.caught)&&Object.entries(s.caught).every(([id,v])=>SPECIES.some(p=>String(p.id)===id)&&v&&Number.isInteger(v.count)&&v.count>0&&Number.isInteger(v.shiny)&&v.shiny>=0&&v.shiny<=v.count)&&Array.isArray(s.recent)&&s.recent.length<=12&&s.recent.every(r=>r&&SPECIES.some(p=>p.id===r.id)&&typeof r.shiny==='boolean');}
let state=fresh(),storageOK=true;
try{const raw=localStorage.getItem(SAVE_KEY);if(raw){const parsed=JSON.parse(raw);if(validSave(parsed))state=parsed;else storageOK=false;}}catch{storageOK=false;}
function daily(){if(state.date!==today()){state.energy=Math.max(20,state.energy);state.date=today();return true;}return false;}
daily();
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{storageOK=false;toast('浏览器无法保存，请导出存档备份');}}
let toastTimer;
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
function sprite(p,shiny=false){return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shiny?'shiny/':''}${p.id}.png`;}
function pokeImage(p,shiny=false){const img=document.createElement('img');img.src=sprite(p,shiny);img.alt=p.name;img.loading='lazy';img.onerror=()=>{img.onerror=null;img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="25" fill="#d5e3b7" stroke="#60816b" stroke-width="4"/><path d="M15 40h50" stroke="#60816b" stroke-width="4"/><circle cx="40" cy="40" r="8" fill="#fff" stroke="#60816b" stroke-width="4"/></svg>');};return img;}
let filter='all';
function render(){
$('#energy').textContent=state.energy;$('#coins').textContent=state.coins;$('#progress').textContent=`${Object.keys(state.caught).length} / ${SPECIES.length}`;
$('#caughtTotal').textContent=`共 ${Object.values(state.caught).reduce((a,v)=>a+v.count,0)} 位伙伴`;
const recent=$('#recent');recent.replaceChildren();
if(!state.recent.length){const p=document.createElement('p');p.className='empty';p.textContent='这里还很安静。发射第一颗弹珠，开始你的收藏。';recent.append(p);}
state.recent.slice(0,4).forEach(r=>{const p=SPECIES.find(p=>p.id===r.id),card=document.createElement('div');card.className='recent-item';card.append(pokeImage(p,r.shiny));const name=document.createElement('strong');name.textContent=p.name+(r.shiny?' ✦':'');const type=document.createElement('small');type.textContent=r.shiny?'闪光伙伴':p.type+'系伙伴';card.append(name,type);recent.append(card);});
const dex=$('#dex');dex.replaceChildren();
SPECIES.filter(p=>filter==='all'||(filter==='caught'?state.caught[p.id]:state.caught[p.id]?.shiny)).forEach(p=>{const c=state.caught[p.id],card=document.createElement('div');card.className='dex-card'+(c?'':' locked');const num=document.createElement('small');num.textContent='#'+String(p.id).padStart(3,'0');const name=document.createElement('strong');name.textContent=c?p.name:'未发现';const count=document.createElement('small');count.textContent=c?`${p.type} · ×${c.count}`:'等待一次相遇';card.append(num,pokeImage(p,!!c?.shiny),name,count);if(c?.shiny){const star=document.createElement('span');star.className='shiny-star';star.textContent='✦ '+c.shiny;card.append(star);}dex.append(card);});
if(!dex.children.length){const p=document.createElement('p');p.className='empty';p.textContent='还没有这样的伙伴，继续探索吧。';dex.append(p);}
$('#launch').disabled=!!ball;$('#gacha').disabled=!!ball;
}
let audioOn=false,audioCtx;
function sound(freq=500){if(!audioOn)return;try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.frequency.value=freq;g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.16);o.start();o.stop(audioCtx.currentTime+.17);}catch{}}
$('#sound').onclick=()=>{audioOn=!audioOn;$('#sound').textContent='声音：'+(audioOn?'开':'关');$('#sound').setAttribute('aria-pressed',audioOn);sound();};
const rarityNames=['','常见伙伴','特别伙伴','稀有伙伴','传说伙伴'];
function capture(boost=0){const roll=Math.random();const tier=roll<.015+boost*.002?4:roll<.12+boost*.012?3:roll<.44+boost*.015?2:1;const pool=SPECIES.filter(p=>p.rarity===tier);const p=pool[Math.floor(Math.random()*pool.length)],shiny=Math.random()<.05,isNew=!state.caught[p.id];const c=state.caught[p.id]??{count:0,shiny:0};c.count++;if(shiny)c.shiny++;state.caught[p.id]=c;state.recent.unshift({id:p.id,shiny});state.recent=state.recent.slice(0,12);save();render();
$('#rewardTag').textContent=shiny?'A SHINY LITTLE MIRACLE':isNew?'NEW DISCOVERY':'HELLO AGAIN';$('#rewardHeading').textContent=shiny?'闪光！是特别的相遇':isNew?'发现一位新朋友！':'老朋友，又见面啦';$('#rewardName').textContent=p.name+(shiny?' ✦':'');$('#rewardRarity').textContent=rarityNames[p.rarity]+' · '+p.type;$('#rewardText').textContent=`已加入收藏 · 你拥有 ${c.count} 只${shiny?'，其中闪光 '+c.shiny+' 只':''}`;
const img=$('#rewardImage');img.hidden=false;$('#rewardFallback').hidden=true;img.onerror=()=>{img.hidden=true;$('#rewardFallback').hidden=false;};img.src=sprite(p,shiny);img.alt=p.name;
$('#reward').showModal();sound(shiny?1100:740);
}
$('#closeReward').onclick=$('#continue').onclick=()=>$('#reward').close();
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==b.dataset.tab);if(b.dataset.tab==='explore')resize();});
document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('.filter').forEach(t=>t.classList.toggle('active',t===b));render();});
$('#refill').onclick=()=>{if(state.coins<30)return toast('金币不足，探索碰撞可以获得金币');state.coins-=30;state.energy+=5;save();render();toast('已补充 5 点探索能量');};
$('#gacha').onclick=()=>{if(ball)return;if(state.coins<50)return toast('需要 50 金币，先去森林探索吧');state.coins-=50;capture(3);};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`pocket-field-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#import').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(ball)return toast('请等待本次探索结束后再导入');if(file.size>100000)return toast('存档文件过大');try{const parsed=JSON.parse(await file.text());if(!validSave(parsed))throw Error();if(!confirm('导入会替换当前进度。建议先导出备份，确定继续吗？'))return;state=parsed;daily();save();render();toast('存档已导入');}catch{toast('无法读取存档，请选择本游戏导出的 JSON 文件');}};
// Fixed-step simulation keeps collisions consistent on 60 Hz and 120 Hz phones.
const canvas=$('#board'),ctx=canvas.getContext('2d');
const W=400,H=490;
let ball=null,lastTime=0,accumulator=0;
const pegs=[];
for(let row=0;row<7;row++)for(let col=0;col<7;col++){const x=45+col*51+(row%2?20:0),y=105+row*43;if(x<375&&!(row===3&&col===3))pegs.push({x,y,r:5,lit:0});}
const bumpers=[{x:107,y:183,r:23,label:'⚡',color:'#d8ce73'},{x:292,y:183,r:23,label:'◒',color:'#dba795'},{x:200,y:317,r:28,label:'✧',color:'#afc68a'}];
const particles=[];
function resize(){const d=Math.min(window.devicePixelRatio||1,2);canvas.width=W*d;canvas.height=H*d;ctx.setTransform(d,0,0,d,0,0);draw();}
window.addEventListener('resize',resize);
function circle(x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function roundBox(x,y,w,h,r,color){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();}
function draw(){ctx.clearRect(0,0,W,H);ctx.fillStyle='#eaf0de';ctx.fillRect(0,0,W,H);
// Subtle forest floor grid, river, and tiny trees.
ctx.strokeStyle='#dfe7d3';ctx.lineWidth=1;for(let x=20;x<W;x+=25){ctx.beginPath();ctx.moveTo(x,40);ctx.lineTo(x,H);ctx.stroke();}for(let y=40;y<H;y+=25){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
ctx.beginPath();ctx.moveTo(266,40);ctx.bezierCurveTo(195,145,330,240,241,365);ctx.bezierCurveTo(195,419,180,452,190,490);ctx.strokeStyle='#cfdfd6';ctx.lineWidth=30;ctx.stroke();ctx.strokeStyle='#dce8df';ctx.lineWidth=18;ctx.stroke();
for(let i=0;i<28;i++){let x=(i*113+19)%385,y=55+(i*71)%355;ctx.fillStyle='#b2c19c';ctx.fillRect(x-1,y+4,3,8);circle(x,y,7,'#d0dcbc');circle(x-2,y-4,5,'#c0d0aa');}
roundBox(157,42,86,27,13,'#dde5ce');ctx.fillStyle='#7d9069';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('森林入口',200,59);
for(const p of pegs){circle(p.x+1,p.y+2,p.r,'#b9c8a5');circle(p.x,p.y,p.r,p.lit>0?'#f0d67a':'#fbfcf0');circle(p.x-1,p.y-1,1.5,'#d6dfc8');}
for(const b of bumpers){circle(b.x,b.y+4,b.r+4,'#c6d3b5');circle(b.x,b.y,b.r+3,'#f8faec');circle(b.x,b.y,b.r,b.color);circle(b.x,b.y,b.r-5,'#f5f0ce');ctx.fillStyle='#65774d';ctx.font='bold 25px sans-serif';ctx.fillText(b.label,b.x,b.y+8);ctx.font='9px sans-serif';ctx.fillText(b.x===200?'幸运研究站':b.x===107?'能量碰撞':'精灵信号',b.x,b.y+b.r+17);}
const zones=[['草丛',0,'#c5d5a8'],['溪流',134,'#bed5d1'],['秘境',267,'#ded4a8']];for(const [label,x,c]of zones){roundBox(x+9,425,115,35,8,c);ctx.fillStyle='#657c58';ctx.font='11px sans-serif';ctx.fillText(label,x+67,447);}
if(!ball){const aim=Number($('#aim').value);ctx.setLineDash([3,7]);ctx.strokeStyle='#829c68';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(200,78);ctx.lineTo(200+Math.sin(aim)*100,78+Math.cos(aim)*100);ctx.stroke();ctx.setLineDash([]);circle(200,78,7,'#f9f4d4');circle(198,76,2,'white');}
if(ball){for(let i=0;i<ball.trail.length;i++){const p=ball.trail[i];circle(p.x,p.y,2+i*.25,`rgba(237,190,72,${i/ball.trail.length*.4})`);}circle(ball.x+1,ball.y+2,7,'#a5ac81');circle(ball.x,ball.y,7,'#f5ce67');circle(ball.x-2,ball.y-2,2,'#fff8d6');}
for(const p of particles){ctx.globalAlpha=Math.max(0,p.life);circle(p.x,p.y,2.5,'#b39c4b');}ctx.globalAlpha=1;
}
function step(dt){for(const p of pegs)p.lit=Math.max(0,p.lit-dt);for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt*2;if(p.life<=0)particles.splice(i,1);}if(!ball)return;const b=ball;b.age+=dt;b.vy+=260*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.trail.push({x:b.x,y:b.y});if(b.trail.length>9)b.trail.shift();if(b.x<12){b.x=12;b.vx=Math.abs(b.vx)*.85;}if(b.x>W-12){b.x=W-12;b.vx=-Math.abs(b.vx)*.85;}if(b.y<73){b.y=73;b.vy=Math.abs(b.vy);}
for(const p of [...pegs,...bumpers]){const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy),min=p.r+7;if(d<min){const nx=d?dx/d:0,ny=d?dy/d:-1;b.x=p.x+nx*(min+.5);b.y=p.y+ny*(min+.5);const dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=1.65*dot*nx;b.vy-=1.65*dot*ny;b.vx+=nx*(p.r>10?45:12);b.vy+=ny*(p.r>10?45:12);b.hits++;b.coins+=p.r>10?5:1;p.lit=.25;if(b.hits%3===0)sound(380+b.hits*12);for(let i=0;i<4;i++)particles.push({x:p.x,y:p.y,vx:(Math.random()-.5)*80,vy:(Math.random()-.5)*80,life:.5});}}}
const speed=Math.hypot(b.vx,b.vy);if(speed>500){b.vx*=500/speed;b.vy*=500/speed;}
$('#ballCount').textContent=`碰撞 ${b.hits} 次 · +${b.coins} 金币`;
if(b.y>435||b.age>14)finishShot();
}
function finishShot(){if(!ball)return;const b=ball;ball=null;state.coins+=b.coins+10;save();$('#launchTitle').textContent=`探索完成 · 获得 ${b.coins+10} 金币`;$('#launchHint').textContent='每次探索必遇一只宝可梦，碰撞提升稀有机会';$('#ballCount').textContent='探索完成';render();capture(Math.min(5,b.hits/5));}
$('#launch').onclick=()=>{if(ball||$('#reward').open)return;daily();if(state.energy<1){render();return toast('能量不足，可补充能量，或等待明日补给');}state.energy--;state.shots++;save();const aim=Number($('#aim').value);ball={x:200,y:78,vx:Math.sin(aim)*230+(Math.random()-.5)*18,vy:Math.cos(aim)*180,age:0,hits:0,coins:0,trail:[]};$('#launchTitle').textContent='弹珠正在探索森林…';$('#launchHint').textContent='碰撞收集金币，落入区域后发现宝可梦';sound(600);render();};
$('#aim').oninput=()=>{if(!ball)draw();};
function frame(t){if(!lastTime)lastTime=t;accumulator+=Math.min((t-lastTime)/1000,.05);lastTime=t;while(accumulator>=1/120){step(1/120);accumulator-=1/120;}if(!$('#explore').hidden)draw();requestAnimationFrame(frame);}
document.addEventListener('visibilitychange',()=>{lastTime=0;accumulator=0;if(!document.hidden&&daily()){save();render();toast('新的一天，探索能量已补给');}});
window.addEventListener('pagehide',()=>{if(ball)finishShot();save();});
render();resize();save();requestAnimationFrame(frame);if(!storageOK)toast('存档读取异常，建议导出备份后检查浏览器设置');

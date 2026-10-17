/* Game rules are independent of rendering and the physics clock. */
(function (root, factory) {
  const rules=factory();
  if(typeof module==='object'&&module.exports)module.exports=rules;
  else root.PocketRules=rules;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SPECIES=[
    [1,'妙蛙种子','草',1],[4,'小火龙','火',1],[7,'杰尼龟','水',1],[10,'绿毛虫','虫',1],[16,'波波','飞行',1],[25,'皮卡丘','电',2],[35,'皮皮','妖精',2],[37,'六尾','火',2],[39,'胖丁','妖精',1],[43,'走路草','草',1],[54,'可达鸭','水',1],[58,'卡蒂狗','火',2],[63,'凯西','超能力',2],[79,'呆呆兽','水',1],[92,'鬼斯','幽灵',2],[95,'大岩蛇','岩石',2],[129,'鲤鱼王','水',1],[131,'拉普拉斯','水',3],[132,'百变怪','一般',3],[133,'伊布','一般',2],[143,'卡比兽','一般',3],[147,'迷你龙','龙',3],[150,'超梦','超能力',5],[151,'梦幻','超能力',4],[175,'波克比','妖精',2],[179,'咩利羊','电',1],[196,'太阳伊布','超能力',3],[197,'月亮伊布','恶',3],[249,'洛奇亚','超能力／飞行',5],[252,'木守宫','草',2],[255,'火稚鸡','火',2],[258,'水跃鱼','水',2]
  ].map(([id,name,type,rarity])=>({id,name,type,rarity}));
  const LEGEND_IDS=[150,249],CHARGE_TARGET=12500,CENTER_MIN=190,CENTER_MAX=210;
  const SHOP={
    ultraBall:{name:'高级球',price:800,description:'黑黄配色的 Ultra Ball。传说捕捉的必需品，每次尝试消耗 1 个。'},
    razzBerry:{name:'蔓莓果',price:200,description:'投喂后，本次传说捕捉成功率增加 15 个百分点，尝试时消耗。'},
    rareCandy:{name:'神奇糖果',price:2400,description:'提升研究伙伴 1 级，每级让左右落点充能增加 25。最高 Lv.5。'}
  };
  const int=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
  const known=id=>Number.isSafeInteger(id)&&SPECIES.some(p=>p.id===id);
  function baseValid(s){
    return s&&[1,2].includes(s.version)&&int(s.coins)&&int(s.shots)&&s.caught&&typeof s.caught==='object'&&!Array.isArray(s.caught)&&
      Object.entries(s.caught).every(([id,c])=>known(Number(id))&&String(Number(id))===id&&c&&int(c.count)&&c.count>0&&int(c.shiny)&&c.shiny<=c.count)&&
      Array.isArray(s.recent)&&s.recent.length<=12&&s.recent.every(r=>r&&known(r.id)&&typeof r.shiny==='boolean')&&
      (s.speed===undefined||(Number.isFinite(s.speed)&&s.speed>=.5&&s.speed<=5));
  }
  function validSave(s){
    if(!baseValid(s))return false;
    if(s.version===1)return true;
    return s.inventory&&Object.keys(SHOP).every(k=>int(s.inventory[k]))&&
      Array.isArray(s.charge)&&s.charge.length===2&&s.charge.every(n=>int(n,CHARGE_TARGET))&&
      Array.isArray(s.failures)&&s.failures.length===2&&s.failures.every(n=>int(n,4))&&
      int(s.energyHits,29)&&int(s.signalHits,49)&&int(s.level,5)&&s.level>=1&&typeof s.useBerry==='boolean'&&
      s.pending&&int(s.pending.coins)&&Array.isArray(s.pending.entries)&&s.pending.entries.length<=SPECIES.length*2&&
      s.pending.entries.every(e=>e&&known(e.id)&&typeof e.shiny==='boolean'&&int(e.count)&&e.count>0)&&
      new Set(s.pending.entries.map(e=>`${e.id}:${e.shiny}`)).size===s.pending.entries.length;
  }
  function fresh(){return {version:2,coins:800,shots:0,caught:{},recent:[],speed:1,
    inventory:{ultraBall:3,razzBerry:1,rareCandy:0},charge:[0,0],failures:[0,0],
    energyHits:0,signalHits:0,level:1,useBerry:false,pending:{coins:0,entries:[]}};}
  function migrate(s){
    if(!validSave(s))throw new Error('Invalid save');
    const copy=JSON.parse(JSON.stringify(s));
    if(copy.version===2)return copy;
    // Only the old owned collection is retained; the starter bag is granted once.
    return {...fresh(),coins:copy.coins,shots:copy.shots,caught:copy.caught,recent:copy.recent,speed:copy.speed||1};
  }
  function countPending(s){return s.pending.entries.reduce((n,e)=>n+e.count,0);}
  function enqueue(s,id,shiny=false,count=1){
    if(!known(id)||!int(count)||!count)throw new Error('Invalid reward');
    const e=s.pending.entries.find(e=>e.id===id&&e.shiny===shiny);
    if(e)e.count+=count;else s.pending.entries.push({id,shiny,count});
    return {id,shiny,count};
  }
  function randomReward(s,{shiny=false}={},rng=Math.random){
    const r=rng(),tier=r<.005?4:r<.08?3:r<.38?2:1,pool=SPECIES.filter(p=>p.rarity===tier);
    const p=pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];
    return enqueue(s,p.id,shiny||rng()<1/4096);
  }
  function addCharge(s,side,amount){s.charge[side]=Math.min(CHARGE_TARGET,s.charge[side]+amount);}
  function chargePerBall(s){return 125+(s.level-1)*25;}
  function energyHit(s){
    s.energyHits++;
    if(s.energyHits<30)return false;
    s.energyHits-=30;for(let i=0;i<2;i++)addCharge(s,i,1000);
    s.pending.coins+=100;return true;
  }
  function signalHit(s,rng=Math.random){s.signalHits++;if(s.signalHits<50)return null;s.signalHits-=50;return randomReward(s,{},rng);}
  function yellowHit(s,rng=Math.random){return randomReward(s,{shiny:true},rng);}
  function settleBall(s,b,rng=Math.random){
    s.pending.coins+=Math.max(0,Math.floor(b.coins||0))+5;
    // A timed-out ball grants earned coins only, never an arbitrary landing reward.
    if(b.timedOut)return {zone:'timeout'};
    if(b.x<CENTER_MIN){addCharge(s,0,chargePerBall(s));return {zone:'left'};}
    if(b.x>CENTER_MAX){addCharge(s,1,chargePerBall(s));return {zone:'right'};}
    return {zone:'center',reward:rng()<.05?randomReward(s,{},rng):null};
  }
  function claim(s){
    const count=countPending(s),coins=s.pending.coins;
    for(const e of s.pending.entries){
      const c=s.caught[e.id]??{count:0,shiny:0};c.count+=e.count;if(e.shiny)c.shiny+=e.count;s.caught[e.id]=c;
      s.recent.unshift({id:e.id,shiny:e.shiny});
    }
    s.recent=s.recent.slice(0,12);s.coins+=coins;s.pending={coins:0,entries:[]};return {count,coins};
  }
  function buy(s,key,qty=1){
    const item=SHOP[key];if(!item||!int(qty,99)||qty<1)return {ok:false,reason:'invalid'};
    const cost=item.price*qty;if(s.coins<cost)return {ok:false,reason:'coins'};
    s.coins-=cost;s.inventory[key]+=qty;return {ok:true,cost};
  }
  function train(s){
    if(s.level>=5)return {ok:false,reason:'max'};
    if(s.inventory.rareCandy<1)return {ok:false,reason:'candy'};
    s.inventory.rareCandy--;s.level++;return {ok:true};
  }
  function catchChance(s,side){if(s.failures[side]>=4)return 1;return Math.min(1,.35+s.failures[side]*.15+(s.useBerry&&s.inventory.razzBerry>0?.15:0));}
  function attemptLegend(s,side,rng=Math.random){
    if(side!==0&&side!==1)return {ok:false,reason:'invalid'};
    if(s.charge[side]<CHARGE_TARGET)return {ok:false,reason:'charge'};
    if(s.inventory.ultraBall<1)return {ok:false,reason:'ball'};
    const chance=catchChance(s,side);s.inventory.ultraBall--;
    const berry=s.useBerry&&s.inventory.razzBerry>0;if(berry)s.inventory.razzBerry--;
    const success=s.failures[side]>=4||rng()<chance;
    if(success){s.charge[side]=0;s.failures[side]=0;const reward=enqueue(s,LEGEND_IDS[side],rng()<1/4096);return {ok:true,success,chance,berry,reward};}
    s.failures[side]++;return {ok:true,success:false,chance,berry};
  }
  return {SPECIES,LEGEND_IDS,CHARGE_TARGET,CENTER_MIN,CENTER_MAX,SHOP,fresh,validSave,migrate,countPending,enqueue,randomReward,addCharge,chargePerBall,energyHit,signalHit,yellowHit,settleBall,claim,buy,train,catchChance,attemptLegend};
});

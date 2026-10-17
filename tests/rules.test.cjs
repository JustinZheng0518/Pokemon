const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../game-core.js');

test('old saves migrate once, preserving owned collection, shiny counts, coins and speed',()=>{
  const old={version:1,energy:0,coins:42,shots:99,caught:{25:{count:3,shiny:1},151:{count:1,shiny:0}},recent:[{id:25,shiny:true}],speed:5};
  const s=R.migrate(old);assert.equal(s.version,2);assert.deepEqual(s.caught,old.caught);assert.equal(s.coins,42);assert.equal(s.speed,5);
  s.inventory.ultraBall=0;assert.equal(R.migrate(s).inventory.ultraBall,0);assert.equal(old.version,1);assert(R.validSave(s));
});
test('three physical landing zones; side hits only charge their own legend',()=>{
  const s=R.fresh();R.settleBall(s,{x:189.9,coins:2});assert.deepEqual(s.charge,[125,0]);
  R.settleBall(s,{x:210.1,coins:0});assert.deepEqual(s.charge,[125,125]);assert.equal(R.countPending(s),0);
  for(let i=0;i<200;i++)R.settleBall(s,{x:50});assert.equal(s.charge[0],12500);assert.equal(s.charge[1],125);
  R.settleBall(s,{x:390,timedOut:true,coins:2});assert.equal(s.charge[1],125);assert.equal(s.pending.coins,202*5+2+7);
});
test('central gap is exactly 5%, including its two edges; misses never award a species',()=>{
  for(const x of [190,200,210]){
    const s=R.fresh();let values=[.049,.5,.5,.5];R.settleBall(s,{x},()=>values.shift());assert.equal(R.countPending(s),1);assert.deepEqual(s.charge,[0,0]);
    const miss=R.fresh();R.settleBall(miss,{x},()=>.05);assert.equal(R.countPending(miss),0);
  }
});
test('energy and signal counters wrap exactly, persist, and do not award prematurely',()=>{
  const s=R.fresh();for(let i=0;i<29;i++)assert.equal(R.energyHit(s),false);assert.deepEqual(s.charge,[0,0]);
  assert.equal(R.energyHit(s),true);assert.equal(s.energyHits,0);assert.deepEqual(s.charge,[1000,1000]);assert.equal(s.pending.coins,100);
  for(let i=0;i<49;i++)assert.equal(R.signalHit(s),null);assert.equal(R.countPending(s),0);
  assert(R.signalHit(s,()=>.5));assert.equal(s.signalHits,0);assert.equal(R.countPending(s),1);assert.equal(Object.keys(s.caught).length,0);
});
test('yellow rewards are guaranteed shiny, but random rewards never bypass legendary capture',()=>{
  const s=R.fresh();for(let i=0;i<100;i++){const e=R.yellowHit(s);assert(e.shiny);assert(!R.LEGEND_IDS.includes(e.id));}
  assert.equal(R.countPending(s),100);assert.equal(Object.keys(s.caught).length,0);
  for(let i=0;i<1000;i++){const e=R.randomReward(s);assert(R.SPECIES.find(p=>p.id===e.id).rarity<5);}
  assert(s.pending.entries.length<=R.SPECIES.length*2);
});
test('legend capture requires full charge and an Ultra Ball, and rejection consumes nothing',()=>{
  const s=R.fresh(),before=structuredClone(s);assert.equal(R.attemptLegend(s,0).reason,'charge');assert.deepEqual(s,before);
  s.charge[0]=12500;s.inventory.ultraBall=0;const full=structuredClone(s);assert.equal(R.attemptLegend(s,0).reason,'ball');assert.deepEqual(s,full);
});
test('failed captures retain full charge; exactly one ball and optional berry consumed per try',()=>{
  const s=R.fresh();s.charge[0]=12500;s.useBerry=true;const chance=R.catchChance(s,0);assert.equal(chance,.5);
  const fail=R.attemptLegend(s,0,()=>.99);assert.equal(fail.success,false);assert.equal(s.inventory.ultraBall,2);assert.equal(s.inventory.razzBerry,0);
  assert.equal(s.charge[0],12500);assert.equal(s.failures[0],1);assert.equal(R.catchChance(s,0),.5);
  const caught=R.attemptLegend(s,0,()=>0);assert(caught.success);assert.equal(s.charge[0],0);assert.equal(s.failures[0],0);assert.equal(s.inventory.ultraBall,1);
  assert.equal(R.countPending(s),1);assert.equal(s.caught[150],undefined);
});
test('the fifth attempt is guaranteed and a success resets only the captured side',()=>{
  const s=R.fresh();s.inventory.ultraBall=5;s.charge=[12500,12500];
  for(let i=0;i<4;i++)assert.equal(R.attemptLegend(s,1,()=>.99).success,false);
  assert.equal(R.catchChance(s,1),1);assert.equal(R.attemptLegend(s,1,()=>.99).success,true);
  assert.deepEqual(s.charge,[12500,0]);assert.equal(s.inventory.ultraBall,0);assert.equal(s.pending.entries[0].id,249);
});
test('batch harvest merges normal/shiny rewards once; pending coins cannot be spent early',()=>{
  const s=R.fresh();s.coins=0;s.pending.coins=1200;R.enqueue(s,25,false,3);R.enqueue(s,25,true,2);R.enqueue(s,25,true,1);
  assert.equal(s.pending.entries.length,2);assert.equal(R.buy(s,'ultraBall').reason,'coins');assert.equal(s.coins,0);
  const result=R.claim(s);assert.deepEqual(result,{count:6,coins:1200});assert.deepEqual(s.caught[25],{count:6,shiny:3});assert.equal(R.countPending(s),0);
  assert.deepEqual(R.claim(s),{count:0,coins:0});assert.equal(s.caught[25].count,6);assert.equal(s.coins,1200);
});
test('shop only sells inventory items; insufficient funds and malformed quantities are atomic',()=>{
  const s=R.fresh(),before=structuredClone(s);assert.equal(R.buy(s,'pokemon').reason,'invalid');assert.equal(R.buy(s,'ultraBall',-1).reason,'invalid');assert.equal(R.buy(s,'razzBerry',.5).reason,'invalid');assert.deepEqual(s,before);
  assert(R.buy(s,'ultraBall').ok);assert.equal(s.coins,0);assert.equal(s.inventory.ultraBall,4);assert.equal(R.countPending(s),0);assert.equal(R.buy(s,'razzBerry').reason,'coins');
});
test('rare candy only trains with a real item, and level cap consumes nothing',()=>{
  const s=R.fresh();assert.equal(R.train(s).reason,'candy');s.inventory.rareCandy=5;
  for(let i=0;i<4;i++)assert(R.train(s).ok);assert.equal(s.level,5);assert.equal(R.chargePerBall(s),225);assert.equal(s.inventory.rareCandy,1);
  assert.equal(R.train(s).reason,'max');assert.equal(s.inventory.rareCandy,1);
});
test('pending results, inventory, charge and counters survive JSON round trips',()=>{
  const s=R.fresh();s.charge=[12499,12500];s.energyHits=29;s.signalHits=49;s.failures=[2,4];R.enqueue(s,249,true,2);s.pending.coins=1234;
  assert.deepEqual(R.migrate(JSON.parse(JSON.stringify(s))),s);
  for(const edit of [s=>s.charge[0]=-1,s=>s.signalHits=50,s=>s.inventory.ultraBall=-1,s=>s.pending.entries.push({...s.pending.entries[0]}),s=>s.pending.entries[0].id='249',s=>s.speed=Infinity,s=>s.level=0]){
    const bad=structuredClone(s);edit(bad);assert.equal(R.validSave(bad),false);
  }
});

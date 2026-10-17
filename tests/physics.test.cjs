const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

// Minimal rendering boundary: run the production client/physics, without a browser
// or an animation scheduler. Rules, clocks, integration, and collisions are real.
function client(){
  const noop=()=>{};
  const paint=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(target,key)=>key in target?target[key]:noop});
  class Element{
    constructor(){this.value='0';this.classList={toggle:noop,add:noop,remove:noop};this.children=[];this.dataset={};this.complete=false;this.naturalWidth=0;}
    append(...nodes){this.children.push(...nodes);}
    replaceChildren(...nodes){this.children=nodes;}
    setAttribute(){}
    getContext(){return paint;}
  }
  const elements=new Map();
  const doc={hidden:false,querySelector(s){if(!elements.has(s))elements.set(s,new Element());return elements.get(s);},querySelectorAll:()=>[],createElement:()=>new Element(),addEventListener:noop};
  const sandbox={document:doc,window:{devicePixelRatio:1,addEventListener:noop},Image:Element,localStorage:{getItem:()=>null,setItem:noop},requestAnimationFrame:noop,setTimeout:()=>0,clearTimeout:noop};
  const context=vm.createContext(sandbox);
  for(const file of ['game-core.js','game.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
  return source=>JSON.parse(vm.runInContext(`JSON.stringify((()=>{${source}})())`,context));
}
const ball=`{id:500,x:92,y:30,vx:12,vy:30,age:0,hits:0,coins:0,yellowHit:false,spin:0}`;

test('spawn rate never changes an existing ball trajectory, age or wheel rotation',()=>{
  const run=client();const traces=run(`const results=[];for(const rate of [.5,1,5]){state=Rules.fresh();speed=rate;autoEnabled=true;nextBallIn=999;simTime=0;accumulator=0;balls=[${ball}];for(let i=0;i<300;i++)advance(1/120);results.push({ball:balls[0],time:simTime,phase:wheel.rotation});}return results;`);
  assert(traces[0].ball);assert.deepEqual(traces[0],traces[1]);assert.deepEqual(traces[1],traces[2]);
});
test('rate changes emissions while pause freezes both existing balls and emissions',()=>{
  const run=client();const counts=run(`const results=[];for(const rate of [.5,5]){state=Rules.fresh();speed=rate;autoEnabled=true;nextBallIn=0;accumulator=0;balls=[];for(let i=0;i<120;i++)advance(1/120);results.push(state.shots);}return results;`);
  assert.deepEqual(counts,[1,8]);
  const paused=run(`autoEnabled=false;const before=JSON.stringify({balls,shots:state.shots,time:simTime});for(let i=0;i<120;i++)advance(1/120);return {before,after:JSON.stringify({balls,shots:state.shots,time:simTime})};`);
  assert.equal(paused.before,paused.after);
});
test('real yellow-ball contact queues one shiny reward per ball and never auto-claims',()=>{
  const run=client();const result=run(`state=Rules.fresh();balls=[{...${ball},x:200,y:306,vy:50}];step(1/120);balls[0].x=200;balls[0].y=306;step(1/120);return {pending:state.pending,caught:state.caught};`);
  assert.equal(result.pending.entries.length,1);assert.equal(result.pending.entries[0].shiny,true);assert.equal(result.pending.entries[0].count,1);assert.deepEqual(result.caught,{});
});
test('real energy and signal collisions trigger at 30 and 50 respectively',()=>{
  const run=client();const result=run(`state=Rules.fresh();state.energyHits=29;state.signalHits=49;balls=[{...${ball},x:111,y:94.7,vx:0,vy:50}];step(1/120);balls=[{...${ball},x:289,y:94.7,vx:0,vy:50}];step(1/120);return {charge:state.charge,energy:state.energyHits,signal:state.signalHits,rewards:Rules.countPending(state),coins:state.pending.coins};`);
  assert.deepEqual(result,{charge:[1000,1000],energy:0,signal:0,rewards:1,coins:100});
});
test('a timed-out ball never charges a side or invents a random landing reward',()=>{
  const run=client();const result=run(`state=Rules.fresh();balls=[{...${ball},x:50,y:25,age:24.1,coins:3}];step(1/120);return {balls:balls.length,charge:state.charge,pending:state.pending};`);
  assert.deepEqual(result,{balls:0,charge:[0,0],pending:{coins:8,entries:[]}});
});

// Independent regression checks by CASEE; game source authored by local Archer-DeepSeek.
import assert from 'node:assert/strict';
import * as g from '../src/scripts/blackbeards-treasure/game-core.mjs';
let failures=0, checks=0;
function test(name, fn){checks++;try{fn();console.log('PASS',name);}catch(e){failures++;console.log('FAIL',name,e.message);}}
function ready(){const s=g.createGame(); for(const answer of ['253',String((330+180)%360),'D','aft'])assert.equal(g.submit(s,answer).ok,true);return s;}
test('fresh saved state validates without throwing',()=>assert.equal(g.validateStateShape(g.createGame()),true));
test('premature chest and escape are blocked',()=>{const s=g.createGame();assert.equal(g.useCrowbar(s).ok,false);assert.equal(g.escape(s).ok,false);assert.equal(s.won,false);});
test('bearing text and final hint ask for reverse chest-to-cove 150',()=>{const p=g.PUZZLES[1];assert.equal(p.answer,String((330+180)%360));assert.match(p.prompt,/chest.*cove/i);assert.match(p.hints[2],/150/);});
test('each legitimate puzzle-stage save is valid',()=>{const s=g.createGame();for(const a of ['253','150','D','aft']){assert.equal(g.submit(s,a).ok,true);assert.equal(g.validateStateShape(JSON.parse(JSON.stringify(s))),true);}});
test('four solves do not open chest or win',()=>{const s=ready();assert.equal(s.chestOpen,false);assert.equal(s.won,false);assert.equal(g.validateStateShape(s),true);});
test('crowbar grants actual treasure once and its save validates',()=>{const s=ready();assert.equal(g.useCrowbar(s).ok,true);assert.equal(s.won,false);assert.deepEqual(s.treasure,g.TREASURE);for(const item of g.TREASURE)assert.equal(s.inventory.filter(x=>x===item).length,1);assert.equal(g.validateStateShape(s),true);const before=JSON.stringify(s.inventory);assert.equal(g.useCrowbar(s).ok,false);assert.equal(JSON.stringify(s.inventory),before);});
test('escape after chest wins and validates',()=>{const s=ready();g.useCrowbar(s);assert.equal(g.escape(s).ok,true);assert.equal(s.won,true);assert.equal(g.validateStateShape(s),true);assert.equal(g.escape(s).ok,false);});
test('restart resets a won game completely',()=>{const s=ready();g.useCrowbar(s);g.escape(s);g.restart(s);assert.deepEqual(s,g.createGame());});
test('wrong answers retain gate and increment attempt',()=>{const s=g.createGame();assert.equal(g.submit(s,'999').ok,false);assert.equal(s.phase,0);assert.equal(s.attempts[0],1);assert.equal(g.validateStateShape(s),true);});
test('three hint levels and clamping',()=>{const s=g.createGame();for(let n=0;n<3;n++)assert.equal(g.hint(s,n).text,g.PUZZLES[0].hints[n]);assert.equal(g.hint(s,-1).level,0);assert.equal(g.hint(s,99).level,2);});
test('malformed saves fail closed without throwing',()=>{for(const bad of [null,{},[],{...g.createGame(),version:1},{...g.createGame(),solved:[true,false,false,false]},{...g.createGame(),inventory:['forged']},{...g.createGame(),won:true},{...g.createGame(),treasure:['gold coins']},{...g.createGame(),attempts:[-1,0,0,0]}])assert.equal(g.validateStateShape(bad),false);});
console.log(JSON.stringify({checks,failures}));process.exitCode=failures?1:0;

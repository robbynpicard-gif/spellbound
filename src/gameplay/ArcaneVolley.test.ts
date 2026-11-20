import {describe,it,expect} from 'vitest';
import {arcaneVolleyCapture,arcaneVolleyMultiplier,arcaneVolleyPhase,emptyArcaneVolley,volleyWindowTicks} from './ArcaneVolley';
describe('Arcane Volley preview momentum',()=>{
  it('requires two captures, surges at sixth and soft-caps at twenty-first',()=>{
    let s=emptyArcaneVolley();
    for(let i=1;i<=21;i++){
      s=arcaneVolleyCapture(s,i*60,5,false);
      expect(arcaneVolleyMultiplier(s,i*60,false)).toBe(i===1 ? 1 : Math.round((1+(i-1)*.2)*10)/10);
    }
    expect(arcaneVolleyPhase(arcaneVolleyMultiplier(s,1260,false))).toBe('surge');
    s=arcaneVolleyCapture(s,1320,5,false);
    expect(arcaneVolleyMultiplier(s,1320,false)).toBe(5);
    s=arcaneVolleyCapture(s,1380,5,false);
    expect(arcaneVolleyMultiplier(s,1380,false)).toBe(5.1);
  });
  it('requires faster capture rhythm on Hardcore and scales with word length',()=>{
    expect(volleyWindowTicks(5,false)).toBeGreaterThan(volleyWindowTicks(5,true));
    expect(volleyWindowTicks(9,false)).toBeGreaterThan(volleyWindowTicks(3,false));
    let n=arcaneVolleyCapture(emptyArcaneVolley(),0,5,false);
    let h=arcaneVolleyCapture(emptyArcaneVolley(),0,5,true);
    n=arcaneVolleyCapture(n,100,5,false);
    h=arcaneVolleyCapture(h,100,5,true);
    expect(arcaneVolleyMultiplier(n,100,false)).toBe(1.2);
    expect(arcaneVolleyMultiplier(h,100,true)).toBe(1);
  });
  it('fades on pauses and resets after a late capture',()=>{
    let s=emptyArcaneVolley();
    for(let i=0;i<6;i++)s=arcaneVolleyCapture(s,i*50,5,false);
    expect(arcaneVolleyMultiplier(s,250,false)).toBe(2);
    expect(arcaneVolleyMultiplier(s,360,false)).toBe(1.8);
    expect(arcaneVolleyMultiplier(s,600,false)).toBe(1);
    s=arcaneVolleyCapture(s,600,5,false);
    expect(arcaneVolleyMultiplier(s,600,false)).toBe(1);
  });
  it('is deterministic and does not mutate input state',()=>{
    const s=Object.freeze(arcaneVolleyCapture(emptyArcaneVolley(),20,6,false));
    expect(arcaneVolleyCapture(s,70,6,false)).toEqual(arcaneVolleyCapture(s,70,6,false));
    expect(s.captures).toBe(1);
  });
});

/* INDEX: 01 Reference fixtures | 02 Geometry | 03 Alignment | 04 Contours and catalog */
import test from 'node:test';import assert from 'node:assert/strict';
import {guideRect,targetPoint,oppositeIndex,evaluateAlignment,contourAlpha,BODY} from '../js/guide.js';
import {POSES,CATEGORIES} from '../js/poses.js';
/* 01 START: Reference fixtures */
const ref=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));
for(const [i,x,y]of [[0,.5,.1],[11,.62,.3],[12,.38,.3],[13,.7,.4],[14,.25,.36],[15,.75,.5],[16,.25,.15],[23,.57,.55],[24,.43,.55],[25,.58,.72],[26,.4,.72],[27,.6,.9],[28,.4,.9]])ref[i]={x,y,visibility:1};
function liveFor(r,w,h,mirror,flip){const live=Array.from({length:33},()=>({x:.5,y:.5,visibility:1}));for(const i of BODY){const t=targetPoint(ref[i],r,flip),j=mirror!==flip?oppositeIndex(i):i;live[j]={x:mirror?1-t.x/w:t.x/w,y:t.y/h,visibility:1}}return live}
/* 01 END: Fixtures */
/* 02 START: Geometry */
test('guide respects image aspect ratio',()=>{const r=guideRect(960,720,1024,1536);assert.ok(Math.abs(r.w/r.h-2/3)<1e-10);assert.ok(Math.abs(r.y-43.2)<.001)});
test('offset and scale are mapped in camera coordinates',()=>{const r=guideRect(800,600,100,200,100,10,-10);assert.deepEqual(r,{x:330,y:-60,w:300,h:600})});
test('guide flip changes target x, not y',()=>{const r={x:100,y:20,w:200,h:400};assert.deepEqual(targetPoint({x:.2,y:.3},r,true),{x:260,y:140})});
/* 02 END: Geometry */
/* 03 START: Alignment */
for(const [w,h]of [[960,720],[720,960]])for(const mirror of [true,false])for(const flip of [true,false])test(`aligned camera ${w}x${h} mirror=${mirror} flip=${flip}`,()=>{const r=guideRect(w,h,1024,1536),e=evaluateAlignment(liveFor(r,w,h,mirror,flip),ref,r,w,h,mirror,flip);assert.equal(e.score,100);assert.equal(e.matched,true)});
test('missing hand stops score and auto matching',()=>{const r=guideRect(960,720,1024,1536),p=liveFor(r,960,720,true,false);p[15].visibility=.1;assert.equal(evaluateAlignment(p,ref,r,960,720).valid,false)});
test('missing reference produces no invented score',()=>assert.equal(evaluateAlignment(ref,null,{x:0,y:0,w:1,h:1},960,720).valid,false));
test('missing person produces no score',()=>assert.equal(evaluateAlignment(null,ref,{x:0,y:0,w:1,h:1},960,720).valid,false));
test('out of frame guide prevents match',()=>{const r=guideRect(960,720,1024,1536,110,0,35);assert.equal(evaluateAlignment(liveFor(guideRect(960,720,1024,1536),960,720,true,false),ref,r,960,720).valid,false)});
test('displaced body does not match',()=>{const r=guideRect(960,720,1024,1536),p=liveFor(r,960,720,true,false).map(v=>({...v,x:v.x+.2}));assert.equal(evaluateAlignment(p,ref,r,960,720).matched,false)});
/* 03 END: Alignment */
/* 04 START: Contours and catalog */
test('contour marks boundary while leaving body interior and background empty',()=>{const w=15,h=15,p=new Uint8ClampedArray(w*h*4);for(let y=3;y<12;y++)for(let x=3;x<12;x++)p[(y*w+x)*4+3]=253;const out=contourAlpha(p,w,h,1);assert.equal(out[(3*w+5)*4+3],255);assert.equal(out[(7*w+7)*4+3],0);assert.equal(out[3],0)});
test('contour preserves gap inside silhouette',()=>{const w=9,p=new Uint8ClampedArray(w*w*4);for(let y=1;y<8;y++)for(let x=1;x<8;x++)p[(y*w+x)*4+3]=253;p[(4*w+4)*4+3]=0;const out=contourAlpha(p,w,w,1);assert.equal(out[(4*w+3)*4+3],255);assert.equal(out[(4*w+4)*4+3],0)});
test('faint alpha does not become white halo',()=>{const p=new Uint8ClampedArray(4*9);for(let i=0;i<9;i++)p[i*4+3]=50;assert.equal(contourAlpha(p,3,3).some(v=>v),false)});
test('each occasion has two distinct references',()=>{assert.equal(new Set(POSES.map(p=>p.id)).size,6);for(const c of CATEGORIES)assert.equal(POSES.filter(p=>p.category===c.id).length,2)});
/* 04 END: Contours and catalog */

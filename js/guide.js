/* INDEX: 01 Silhouette boundary | 02 Placement | 03 Mirroring | 04 Pose comparison */
/* 01 START: Extract white contour from a transparent reference image.
   Pure pixel operation used by the app, preserving holes between arms and body. */
export function contourAlpha(rgba,width,height,radius=3){
 const mask=new Uint8Array(width*height),out=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<mask.length;i++)mask[i]=rgba[i*4+3]>=180?1:0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x;if(!mask[i])continue;
  let boundary=false;
  for(let dy=-radius;dy<=radius&&!boundary;dy++)for(let dx=-radius;dx<=radius;dx++){
   if(dx*dx+dy*dy>radius*radius)continue;
   const nx=x+dx,ny=y+dy;
   if(nx<0||ny<0||nx>=width||ny>=height||!mask[ny*width+nx]){boundary=true;break}
  }
  if(boundary){out[i*4]=out[i*4+1]=out[i*4+2]=out[i*4+3]=255}
 }
 return out;
}
/* 01 END: Silhouette boundary */
/* 02 START: Placement shared by rendering and AI target coordinates */
export function guideRect(width,height,imageWidth,imageHeight,scale=88,offsetX=0,offsetY=0){
 const fit=Math.min(width/imageWidth,height/imageHeight)*scale/100;
 const w=imageWidth*fit,h=imageHeight*fit;
 return {x:(width-w)/2+offsetX*width/100,y:(height-h)/2+offsetY*height/100,w,h};
}
export function targetPoint(point,rect,flipped=false){return {x:rect.x+(flipped?1-point.x:point.x)*rect.w,y:rect.y+point.y*rect.h}}
/* 02 END: Placement */
/* 03 START: Camera reflection requires swapping anatomical left/right point indices */
export const BODY=[0,11,12,13,14,15,16,23,24,25,26,27,28];
export function oppositeIndex(i){return i===0?0:(i%2===1?i+1:i-1)}
/* 03 END: Mirroring */
/* 04 START: Compare visible body landmarks against guide in screen coordinates.
   This heuristic estimates alignment, not beauty or an AI probability. */
export function evaluateAlignment(live,reference,rect,width,height,mirrorCamera=true,flipGuide=false){
 const invalid=hint=>({valid:false,score:0,matched:false,hint});
 if(!reference?.length)return invalid('اتبعي المحيط الأبيض؛ التقييم الذكي غير متاح لهذه الوضعية');
 if(!live?.length)return invalid('ابتعدي حتى يظهر جسمك أمام الكاميرا');
 const selected=BODY.filter(i=>(reference[i]?.visibility??0)>=.5);
 if(selected.length<9||![11,12,23,24].every(i=>selected.includes(i)))return invalid('اتبعي المحيط الأبيض؛ لا تتوفر نقاط مرجعية كافية للتقييم');
 const samples=[];
 for(const i of selected){
  const sourceIndex=mirrorCamera!==flipGuide?oppositeIndex(i):i,p=live[sourceIndex];
  if(!p||(p.visibility??0)<.6||p.x<.01||p.x>.99||p.y<.01||p.y>.99)return invalid('أظهري الجسم واليدين والقدمين بوضوح داخل الكاميرا');
  const target=targetPoint(reference[i],rect,flipGuide);
  if(target.x<0||target.x>width||target.y<0||target.y>height)return invalid('صغّري الدليل أو أعيدي توسيطه ليظهر كاملًا');
  const current={x:(mirrorCamera?1-p.x:p.x)*width,y:p.y*height};
  samples.push({i,dx:target.x-current.x,dy:target.y-current.y});
 }
 const unit=Math.min(width,height),distances=samples.map(s=>Math.hypot(s.dx,s.dy)/unit);
 const mean=distances.reduce((a,b)=>a+b,0)/distances.length,worst=Math.max(...distances);
 const center=samples.filter(s=>[11,12,23,24].includes(s.i));
 const dx=center.reduce((a,s)=>a+s.dx,0)/center.length/unit,dy=center.reduce((a,s)=>a+s.dy,0)/center.length/unit;
 const matched=mean<.065&&worst<.13;
 let hint='عدّلي مواضع اليدين والقدمين لتقترب من الخط الأبيض';
 if(Math.abs(dx)>.08)hint='تحرّكي قليلًا نحو منتصف الدليل، أو اسحبيه فوق جسمك';
 else if(Math.abs(dy)>.09)hint='اضبطي ارتفاع الكاميرا أو حرّكي الدليل رأسيًا';
 else if(mean>.14)hint='اضبطي حجم الدليل ومسافتك عن الكاميرا ثم اتبعي الشكل';
 else if(matched)hint='قريبة من الوضعية المطلوبة — اثبتي للحظة';
 return {valid:true,score:Math.round(Math.max(0,100-mean*300)),matched,hint,mean,worst,pointsUsed:selected.length};
}
/* 04 END: Pose comparison */

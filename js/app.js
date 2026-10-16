/* INDEX: 01 State | 02 Reference assets | 03 Catalog | 04 Guide controls
   05 Camera | 06 Optional AI | 07 Capture | 08 Events */
/* 01 START: State */
import {CATEGORIES,POSES} from './poses.js';
import {contourAlpha,guideRect,evaluateAlignment} from './guide.js';
const $=id=>document.getElementById(id),video=$('video'),canvas=$('guideCanvas'),ctx=canvas.getContext('2d');
let pose=POSES[0],category=CATEGORIES[0].id,asset=null,selectionToken=0;
let running=false,starting=false,session=0,stream=null,mirrorCamera=true,raf=0;
let guide={scale:88,x:0,y:0,flip:false},drag=null;
let model=null,modelPromise=null,referenceBusy=false,referenceDirty=true,referencePoints=null;
let lastFrame=-1,lastAnalysis=0,lastHint=0,matchedSince=null,autoLocked=false;
let photoURL=null,timerEnd=null,timerId=null;
const assets=new Map(),references=new Map();
function error(message=''){$('error').textContent=message;$('error').hidden=!message}
function hint(message){$('hint').textContent=message}
function status(message){$('cameraState').textContent=message}
function resetMatch(){matchedSince=null;$('score').textContent='—';$('progress').value=0;if(!timerEnd)$('countdown').hidden=true}
/* 01 END: State */
/* 02 START: Reference images and their real pixel contours */
function loadAsset(p){
 if(assets.has(p.id))return assets.get(p.id);
 const job=new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>{
   try{
    const outline=document.createElement('canvas');outline.width=512;outline.height=Math.round(512*img.naturalHeight/img.naturalWidth);
    const c=outline.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0,outline.width,outline.height);
    const pixels=c.getImageData(0,0,outline.width,outline.height);
    pixels.data.set(contourAlpha(pixels.data,outline.width,outline.height,3));c.putImageData(pixels,0,0);
    resolve({img,outline,width:img.naturalWidth,height:img.naturalHeight});
   }catch(e){reject(e)}
  };img.onerror=()=>reject(new Error('reference image missing'));img.src=p.image;
 });assets.set(p.id,job);job.catch(()=>assets.delete(p.id));return job;
}
/* 02 END: Reference images */
/* 03 START: Occasion and pose selection */
function renderCategories(){
 $('categories').replaceChildren();for(const c of CATEGORIES){
  const b=document.createElement('button');b.textContent=c.title;b.className=c.id===category?'selected':'';b.setAttribute('aria-pressed',String(c.id===category));
  b.onclick=()=>{category=c.id;renderCategories();renderPoses();selectPose(POSES.find(p=>p.category===category))};$('categories').append(b);
 }
}
function renderPoses(){
 $('poseList').replaceChildren();for(const p of POSES.filter(p=>p.category===category)){
  const b=document.createElement('button');b.className='pose-card';b.dataset.pose=p.id;b.innerHTML=`<img src="${p.image}" alt=""><strong>${p.title}</strong>`;b.onclick=()=>selectPose(p);$('poseList').append(b);
 }
}
async function selectPose(p){
 const token=++selectionToken;pose=p;asset=null;referencePoints=null;referenceDirty=true;autoLocked=false;cancelTimer();resetGuide();resetMatch();error();
 document.querySelectorAll('.pose-card').forEach(b=>{const selected=b.dataset.pose===p.id;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected))});
 $('referenceImage').src=p.image;$('referenceImage').alt=p.description;$('poseTitle').textContent=p.title;$('poseDescription').textContent=p.description;
 hint('جارٍ تجهيز دليل الوضعية…');drawGuide();
 try{const loaded=await loadAsset(p);if(token!==selectionToken)return;asset=loaded;drawGuide();hint(running?'قفي داخل الخط الأبيض، واضبطي حجمه ومكانه عند الحاجة':'شغّلي الكاميرا لإظهار محيط الوضعية المختارة')}
 catch(e){if(token===selectionToken)error('تعذّر تحميل صورة الوضعية. تأكدي من وجود مجلد assets كاملًا.');console.error(e)}
}
renderCategories();renderPoses();selectPose(pose);
/* 03 END: Catalog */
/* 04 START: Guide controls. A fixed target, not a contour following the user. */
function getRect(){return guideRect(canvas.width,canvas.height,asset.width,asset.height,guide.scale,guide.x,guide.y)}
function drawGuide(){
 ctx.clearRect(0,0,canvas.width,canvas.height);if(!running||!asset||!$('showGuide').checked)return;
 const r=getRect();ctx.save();ctx.globalAlpha=Number($('guideOpacity').value)/100;ctx.shadowColor='#0009';ctx.shadowBlur=3;
 ctx.translate(r.x+(guide.flip?r.w:0),r.y);ctx.scale(guide.flip?-1:1,1);ctx.drawImage(asset.outline,0,0,r.w,r.h);ctx.restore();
}
function resetGuide(){guide={scale:88,x:0,y:0,flip:false};$('guideScale').value=88;$('scaleValue').value='88٪';$('guideX').value=0;$('guideY').value=0;$('flipGuide').setAttribute('aria-pressed','false');resetMatch();drawGuide()}
function guideChanged(){cancelTimer();resetMatch();autoLocked=false;drawGuide()}
canvas.addEventListener('pointerdown',e=>{if(!running||!asset||!$('showGuide').checked)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,gx:guide.x,gy:guide.y};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const r=canvas.getBoundingClientRect();guide.x=Math.max(-35,Math.min(35,drag.gx+(e.clientX-drag.x)/r.width*100));guide.y=Math.max(-35,Math.min(35,drag.gy+(e.clientY-drag.y)/r.height*100));$('guideX').value=guide.x;$('guideY').value=guide.y;guideChanged()});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
/* 04 END: Guide controls */
/* 05 START: Camera lifecycle; the visual guide works independently of AI. */
async function start(){
 if(running||starting)return;error();
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){error('شغّلي المشروع عبر localhost أو HTTPS. استخدمي Go Live في VS Code بدل فتح الملف مباشرة.');return}
 const token=++session;starting=true;$('start').disabled=true;$('stop').disabled=false;$('cameraSelect').disabled=true;status('جارٍ فتح الكاميرا…');
 try{
  const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:$('cameraSelect').value},width:{ideal:960},height:{ideal:720}}});
  if(token!==session){acquired.getTracks().forEach(t=>t.stop());return}
  stream=acquired;video.srcObject=stream;await video.play();if(token!==session)return;
  const facing=stream.getVideoTracks()[0].getSettings().facingMode;
  mirrorCamera=(facing||$('cameraSelect').value)==='user';video.classList.toggle('mirrored',mirrorCamera);
  running=true;starting=false;canvas.width=video.videoWidth;canvas.height=video.videoHeight;$('stage').style.aspectRatio=`${canvas.width}/${canvas.height}`;
  $('stage').classList.add('running');$('placeholder').hidden=true;$('capture').disabled=false;$('cameraSelect').disabled=false;$('liveDot').classList.add('active');
  status(mirrorCamera?'الكاميرا تعمل · كالمِرآة':'الكاميرا تعمل');hint('قفي داخل الخط الأبيض، أو حرّكي الدليل ليلائم مكانك');
  lastFrame=-1;lastAnalysis=0;autoLocked=false;resetMatch();drawGuide();
  stream.getVideoTracks()[0].addEventListener('ended',()=>{if(running||starting){stop();error('توقفت الكاميرا. أعيدي تشغيلها.')}});
  raf=requestAnimationFrame(frame);if($('aiAssist').checked)enableAI();
 }catch(e){if(token!==session)return;stop();const messages={NotAllowedError:'اسمحي باستخدام الكاميرا من إعدادات المتصفح ثم حاولي مجددًا.',NotFoundError:'لم نعثر على كاميرا متاحة.',NotReadableError:'الكاميرا مشغولة. أغلقي التطبيق الذي يستخدمها ثم أعيدي المحاولة.'};error(messages[e.name]||'تعذّر تشغيل الكاميرا. أعيدي المحاولة عبر خادم محلي أو HTTPS.');console.error(e)}
}
function stop(){
 ++session;running=false;starting=false;cancelAnimationFrame(raf);cancelTimer();drag=null;
 if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;
 ctx.clearRect(0,0,canvas.width,canvas.height);$('stage').classList.remove('running');$('placeholder').hidden=false;
 $('start').disabled=false;$('stop').disabled=true;$('capture').disabled=true;$('cameraSelect').disabled=false;$('liveDot').classList.remove('active');
 status('الكاميرا متوقفة');resetMatch();hint('شغّلي الكاميرا لإظهار الدليل');
}
function frame(now){
 if(!running)return;
 try{
  if(video.videoWidth&&video.videoHeight&&(canvas.width!==video.videoWidth||canvas.height!==video.videoHeight)){
   canvas.width=video.videoWidth;canvas.height=video.videoHeight;$('stage').style.aspectRatio=`${canvas.width}/${canvas.height}`;resetMatch();drawGuide();
  }
  if($('aiAssist').checked&&model&&asset&&!referenceBusy){
   if(referenceDirty)prepareReference();
   else if(video.readyState>=2&&video.currentTime!==lastFrame&&now-lastAnalysis>=120){
    lastFrame=video.currentTime;lastAnalysis=now;
    const result=model.detectForVideo(video,now);
    const evaluation=evaluateAlignment(result.landmarks[0],referencePoints,getRect(),canvas.width,canvas.height,mirrorCamera,guide.flip);
    $('score').textContent=evaluation.valid?`${evaluation.score}٪`:'—';$('progress').value=evaluation.score;
    if(now-lastHint>600){hint(evaluation.hint);lastHint=now}
    updateAutoCapture(evaluation,now);
   }
  }
 }catch(e){console.error(e);$('aiAssist').checked=false;$('matchPanel').hidden=true;$('autoCapture').checked=false;resetMatch();$('aiState').textContent='تعذّر التحليل؛ الدليل البصري متاح';hint('اتبعي المحيط الأبيض والتقطي الصورة يدويًا')}
 raf=requestAnimationFrame(frame);
}
/* 05 END: Camera lifecycle */
/* 06 START: Optional local MediaPipe analysis, including reference extraction. */
async function loadModel(){
 if(model)return model;
 if(!modelPromise)modelPromise=(async()=>{
  const {FilesetResolver,PoseLandmarker}=await import('../vendor/vision_bundle.mjs');
  const files=await FilesetResolver.forVisionTasks(new URL('../vendor/wasm/',import.meta.url).href);
  const options={baseOptions:{modelAssetPath:new URL('../models/pose_landmarker_lite.task',import.meta.url).href,delegate:'GPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.6};
  try{return await PoseLandmarker.createFromOptions(files,options)}catch{options.baseOptions.delegate='CPU';return await PoseLandmarker.createFromOptions(files,options)}
 })().then(m=>model=m).catch(e=>{modelPromise=null;throw e});
 return modelPromise;
}
async function enableAI(){
 $('matchPanel').hidden=!$('aiAssist').checked;resetMatch();autoLocked=false;
 if(!$('aiAssist').checked){$('autoCapture').checked=false;$('aiState').textContent='اختياري · تحليل على جهازك';hint(running?'اتبعي الخط الأبيض ثم التقطي الصورة':'شغّلي الكاميرا للبدء');return}
 $('aiState').textContent='جارٍ تحميل نموذج الجسم…';
 try{await loadModel();if(!$('aiAssist').checked)return;referenceDirty=true;$('aiState').textContent='تحليل محلي · تقديري'}catch(e){console.error(e);$('aiAssist').checked=false;$('matchPanel').hidden=true;$('aiState').textContent='تعذّر التحليل؛ الدليل البصري متاح';error('تعذّر تشغيل المساعدة الذكية. يمكنك استخدام الخط الأبيض والتقاط الصور كالمعتاد.')}
}
async function prepareReference(){
 if(referenceBusy||!model||!asset)return;
 const id=pose.id,token=selectionToken,current=asset;referenceBusy=true;referenceDirty=false;resetMatch();
 try{
  if(!references.has(id)){
   const photo=document.createElement('canvas');photo.width=512;photo.height=Math.round(512*current.height/current.width);
   const c=photo.getContext('2d');c.fillStyle='#f1f1e9';c.fillRect(0,0,photo.width,photo.height);c.drawImage(current.img,0,0,photo.width,photo.height);
   await model.setOptions({runningMode:'IMAGE'});const result=model.detect(photo);
   references.set(id,result.landmarks[0]||null);
  }
  if(token===selectionToken)referencePoints=references.get(id);
 }catch(e){console.error(e);if(token===selectionToken)referencePoints=null}
 finally{try{await model.setOptions({runningMode:'VIDEO'})}catch(e){console.error(e);$('aiAssist').checked=false;$('matchPanel').hidden=true;$('aiState').textContent='الدليل البصري متاح بدون التحليل'}referenceBusy=false;if(token!==selectionToken)referenceDirty=true;lastFrame=-1;}
}
function updateAutoCapture(e,now){
 if(timerEnd)return;
 if(e.matched){
  if(matchedSince===null)matchedSince=now;
  if($('autoCapture').checked&&!autoLocked){const elapsed=now-matchedSince;$('countdown').hidden=false;$('countdown').textContent=Math.max(1,3-Math.floor(elapsed/1000));if(elapsed>=3000){takePhoto();autoLocked=true;$('countdown').hidden=true;hint('تم التقاط الصورة. غيّري وقفتك لإعادة الالتقاط.')}}
 }else{matchedSince=null;$('countdown').hidden=true;if(!e.valid||e.score<65)autoLocked=false}
}
/* 06 END: Optional AI */
/* 07 START: Manual timer, photo capture and cleanup */
function cancelTimer(){clearTimeout(timerId);timerId=null;timerEnd=null;$('countdown').hidden=true;$('capture').textContent='التقاط الصورة'}
function capture(){
 if(!running)return;if(timerEnd){cancelTimer();return}
 const seconds=Number($('timer').value);if(!seconds){takePhoto();return}
 timerEnd=performance.now()+seconds*1000;$('capture').textContent='إلغاء المؤقت';resetMatch();
 const tick=()=>{if(!running||!timerEnd)return;const left=Math.ceil((timerEnd-performance.now())/1000);if(left<=0){cancelTimer();takePhoto();return}$('countdown').hidden=false;$('countdown').textContent=left;timerId=setTimeout(tick,100)};tick();
}
function takePhoto(){
 if(!running||video.readyState<2)return;autoLocked=true;matchedSince=null;$('countdown').hidden=true;
 const shot=document.createElement('canvas');shot.width=video.videoWidth;shot.height=video.videoHeight;const c=shot.getContext('2d');
 if(mirrorCamera){c.translate(shot.width,0);c.scale(-1,1)}c.drawImage(video,0,0);const capturedSession=session;
 shot.toBlob(blob=>{if(capturedSession!==session)return;if(!blob){error('تعذّر إنشاء الصورة. حاولي مرة أخرى.');return}if(photoURL)URL.revokeObjectURL(photoURL);photoURL=URL.createObjectURL(blob);$('photo').src=photoURL;$('download').href=photoURL;$('download').download=`waqfa-${pose.id}-${Date.now()}.jpg`;$('photoPanel').hidden=false;hint('تم التقاط صورتك بدون الخطوط — زر التنزيل أسفل الصفحة')},'image/jpeg',.94);
}
function deletePhoto(){if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;$('photo').removeAttribute('src');$('download').removeAttribute('href');$('photoPanel').hidden=true}
/* 07 END: Capture */
/* 08 START: Events */
$('start').onclick=start;$('stop').onclick=stop;$('capture').onclick=capture;$('deletePhoto').onclick=deletePhoto;
$('aiAssist').onchange=enableAI;$('autoCapture').onchange=()=>{cancelTimer();resetMatch();autoLocked=false};
$('cameraSelect').onchange=()=>{if(running||starting){stop();start()}};
$('guideScale').oninput=()=>{guide.scale=Number($('guideScale').value);$('scaleValue').value=`${guide.scale}٪`;guideChanged()};
$('guideOpacity').oninput=()=>{$('opacityValue').value=`${$('guideOpacity').value}٪`;drawGuide()};
$('guideX').oninput=()=>{guide.x=Number($('guideX').value);guideChanged()};$('guideY').oninput=()=>{guide.y=Number($('guideY').value);guideChanged()};
$('showGuide').onchange=drawGuide;$('flipGuide').onclick=()=>{guide.flip=!guide.flip;$('flipGuide').setAttribute('aria-pressed',String(guide.flip));guideChanged()};$('resetGuide').onclick=()=>{cancelTimer();resetGuide();autoLocked=false};
$('helpButton').onclick=()=>{$('help').hidden=!$('help').hidden;$('helpButton').setAttribute('aria-expanded',String(!$('help').hidden))};
window.addEventListener('pagehide',()=>{stop();deletePhoto()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||starting))stop()});
/* 08 END: Events */

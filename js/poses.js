/* INDEX: 01 Occasion catalog | 02 Pose catalog */
/* 01 START: Occasion catalog. User-selected categories, not automatic scene recognition. */
export const CATEGORIES=[{id:'graduation',title:'التخرّج'},{id:'travel',title:'السفر'},{id:'daily',title:'يومي'}];
/* 01 END: Occasion catalog */
/* 02 START: Pose catalog. Each image also supplies the white silhouette contour. */
export const POSES=[
 {id:'grad-cap',category:'graduation',title:'لحظة الإنجاز',description:'المسي حافة القبعة بيد، واتركي اليد الأخرى بجانبك. اتبعي جهة الذراع في الخط الأبيض.'},
 {id:'grad-joy',category:'graduation',title:'فرحة التخرّج',description:'ارفعي ذراعًا للأعلى، واثني الأخرى، مع رفع القدم المقابلة قليلًا. اختاري وقفة مريحة ومتوازنة.'},
 {id:'travel-wave',category:'travel',title:'تحية من الرحلة',description:'ارفعي كفك بجانب الوجه للتحية، وقدّمي إحدى القدمين قليلًا.'},
 {id:'travel-hat',category:'travel',title:'تحت الشمس',description:'قرّبي اليدين من جانبي القبعة، وافتحي المرفقين، مع تقاطع خفيف للقدمين.'},
 {id:'daily-hip',category:'daily',title:'وقفة عفوية',description:'ضعي يدًا على الخصر، واتركي الأخرى لأسفل مع نقل الوزن إلى قدم واحدة.'},
 {id:'daily-arms',category:'daily',title:'بكل ثقة',description:'اطوي الذراعين براحة أمام الصدر، وقفي باستقامة مع تباعد بسيط للقدمين.'}
].map(p=>({...p,image:`assets/${p.id}.webp`}));
/* 02 END: Pose catalog */

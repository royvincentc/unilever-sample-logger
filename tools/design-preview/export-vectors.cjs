const fs=require('node:fs');const p=require('node:path');
const shapes={
envi:'<path d="M106 48h28M110 49v35l-22 36a9 9 0 008 14h48a9 9 0 008-14l-22-36V49"/><path d="M102 108c10-8 26 8 36 0M98 119h43"/><circle cx="117" cy="97" r="3"/><circle cx="129" cy="118" r="2"/>',
water:'<path d="M120 48C112 65 94 83 94 100a26 26 0 0052 0c0-17-18-35-26-52zM104 103c0 9 6 15 15 15"/>',
rawmats:'<path d="M88 74l32-18 32 18v40l-32 18-32-18V74zm0 0l32 18 32-18m-32 18v40m-17-67l33 18"/>',
air:'<path d="M84 80h56c22 0 20-28 3-24-5 1-8 5-8 9M78 94h78M87 108h43c22 0 20 28 3 24-5-1-8-5-8-9"/>',
offline:'<path d="M91 107h60c20 0 24-29 4-35-4-30-46-31-53-4-29-6-35 36-11 39zM109 117v17h22v-17m-11 0V90m-9 9l9-9 9 9"/>',
sync:'<path d="M151 78a34 34 0 00-57-13l-10 11m0 0V55m0 21h21M89 102a34 34 0 0057 13l10-11m0 0v21m0-21h-21"/>',
success:'<circle cx="120" cy="90" r="34"/><path d="M103 91l12 12 24-25"/>',
molecule:'<path d="M40 105L82 52L140 68L194 40M82 52L103 127L171 139L140 68M103 127L40 105M171 139L211 102L140 68"/>'+[[40,105],[82,52],[140,68],[194,40],[103,127],[171,139],[211,102]].map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="8" fill="#ffffff"/>').join('')
};shapes.empty=shapes.envi;shapes.incubation=shapes.envi+'<circle cx="157" cy="63" r="18" fill="#ffffff"/><path d="M157 51v12l8 5"/>';
for(const [kind,shape] of Object.entries(shapes)){fs.writeFileSync(p.join('design/vectors',kind+'.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none" color="#087f8c" role="img" aria-labelledby="title"><title id="title">'+kind+' scientific illustration</title><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="120" cy="90" r="74" opacity=".12" stroke-dasharray="3 8"/><circle cx="120" cy="90" r="52" opacity=".09"/><g stroke-width="3">'+shape+'</g><path d="M22 32h8m-4-4v8M204 144h8m-4-4v8" opacity=".3" stroke-width="2"/></g></svg>');}

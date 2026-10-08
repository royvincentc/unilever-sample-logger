const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('src/design/precision-lab.css','utf8');
const tokenMap=section=>Object.fromEntries([...section.matchAll(/(--[a-z-]+):\s*(#[a-f0-9]{3,6})/g)].map(m=>[m[1],m[2]]));
const light=tokenMap(source.slice(source.indexOf(':root {'),source.indexOf('[data-theme=')));
const dark=tokenMap(source.split('[data-theme="dark"] {')[1].split('}')[0]);
const pairs=['primary','secondary','muted'].flatMap(name=>['app','card'].map(surface=>['text '+name+' / '+surface,'--text-'+name,'--bg-'+surface]));
pairs.push(['blue status','--lab-blue','--lab-blue-soft'],['teal status','--lab-teal','--lab-teal-soft'],['amber status','--lab-amber','--lab-amber-soft']);
function luminance(h){let hex=h.slice(1);if(hex.length===3)hex=hex.split('').map(c=>c+c).join('');const [r,g,b]=hex.match(/../g).map(c=>parseInt(c,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b;}
const output=[];for(const [theme,palette]of Object.entries({light,dark})){for(const [name,a,b]of pairs){const contrast=(Math.max(luminance(palette[a]),luminance(palette[b]))+.05)/(Math.min(luminance(palette[a]),luminance(palette[b]))+.05);output.push({theme,name,contrast:+contrast.toFixed(2),pass:contrast>=4.5});}}
fs.writeFileSync('design/validation/contrast.json',JSON.stringify(output,null,2));assert(output.every(result=>result.pass));console.log(output.length+' shared text/status contrast pairs pass 4.5:1');

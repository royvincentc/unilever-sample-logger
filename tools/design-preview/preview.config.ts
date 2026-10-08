import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { resolve } from 'node:path';
const root=process.cwd();
const fixtures=resolve(root,'tools/design-preview/fixtures.ts');
export default defineConfig({
  plugins:[react(),tailwind(),{
    name:'synthetic-preview-api',
    configureServer(server){
      server.middlewares.use((req,_res,next)=>{if(req.headers.accept?.includes('text/html') && !req.url?.startsWith('/api'))req.url='/tools/design-preview/index.html';next();});
      server.middlewares.use('/api',(req,res)=>{res.setHeader('Content-Type','application/json');if(req.url?.includes('sheet-data')){res.end(JSON.stringify([{'CONTROL #':'E26-001',SAMPLE:'Surface swab A',STATUS:'ONGOING','DATE SAMPLED':'2026-10-06','DATE ANALYZED':'2026-10-06','ANALYZED BY':'Demo analyst',_rowIndex:2}]));}else {res.end(JSON.stringify({success:true,controlNumber:'DEMO-101'}));}});
    },
  }],
  resolve:{alias:[
    {find:/.*\/utils\/(api|auth|firebase)$/,replacement:fixtures},
    {find:/^\.\/(api|auth|firebase)$/,replacement:fixtures},
    {find:'firebase/firestore',replacement:fixtures},{find:'firebase/auth',replacement:fixtures},
  ]},
  server:{host:'127.0.0.1',port:5190,strictPort:true},
});

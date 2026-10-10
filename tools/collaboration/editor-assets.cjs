const fs=require('node:fs');
fs.mkdirSync('public/excalidraw',{recursive:true});
fs.cpSync('node_modules/@excalidraw/excalidraw/dist/prod/fonts','public/excalidraw/fonts',{recursive:true});
console.log('Prepared local official Excalidraw fonts.');

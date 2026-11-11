import { defineConfig } from 'vite';
export default defineConfig({
  base:'./',
  plugins:[{
    name:'shixu-theme-first-paint',
    transformIndexHtml:{order:'post',handler:html=>html.replace('<title>',
      '<script src="./theme-init.js"></script><link rel="stylesheet" href="./theme-init.css"/><title>')},
  }],
  server:{host:'127.0.0.1',port:5173,strictPort:true},
  build:{target:'es2022'},
});

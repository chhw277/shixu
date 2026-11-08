import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests',
  testMatch:'*.spec.js',
  timeout:45000,
  expect:{timeout:7000},
  fullyParallel:false,
  workers:1,
  reporter:[['list']],
  outputDir:'artifacts/playwright',
  use:{
    baseURL:'http://127.0.0.1:5173',
    viewport:{width:1380,height:880},
    timezoneId:'Asia/Shanghai',
    locale:'zh-CN',
    acceptDownloads:true,
    screenshot:'only-on-failure',
    trace:'retain-on-failure',
    launchOptions:process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{channel:'chrome'},
  },
  webServer:{command:'npm run dev -- --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:true,timeout:30000},
});

const { chromium } = require('@playwright/test');
const path = require('node:path');
(async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();
    for(const [file,size,scale] of [['app-icon-192.png',192,.54],['app-icon-512.png',512,.54],['app-icon-maskable.png',512,.43]]) {
      await page.setViewportSize({width:size,height:size});
      await page.setContent(`<html><body style="margin:0;background:#171b1c;display:grid;place-items:center;width:100vw;height:100vh"><div style="font:bold italic ${size*scale}px Arial,sans-serif;line-height:1;color:white">E<span style="color:#d6443b">.</span></div></body></html>`);
      await page.screenshot({path:path.join(__dirname,'..','images',file)});
    }
    console.log('Generated desktop and iPad app icons.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

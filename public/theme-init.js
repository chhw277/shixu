/* Blocking same-origin script: theme is resolved before the first CSS/content paint. */
(()=>{
  try {
    const state=JSON.parse(localStorage.getItem('shixu-state-v1')||'null');
    const cache=JSON.parse(localStorage.getItem('shixu-theme-v1')||'null');
    const settings=state?.settings||cache||{theme:'light'};
    const theme=['light','dark','system'].includes(settings.theme)?settings.theme:'light';
    document.documentElement.dataset.theme=theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme;
    const colors={blue:'#3e63dd',green:'#267d6b',violet:'#7255c5',amber:'#a56b1d',rose:'#bd4b69'};
    const accent=colors[settings.accent]||(/^#[\da-f]{6}$/i.test(settings.accent||'')?settings.accent:null);
    if(accent)document.documentElement.style.setProperty('--accent',accent);
  }catch{document.documentElement.dataset.theme='light';}
})();

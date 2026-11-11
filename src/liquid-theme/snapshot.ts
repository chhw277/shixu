let serial = 0;
export interface Snapshot { layer: HTMLDivElement; dispose(): void }
/** DOM/CSS/SVG only. Unsupported live raster/shadow content deliberately uses direct switching. */
export function createSnapshot(root: HTMLElement, target: string): Snapshot | null {
  const originals = [root, ...root.querySelectorAll<HTMLElement>('*')];
  if (originals.some(el => el.shadowRoot || /^(CANVAS|VIDEO|IFRAME|OBJECT|EMBED)$/.test(el.tagName))) return null;
  const copy = root.cloneNode(true) as HTMLElement;
  const copies = [copy, ...copy.querySelectorAll<HTMLElement>('*')];
  const prefix = `liquid-copy-${++serial}-`, ids = new Map<string,string>();
  const scrolls: Array<[HTMLElement,number,number]> = [];
  originals.forEach((source,i)=>{
    const dest=copies[i];
    if(source.id)ids.set(source.id,prefix+source.id);
    if(source.scrollTop||source.scrollLeft)scrolls.push([dest,source.scrollTop,source.scrollLeft]);
    if(source instanceof HTMLInputElement && dest instanceof HTMLInputElement){
      // Password values never leave the live control.
      dest.value=source.type==='password'?'':source.value;dest.checked=source.checked;dest.indeterminate=source.indeterminate;
    }else if(source instanceof HTMLTextAreaElement && dest instanceof HTMLTextAreaElement)dest.value=source.value;
    else if(source instanceof HTMLSelectElement && dest instanceof HTMLSelectElement)dest.selectedIndex=source.selectedIndex;
    if(source instanceof HTMLDetailsElement && dest instanceof HTMLDetailsElement)dest.open=source.open;
  });
  copies.forEach(el=>{
    for(const attr of [...el.attributes]){
      if(/^on/i.test(attr.name)||['autofocus','accesskey'].includes(attr.name)){el.removeAttribute(attr.name);continue;}
      if(attr.name==='id'){el.id=ids.get(attr.value)!;continue;}
      if(attr.name==='name'){el.setAttribute('name',prefix+attr.value);continue;}
      let value=attr.value.replace(/url\(["']?#([^\s)"']+)["']?\)/g,(match,id)=>ids.has(id)?`url(#${ids.get(id)})`:match);
      if(['for','aria-labelledby','aria-describedby','aria-controls','aria-owns','headers','list','form'].includes(attr.name))value=value.split(' ').map(id=>ids.get(id)||id).join(' ');
      if(['href','xlink:href'].includes(attr.name)&&value.startsWith('#'))value='#'+(ids.get(value.slice(1))||value.slice(1));
      if(value!==attr.value)el.setAttribute(attr.name,value);
    }
    if(el.matches('button,input,select,textarea,a,[tabindex],[contenteditable]'))el.tabIndex=-1;
    if(el.hasAttribute('contenteditable'))el.setAttribute('contenteditable','false');
    if(el.hasAttribute('aria-live'))el.setAttribute('aria-live','off');
  });
  copy.classList.add('liquid-root');
  const layer=document.createElement('div');
  layer.className='liquid-reveal';layer.dataset.liquidTheme=target;
  layer.setAttribute('aria-hidden','true');layer.inert=true;
  layer.style.setProperty('--accent',getComputedStyle(document.documentElement).getPropertyValue('--accent'));
  layer.append(copy);document.body.append(layer);
  scrolls.forEach(([el,top,left])=>{el.scrollTop=top;el.scrollLeft=left;});
  return {layer,dispose:()=>layer.remove()};
}

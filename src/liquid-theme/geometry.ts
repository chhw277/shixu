import type { LiquidPhase } from './types';
export const IMPACT = 0.23;
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const f = (n: number) => n.toFixed(2);
export function phaseAt(p: number): LiquidPhase {
  return p >= 1 ? 'complete' : p < IMPACT ? 'pour' : p < 0.34 ? 'impact' : 'rise';
}
const drop = (x: number, y: number, rx: number, ry: number) =>
  `M${f(x)} ${f(y-ry)}a${f(rx)} ${f(ry)} 0 1 1 0 ${f(ry*2)}a${f(rx)} ${f(ry)} 0 1 1 0 ${f(-ry*2)}Z`;
/** A union of closed subpaths in viewport pixels. No React or DOM work. */
export function liquidPath(progress: number, w: number, h: number, originX: number, originY: number): string {
  const p = clamp(progress), x = clamp(originX, 6, w-6), y = clamp(originY, 0, h-2);
  if (p >= 1) return `M0 0H${w}V${h}H0Z`;
  const rise = smooth((p-IMPACT)/(1-IMPACT));
  const surface = h - (h+38)*rise;
  const amplitude = (5+Math.sin(p*Math.PI)*10)*(1-smooth((p-.87)/.13));
  const wave = (px: number) => surface + amplitude*(Math.sin(px/w*12+p*23)*.65+Math.sin(px/w*23-p*17)*.35)
    - Math.cos((px-x)*.08)*Math.exp(-Math.abs(px-x)/100)*Math.sin(clamp((p-IMPACT)/.15)*Math.PI)*20;
  const paths: string[] = [];
  if (p >= IMPACT) {
    const spread = smooth((p-IMPACT)/.22)*(w+80);
    const left = Math.max(-20,x-spread), right = Math.min(w+20,x+spread);
    paths.push(`M${f(left)} ${h+20}L${f(left)} ${f(wave(left))}`);
    const segments = Math.max(2, Math.ceil((right-left)/18));
    for (let i=1;i<=segments;i++) { const px=left+(right-left)*i/segments; paths.push(`L${f(px)} ${f(wave(px))}`); }
    paths.push(`L${f(right)} ${h+20}Z`);
  }
  // Slender, varying ribbon. The tip separates into falling drops before impact.
  const tip = p < IMPACT ? y+(h-y)*Math.pow(clamp(p/IMPACT),1.6) : Math.max(y,wave(x)+8);
  const taper = 1-smooth((p-.75)/.17);
  if (taper>0 && tip>y) {
    const steps = Math.max(2, Math.ceil((tip-y)/16));
    const center=(t: number)=> x+Math.sin(t*12-p*29)*7*Math.sin(t*Math.PI)+Math.sin(t*25+p*17)*2;
    const radius=(t: number)=> (3.1+1.5*Math.sin(t*17-p*21)+2.2*t)*taper*smooth(p/.035);
    // All closed contours use the same winding, so nonzero clipping unions overlaps.
    paths.push(`M${f(center(0)+radius(0))} ${f(y)}`);
    for(let i=1;i<=steps;i++){const t=i/steps;paths.push(`L${f(center(t)+radius(t))} ${f(y+(tip-y)*t)}`);}
    for(let i=steps;i>=0;i--){const t=i/steps;paths.push(`L${f(center(t)-radius(t))} ${f(y+(tip-y)*t)}`);}
    paths.push('Z');
    if(p>.035&&p<IMPACT) for(let i=0;i<3;i++){
      const dy=tip+16+i*23, size=(3-i*.55)*smooth(p/.06);
      if(dy<h-2)paths.push(drop(x+Math.sin(p*26+i*3)*9,dy,size,size*1.7));
    }
  }
  // Ballistic splash petals and detached droplets; renewed gently at the rising surface.
  if(p>=IMPACT&&p<.88){
    const burst=smooth((p-IMPACT)/.025)*(1-smooth((p-.32)/.17));
    const energy=burst*1.0+(p>.4?.28*(1-smooth((p-.75)/.13)):0);
    for(let i=0;i<7;i++){
      const side=i%2?-1:1, t=(p-IMPACT)*5+i*.29;
      const reach=(20+i*9)*energy, height=(25+i%3*20)*energy;
      const base=wave(x);
      if(energy>.001){
        const a=`${f(x+side*3)} ${f(base+5)}`,b=`${f(x+side*reach)} ${f(base-height*.55)}`,c=`${f(x+side*7)} ${f(base+7)}`;
        const outer=`${f(x+side*reach*.45)} ${f(base-height*1.5)}`,inner=`${f(x+side*reach*.6)} ${f(base-height*.9)}`;
        paths.push(side>0?`M${a}Q${outer} ${b}Q${inner} ${c}Z`:`M${c}Q${inner} ${b}Q${outer} ${a}Z`);
      }
      const flight=(t%1), dx=side*(12+i*12)*flight;
      if(energy>.01)paths.push(drop(x+dx,base-Math.sin(flight*Math.PI)*(30+i*7)*energy,1.6+energy,2.8+energy));
    }
  }
  return paths.join('') || 'M0 0Z';
}

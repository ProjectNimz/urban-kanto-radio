import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../radio-player.js',import.meta.url),'utf8');
export function fixture(ios=false,{stream='https://stream.example.test/live.mp3',saved=null,blocked=false}={}){
 let now=1000,id=0;const timers=new Map(),events=new Map(),windowEvents=new Map(),controls=new Map(),store=new Map(saved===null?[]:[['ukr-volume',saved]]);
 const audio={paused:true,currentTime:0,currentSrc:'',error:null,networkState:0,volume:1,muted:false,loads:0,plays:0,rejections:[],
 addEventListener(name,fn){events.set(name,fn)},pause(){this.paused=true},removeAttribute(name){if(name==='src')this.src=''},
 load(){this.loads++;this.error=null;this.currentSrc=this.src;this.currentTime=0},play(){this.plays++;this.paused=false;return {catch:fn=>this.rejections.push(fn)}}};
 function element(key){if(!controls.has(key))controls.set(key,{value:'70',dataset:{},style:{},events:{},classList:{toggle(){}},setAttribute(n,v){this[n]=v},addEventListener(n,f){this.events[n]=f},focus(){}});return controls.get(key)}
 const context=vm.createContext({Audio:function(){return audio},URL,URLSearchParams,location:{href:'https://ukr.example.test/'},
 navigator:{userAgent:ios?'iPhone':'Chrome',onLine:true},
 document:{body:element('body'),visibilityState:'visible',getElementById:element,querySelectorAll:()=>[],addEventListener(){}},
 window:{UKR_CONFIG:{streamUrl:stream,nowPlayingUrl:''},addEventListener:(n,f)=>windowEvents.set(n,f)},
 localStorage:{getItem(k){if(blocked)throw Error('blocked');return store.get(k)??null},setItem(k,v){if(blocked)throw Error('blocked');store.set(k,v)}},
 HTMLMediaElement:{NETWORK_NO_SOURCE:3},Date:class extends Date{static now(){return now}},Math,
 setTimeout(fn,delay){timers.set(++id,{fn,at:now+delay});return id},clearTimeout(k){timers.delete(k)},setInterval(){return 999},clearInterval(){}});
 vm.runInContext(source,context);
 return {audio,controls,context,events,windowEvents,run:code=>vm.runInContext(code,context),advance(ms){const end=now+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn()}now=end}};
}

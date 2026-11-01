import {AudioEngine} from '../../js/audio.js';
export const HYBRID_AUDIO_KEY='riftclimb.experiment.hybrid.audio.v1';
export class HybridAudio extends AudioEngine {
  constructor(options){super(options);this.lastEffects=new Map();this.settings={music:.55,sfx:.65,muted:false};try{const s=JSON.parse(localStorage.getItem(HYBRID_AUDIO_KEY));if(s)for(const k of ['music','sfx'])this.settings[k]=Math.min(1,Math.max(0,Number(s[k])||0));this.settings.muted=!!s?.muted;}catch{}this.muted=this.settings.muted;}
  persist(){try{localStorage.setItem(HYBRID_AUDIO_KEY,JSON.stringify(this.settings));}catch{}}
  configure(endless=false){
    this.setLevel(null);this.timeline.duration=endless?Infinity:80;this.timeline.music='rift-infinity';this.timeline.endless=endless;
    this.timeline.sections=[{time:0,name:'INTRO'},{time:16,name:'BUILD'},{time:36,name:'DROP'},{time:60,name:'FINALE'}];this.seek(0);this.lastEffects.clear();
  }
  effect(kind,dim) {
    const names={phase:'switch',complete:'win'};
    const name=names[kind]||kind,now=this.ctx?.currentTime??0;
    if(now-(this.lastEffects.get(name)??-Infinity)<.065||this.voices.size>=48)return;
    this.lastEffects.set(name,now);
    const synth={jump:['fall',320,.038,.09],flap:['air',520,.028,.075],land:['warm',170,.024,.065],portal:['air',1046.5,.04,.14],pass:['air',783.99,.018,.07]}[kind];
    if(synth){
      if(!this.ready||this.muted||this.settings.sfx===0)return;
      this.metrics.sfx[kind]=(this.metrics.sfx[kind]||0)+1;
      if(!this.simulationOnly)this.voice(synth[0],now,synth[1],synth[2],synth[3]);
    }else this.sfx(name,dim);
    if(kind==='phase')this.sfx('pulse',dim);
    if(kind==='death')this.sfx('collision',dim);
  }
}

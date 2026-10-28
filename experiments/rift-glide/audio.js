import {AudioEngine} from '../../js/audio.js';
import {testMusicSections} from './config.js';
/** Only experiment feedback is rate limited; gameplay still emits every valid Pulse. */
export class ExperimentAudio extends AudioEngine {
  constructor(options){super(options);this.lastFeedback=new Map();this.skippedFeedback=0;}
  setLevel(rt){
    super.setLevel(rt);if(!rt)return;
    // Both comparison models hear the same time-based arrangement, however high they fly.
    this.timeline.duration=Infinity;this.timeline.sections=testMusicSections();
  }
  seek(t){this.lastFeedback?.clear();super.seek(t);}
  sfx(name,...args){
    const now=this.ctx?.currentTime??0,group=['flight','switch','pulse'].includes(name);
    if(group&&(this.voices.size>=48||now-(this.lastFeedback.get(name)??-Infinity)<.095)){this.skippedFeedback++;return;}
    if(group)this.lastFeedback.set(name,now);super.sfx(name,...args);
  }
}

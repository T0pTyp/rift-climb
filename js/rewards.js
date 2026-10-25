// Stable reward catalog; conditions use saved normal-run evidence only.
export const CAMPAIGN_IDS = Object.freeze(['first-pulse','fractured-rhythm','overload']);
export const medalFor = best => best>=100?'gold':best>=75?'silver':best>=50?'bronze':'none';
export const MEDAL_NAMES = {none:'Noch keine Medaille',bronze:'Bronze',silver:'Silber',gold:'Gold'};
const complete=(s,id)=>!!s.levels[id]?.completed;
const gold=(s,id)=>s.levels[id]?.medal==='gold';
const allGold=s=>CAMPAIGN_IDS.every(id=>gold(s,id));
const total=(s,key)=>Object.values(s.levels).reduce((n,l)=>n+l[key],0);
export const ACHIEVEMENTS = Object.freeze([
 {id:'first-flight',name:'First Flight',description:'Starte deinen ersten regulären Versuch.',icon:'flight',test:s=>total(s,'attempts')>=1},
 {id:'halfway-there',name:'Halfway There',description:'Erreiche 50 % in einem Level.',icon:'half',test:s=>Object.values(s.levels).some(l=>l.best>=50)},
 {id:'first-victory',name:'First Victory',description:'Schließe dein erstes Level ab.',icon:'victory',test:s=>Object.values(s.levels).some(l=>l.completed)},
 {id:'pulse-master',name:'Pulse Master',description:'Schließe First Pulse ab.',icon:'pulse',test:s=>complete(s,'first-pulse')},
 {id:'rhythm-breaker',name:'Rhythm Breaker',description:'Schließe Fractured Rhythm ab.',icon:'rhythm',test:s=>complete(s,'fractured-rhythm')},
 {id:'overloaded',name:'Overloaded',description:'Schließe Overload ab.',icon:'core',test:s=>complete(s,'overload')},
 {id:'golden-ascent',name:'Golden Ascent',description:'Verdiene Gold in allen drei Kampagnenlevels.',icon:'ascent',test:allGold},
 {id:'persistent-climber',name:'Persistent Climber',description:'Starte insgesamt 25 reguläre Versuche.',icon:'persistent',test:s=>total(s,'attempts')>=25},
]);
export const SKINS=Object.freeze([
 {id:'original',name:'Original Riftling',description:'Der erste Funke.',condition:'Von Anfang an verfügbar.',accent:'#2fd6ff',test:()=>true},
 {id:'azure',name:'Azure Riftling',description:'Kristallkühle Energie und silberne Flossen.',condition:'Gold in First Pulse.',accent:'#65dfff',test:s=>gold(s,'first-pulse')},
 {id:'crimson',name:'Crimson Riftling',description:'Warme Plasmaadern und rubinrote Reflexe.',condition:'Gold in Fractured Rhythm.',accent:'#ff5c9f',test:s=>gold(s,'fractured-rhythm')},
 {id:'golden',name:'Golden Riftling',description:'Goldene Gravuren und ein leuchtender Energiekern.',condition:'Gold in allen drei Levels.',accent:'#ffd166',test:allGold},
 {id:'void',name:'Void Riftling',description:'Dunkle Materie mit kontrastreichen Energieadern.',condition:'Overload abschließen.',accent:'#b79bff',test:s=>complete(s,'overload')},
]);

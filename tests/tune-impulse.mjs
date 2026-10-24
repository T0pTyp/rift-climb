// Vergleicht Bewegungsmodelle und Impulsdauern für den seitlichen Flugimpuls.
// Aufruf: node tests/tune-impulse.mjs
// Kennzahlen (Spurbreite 90, Aufstieg 260 u/s, Beat 500 ms):
//   tSafe  – Zeit bis der Spieler 50 u seitlich zurückgelegt hat (ab da kollidiert er nicht mehr
//            mit einem Hindernis der alten Spur und berührt keines der neuen Spur mehr)
//   t95    – Zeit bis 95 % der Strecke
//   vPeak  – maximale Seitengeschwindigkeit, aPeak – maximale Seitenbeschleunigung
//   jump   – Geschwindigkeitssprung beim Gegen-Tipp mitten im Impuls (Maß für "ruckartig")
//   window – nutzbares Tipp-Fenster zwischen zwei Reihen im 1-Beat-Abstand
import { springStep } from '../js/physics.js';

const LANE = 90;
const CLEAR = 0.05; // Zeit, bis eine Reihe nach dem Passieren hinter dem Spieler liegt (13 u / 260 u/s)
const DT = 1 / 2000;

function easeModel(ms) {
  const T = ms / 1000;
  return {
    name: `easeOutCubic ${ms} ms`,
    run(retapAt) {
      let from = 0, to = LANE, t0 = 0, x = 0, v = 0;
      const out = [];
      for (let t = 0; t <= 0.6; t += DT) {
        if (retapAt !== undefined && Math.abs(t - retapAt) < DT / 2) { from = x; to = 0; t0 = t; }
        const u = Math.min(1, (t - t0) / T);
        const nx = from + (to - from) * (1 - (1 - u) ** 3);
        v = (nx - x) / DT;
        x = nx;
        out.push({ t, x, v });
      }
      return out;
    },
  };
}

function springModel(ms) {
  const omega = 4.744 / (ms / 1000);
  return {
    name: `Feder (kritisch gedämpft) ${ms} ms`,
    omega,
    run(retapAt) {
      const s = { x: 0, v: 0 };
      let target = LANE;
      const out = [];
      for (let t = 0; t <= 0.6; t += DT) {
        if (retapAt !== undefined && Math.abs(t - retapAt) < DT / 2) target = 0;
        springStep(s, target, omega, DT);
        out.push({ t, x: s.x, v: s.v });
      }
      return out;
    },
  };
}

function metrics(model) {
  const tr = model.run();
  const tSafe = tr.find((p) => p.x >= 50).t;
  const t95 = tr.find((p) => p.x >= LANE * 0.95).t;
  let vPeak = 0, aPeak = 0;
  for (let i = 1; i < tr.length; i++) {
    vPeak = Math.max(vPeak, Math.abs(tr[i].v));
    aPeak = Math.max(aPeak, Math.abs((tr[i].v - tr[i - 1].v) / DT));
  }
  const half = tr.find((p) => p.x >= 45).t;
  const re = model.run(half);
  const i = re.findIndex((p) => p.t >= half);
  const jump = Math.abs(re[i + 2].v - re[i - 2].v);
  const window = 0.5 - CLEAR - tSafe - CLEAR;
  return { name: model.name, tSafe, t95, vPeak, aPeak, jump, window };
}

const models = [easeModel(340), easeModel(260), easeModel(200), springModel(340), springModel(260), springModel(220), springModel(180)];
const rows = models.map(metrics);
const f = (n, w = 8) => (Number.isFinite(n) && n < 1e6 ? n.toFixed(0) : 'sprung').padStart(w);
console.log(`${'Modell'.padEnd(34)}${'tSafe'.padStart(8)}${'t95'.padStart(8)}${'vPeak'.padStart(8)}${'aPeak'.padStart(10)}${'Sprung'.padStart(8)}${'Fenster'.padStart(9)}`);
for (const r of rows) {
  console.log(`${r.name.padEnd(34)}${f(r.tSafe * 1000)}${f(r.t95 * 1000)}${f(r.vPeak)}${f(r.aPeak, 10)}${f(r.jump)}${f(r.window * 1000, 9)}`);
}
console.log('(Zeiten in ms, Geschwindigkeit in u/s, Beschleunigung in u/s², Sprung = Geschwindigkeitssprung beim Gegen-Tipp)');

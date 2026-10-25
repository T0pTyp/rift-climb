// Gemeinsame Formen für Spiel und LEVEL FORGE: der Editor zeichnet Objekte exakt wie das Spiel.
// Alle Funktionen arbeiten in Weltkoordinaten-Einheiten (u) im aktuellen Canvas-Transform;
// cy = Mittellinie auf dem Bildschirm (nach unten wachsend), x = linke sichtbare Kante.
// Nur Darstellung: Form und Größe entsprechen den Leveldaten, die Kollision liegt in physics.js/game.js.
import { COLORS } from './dimensions.js';

export const DASH = [6, 5];
export const SEAL_DASH = [3, 4];
export const NO_DASH = [];
const HIT_INSET_Y = 2; // wie level-data.js: Kollisionshöhe je Seite 2 u kleiner als sichtbar

function glowRect(ctx, color, x, y, w, h, g) {
  {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = color;
    ctx.fillRect(x - g * 2, y - g * 2, w + g * 4, h + g * 4);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = color;
  ctx.fillRect(x - g, y - g, w + g * 2, h + g * 2);
}

/**
 * Hindernis. Aktiv (tödlich): Neon-Röhre – helle Kontur = gefährliche Kante, dunkler Kern, leuchtendes Kollisionsband.
 * Neutral (weiß) zusätzlich mit Warnstreifen: in beiden Dimensionen tödlich. Inaktiv: gestrichelter, blasser Geist.
 */
export function drawBar(ctx, color, x, cy, w, hh, active, pop = 0) {
  const col = COLORS[color];
  const h = hh * 2;
  const top = cy - hh;
  if (active) {
    glowRect(ctx, col.glow, x, top, w, h, 4.5 + (color === 'W' ? 0 : pop * 5));
    ctx.fillStyle = col.main;
    ctx.fillRect(x, top, w, h);
    const ins = Math.min(2.2, hh * 0.35, w * 0.2);
    const iw = w - ins * 2;
    const ih = h - ins * 2;
    ctx.fillStyle = col.deep;
    ctx.fillRect(x + ins, top + ins, iw, ih);
    if (color === 'W') {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + ins, top + ins, iw, ih);
      ctx.clip();
      ctx.fillStyle = 'rgba(244,246,255,0.62)';
      ctx.beginPath();
      for (let sx = x - ih; sx < x + w; sx += 11) {
        ctx.moveTo(sx, top + h);
        ctx.lineTo(sx + 5, top + h);
        ctx.lineTo(sx + 5 + h, top);
        ctx.lineTo(sx + h, top);
      }
      ctx.fill();
      ctx.restore();
    } else if (hh > 15) {
      ctx.strokeStyle = col.main;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + ins + 3.5, top + ins + 3.5, iw - 7, ih - 7);
      ctx.globalAlpha = 1;
    }
    // Kollisionsband: genau so hoch wie die Hitbox (sichtbar 2 u Rand oben/unten)
    const chh = Math.max(1, hh - HIT_INSET_Y);
    ctx.globalAlpha = color === 'W' ? 0.25 : 0.5;
    ctx.fillStyle = col.main;
    ctx.fillRect(x + ins, cy - chh * 0.55, iw, chh * 1.1);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = col.light;
    ctx.fillRect(x + ins + 1, cy - 0.9, Math.max(0, iw - 2), 1.8);
    // Endkappen: helle, kantige Abschlüsse
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, top, 1.6, h);
    ctx.fillRect(x + w - 1.6, top, 1.6, h);
    return;
  }
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = col.main;
  ctx.fillRect(x, top, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = col.ghost;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(DASH);
  ctx.strokeRect(x + 1, top + 1, w - 2, h - 2);
  ctx.setLineDash(NO_DASH);
  ctx.lineWidth = 1;
}

/**
 * Geschlossenes Rift-Siegel: Energiebarriere aus Gold mit fließenden Runen und knisternden Kanten.
 * reach = in Pulse-Reichweite (heller Rahmen), t = Zeit (s) für die Energie-Animation.
 */
export function drawSealClosed(ctx, x, cy, w, hh, reach = false, shimmer = 0, t = 0) {
  const col = COLORS.S;
  const h = hh * 2;
  const top = cy - hh;
  glowRect(ctx, col.glow, x, top, w, h, reach ? 6 + shimmer * 3 : 4.5);
  ctx.fillStyle = col.main;
  ctx.fillRect(x, top, w, h);
  const ins = Math.min(2, hh * 0.3);
  ctx.fillStyle = col.deep;
  ctx.fillRect(x + ins, top + ins, w - ins * 2, h - ins * 2);
  // Runen wandern als Energiefluss durch die Barriere
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + ins, top + ins, w - ins * 2, h - ins * 2);
  ctx.clip();
  ctx.fillStyle = col.light;
  ctx.beginPath();
  const rows = Math.max(1, Math.floor((h - 2) / 18) + 1);
  const shift = (t * 36) % 18;
  for (let r = 0; r < rows; r++) {
    const ry = cy + (r - (rows - 1) / 2) * 18;
    const dir = r % 2 ? -1 : 1;
    for (let cx = x - 9 + (dir > 0 ? shift : 18 - shift); cx < x + w + 9; cx += 18) {
      ctx.moveTo(cx, ry - 4); ctx.lineTo(cx + 4, ry); ctx.lineTo(cx, ry + 4); ctx.lineTo(cx - 4, ry);
    }
  }
  ctx.fill();
  ctx.restore();
  // Knisternde Kanten
  const crackle = 0.55 + 0.45 * Math.sin(t * 13 + x * 0.1);
  ctx.globalAlpha = 0.5 + 0.5 * crackle;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 1, top, w - 2, 1.2);
  ctx.fillRect(x + 1, top + h - 1.2, w - 2, 1.2);
  ctx.strokeStyle = reach ? '#ffffff' : '#fff1c2';
  ctx.globalAlpha = reach ? 0.65 + 0.35 * shimmer : 0.9;
  ctx.lineWidth = reach ? 2.5 : 1.5;
  ctx.strokeRect(x + 0.75, top + 0.75, w - 1.5, h - 1.5);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

/** Geöffnetes Siegel: aufgelöste Energie, transparenter Rahmen, Countdown-Balken (frac = verbleibender Anteil). */
export function drawSealOpen(ctx, x, cy, w, hh, frac, warn = false, age = Infinity) {
  const col = COLORS.S;
  if (age < 0.18) {
    const a = age / 0.18;
    ctx.globalAlpha = 1 - a;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - a * 6, cy - hh - a * 10, w + a * 12, hh * 2 + a * 20);
  }
  if (age < 0.4) {
    // Auflösung: Fragmente der Barriere driften auseinander (deterministisch aus dem Alter, keine Allokation)
    const f = age / 0.4;
    const n = Math.max(4, Math.min(28, Math.floor(w / 12)));
    ctx.globalAlpha = 1 - f;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      const sp = 0.6 + ((i * 37) % 10) / 20;
      const s = 3.2 * (1 - f) + 0.6;
      ctx.fillStyle = i % 3 ? col.main : '#ffffff';
      ctx.fillRect(x + (i + 0.5) * (w / n) - s / 2 + dir * f * 6, cy + dir * age * 70 * sp - s / 2, s, s);
    }
  }
  ctx.globalAlpha = warn ? 0.95 : 0.5;
  ctx.strokeStyle = col.main;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(SEAL_DASH);
  ctx.strokeRect(x + 1, cy - hh + 1, w - 2, hh * 2 - 2);
  ctx.setLineDash(NO_DASH);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = col.main;
  ctx.fillRect(x + (w - w * frac) / 2, cy - 1.5, w * frac, 3);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

/** Einfache Ersatzfigur (Pfeil mit Glow), solange die Riftling-Assets laden oder falls sie fehlen. */
export function drawShip(ctx, x, y, dim, tilt = 0, pop = 0, alpha = 1) {
  const col = COLORS[dim];
  const scale = 1 + pop * 0.28;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(scale * (1 - pop * 0.12), scale);
  ctx.globalAlpha = (0.8 + pop * 0.2) * alpha;
  ctx.fillStyle = col.glow;
  ctx.beginPath();
  ctx.arc(0, 0, 20 + pop * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pop > 0.6 ? '#ffffff' : col.main;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(11, 10);
  ctx.lineTo(0, 5);
  ctx.lineTo(-11, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Zielstreifen (Schachbrett) über die Spielfeldbreite; y = Ziellinie auf dem Bildschirm. */
export function drawFinish(ctx, width, fy, label = 'RIFT CLEARED · 100 %') {
  {
    ctx.fillStyle = 'rgba(26,255,178,0.16)';
    ctx.fillRect(0, fy - 14, width, 14);
  }
  for (let i = 0; i * 20 < width; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#1affb2';
    ctx.fillRect(i * 20, fy - 6, 20, 6);
  }
  if (!label) return;
  ctx.fillStyle = '#1affb2';
  ctx.font = '800 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, width / 2, fy - 20);
}

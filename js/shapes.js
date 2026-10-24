// Gemeinsame Formen für Spiel und LEVEL FORGE: der Editor zeichnet Objekte exakt wie das Spiel.
// Alle Funktionen arbeiten in Weltkoordinaten-Einheiten (u) im aktuellen Canvas-Transform;
// cy = Mittellinie auf dem Bildschirm (nach unten wachsend), x = linke sichtbare Kante.
import { COLORS } from './dimensions.js';

export const DASH = [6, 5];
export const SEAL_DASH = [3, 4];
export const NO_DASH = [];

/** Hindernis: aktiv (tödlich) massiv mit Glow, inaktiv als gestrichelter Geist. */
export function drawBar(ctx, color, x, cy, w, hh, active, pop = 0) {
  const col = COLORS[color];
  const h = hh * 2;
  if (active) {
    const g = 4 + (color === 'W' ? 0 : pop * 5);
    ctx.fillStyle = col.glow;
    ctx.fillRect(x - g, cy - hh - g, w + g * 2, h + g * 2);
    ctx.fillStyle = col.main;
    ctx.fillRect(x, cy - hh, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(x + 2, cy - 1.5, Math.max(0, w - 4), 3);
    return;
  }
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = col.main;
  ctx.fillRect(x, cy - hh, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = col.ghost;
  ctx.lineWidth = 2;
  ctx.setLineDash(DASH);
  ctx.strokeRect(x + 1, cy - hh + 1, w - 2, h - 2);
  ctx.setLineDash(NO_DASH);
  ctx.lineWidth = 1;
}

/** Geschlossenes Rift-Siegel: massives Gold mit Rautenmuster; reach = in Pulse-Reichweite (leuchtet). */
export function drawSealClosed(ctx, x, cy, w, hh, reach = false, shimmer = 0) {
  const col = COLORS.S;
  const g = reach ? 6 + shimmer * 3 : 4;
  ctx.fillStyle = col.glow;
  ctx.fillRect(x - g, cy - hh - g, w + g * 2, hh * 2 + g * 2);
  ctx.fillStyle = col.main;
  ctx.fillRect(x, cy - hh, w, hh * 2);
  ctx.fillStyle = 'rgba(90,40,0,0.6)';
  ctx.beginPath();
  const rows = Math.max(1, Math.floor((hh * 2 - 2) / 18) + 1);
  for (let r = 0; r < rows; r++) {
    const ry = cy + (r - (rows - 1) / 2) * 18;
    for (let cx = x + 9; cx < x + w - 5; cx += 18) {
      ctx.moveTo(cx, ry - 4.5); ctx.lineTo(cx + 4.5, ry); ctx.lineTo(cx, ry + 4.5); ctx.lineTo(cx - 4.5, ry);
    }
  }
  ctx.fill();
  ctx.strokeStyle = reach ? '#ffffff' : '#fff1c2';
  ctx.globalAlpha = reach ? 0.65 + 0.35 * shimmer : 0.9;
  ctx.lineWidth = reach ? 2.5 : 1.5;
  ctx.strokeRect(x + 0.75, cy - hh + 0.75, w - 1.5, hh * 2 - 1.5);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

/** Geöffnetes Siegel: gestrichelter Rahmen + Countdown-Balken (frac = verbleibender Anteil). */
export function drawSealOpen(ctx, x, cy, w, hh, frac, warn = false, age = Infinity) {
  const col = COLORS.S;
  if (age < 0.18) {
    const a = age / 0.18;
    ctx.globalAlpha = 1 - a;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - a * 6, cy - hh - a * 10, w + a * 12, hh * 2 + a * 20);
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

/** Spielerfigur (Pfeil mit Glow) an (x, y) auf dem Bildschirm. */
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

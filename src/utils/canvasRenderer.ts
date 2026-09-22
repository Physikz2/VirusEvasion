import { PlayerEntity, VirusEntity, Particle, SpawnIndicator } from '../types';

export function drawCyberGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number
) {
  // Deep background
  ctx.fillStyle = '#06080d';
  ctx.fillRect(0, 0, width, height);

  // Radial ambient floor illumination
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    50,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.75
  );
  gradient.addColorStop(0, 'rgba(14, 165, 233, 0.05)');
  gradient.addColorStop(0.5, 'rgba(8, 14, 26, 0.4)');
  gradient.addColorStop(1, 'rgba(4, 6, 10, 0.95)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Cyber Grid Lines
  const gridSize = 48;
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = 0; x <= width; x += gridSize) {
    const pulse = Math.sin(time * 1.5 + x * 0.02) * 0.5 + 0.5;
    ctx.strokeStyle = `rgba(14, 165, 233, ${0.04 + pulse * 0.04})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += gridSize) {
    const pulse = Math.cos(time * 1.5 + y * 0.02) * 0.5 + 0.5;
    ctx.strokeStyle = `rgba(14, 165, 233, ${0.04 + pulse * 0.04})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Grid Intersection Dots
  ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
  for (let x = 0; x <= width; x += gridSize * 2) {
    for (let y = 0; y <= height; y += gridSize * 2) {
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
  }

  // Boundary Perimeter Fence
  const pad = 12;
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);
  ctx.setLineDash([]);

  // Corner Tech Brackets
  const bracketLen = 28;
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2.5;

  // Top Left
  ctx.beginPath();
  ctx.moveTo(pad, pad + bracketLen);
  ctx.lineTo(pad, pad);
  ctx.lineTo(pad + bracketLen, pad);
  ctx.stroke();

  // Top Right
  ctx.beginPath();
  ctx.moveTo(width - pad - bracketLen, pad);
  ctx.lineTo(width - pad, pad);
  ctx.lineTo(width - pad, pad + bracketLen);
  ctx.stroke();

  // Bottom Left
  ctx.beginPath();
  ctx.moveTo(pad, height - pad - bracketLen);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(pad + bracketLen, height - pad);
  ctx.stroke();

  // Bottom Right
  ctx.beginPath();
  ctx.moveTo(width - pad - bracketLen, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.lineTo(width - pad, height - pad - bracketLen);
  ctx.stroke();
}

/**
 * Renders a tactile 3D-textured block with extrusion bevels, drop shadows,
 * metallic reflection, and high-tech glowing energy core.
 */
export function draw3DBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  depth: number,
  theme: 'player' | 'virus' | 'drifter' | 'pulsar',
  pulsePhase: number = 0,
  invulnerable: boolean = false
) {
  const half = size / 2;
  const cx = x;
  const cy = y;

  // Color profiles
  let topGradStart: string;
  let topGradEnd: string;
  let sideColorDark: string;
  let sideColorLight: string;
  let shadowGlow: string;
  let coreColor: string;
  let strokeColor: string;

  if (theme === 'player') {
    topGradStart = '#38bdf8';
    topGradEnd = '#0284c7';
    sideColorDark = '#0369a1';
    sideColorLight = '#0ea5e9';
    shadowGlow = 'rgba(6, 182, 212, 0.4)';
    coreColor = '#e0f2fe';
    strokeColor = '#7dd3fc';
  } else if (theme === 'drifter') {
    topGradStart = '#c084fc';
    topGradEnd = '#9333ea';
    sideColorDark = '#6b21a8';
    sideColorLight = '#a855f7';
    shadowGlow = 'rgba(168, 85, 247, 0.45)';
    coreColor = '#f3e8ff';
    strokeColor = '#e9d5ff';
  } else if (theme === 'pulsar') {
    topGradStart = '#fb923c';
    topGradEnd = '#ea580c';
    sideColorDark = '#9a3412';
    sideColorLight = '#f97316';
    shadowGlow = 'rgba(249, 115, 22, 0.45)';
    coreColor = '#ffedd5';
    strokeColor = '#fed7aa';
  } else {
    // Default hostile virus (Ruby/Crimson)
    topGradStart = '#f87171';
    topGradEnd = '#dc2626';
    sideColorDark = '#991b1b';
    sideColorLight = '#ef4444';
    shadowGlow = 'rgba(239, 68, 68, 0.45)';
    coreColor = '#fee2e2';
    strokeColor = '#fca5a5';
  }

  ctx.save();

  // 1. Tactile Floor Drop Shadow & Neon Aura
  ctx.save();
  ctx.shadowColor = shadowGlow;
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = depth * 0.7;
  ctx.shadowOffsetY = depth * 1.3;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(cx - half + 2, cy - half + 2, size - 4, size - 4);
  ctx.restore();

  // 2. 3D Extruded Bevel Sides (Simulating a raised geometric pedestal)
  // Bottom Extrusion Face
  ctx.fillStyle = sideColorDark;
  ctx.beginPath();
  ctx.moveTo(cx - half, cy + half);
  ctx.lineTo(cx + half, cy + half);
  ctx.lineTo(cx + half + depth * 0.5, cy + half + depth);
  ctx.lineTo(cx - half + depth * 0.5, cy + half + depth);
  ctx.closePath();
  ctx.fill();

  // Right Extrusion Face
  ctx.fillStyle = sideColorLight;
  ctx.beginPath();
  ctx.moveTo(cx + half, cy - half);
  ctx.lineTo(cx + half + depth * 0.5, cy - half + depth);
  ctx.lineTo(cx + half + depth * 0.5, cy + half + depth);
  ctx.lineTo(cx + half, cy + half);
  ctx.closePath();
  ctx.fill();

  // 3. Top Face with 3D Specular Sheen Gradient
  const topGrad = ctx.createLinearGradient(
    cx - half,
    cy - half,
    cx + half,
    cy + half
  );
  topGrad.addColorStop(0, topGradStart);
  topGrad.addColorStop(1, topGradEnd);
  ctx.fillStyle = topGrad;
  ctx.fillRect(cx - half, cy - half, size, size);

  // Top Face Perimeter Inset Bevel Line
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(cx - half + 1, cy - half + 1, size - 2, size - 2);

  // Top-Left Edge Specular Glint (Simulated Key Light Reflection)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - half + 2, cy + half - 2);
  ctx.lineTo(cx - half + 2, cy - half + 2);
  ctx.lineTo(cx + half - 2, cy - half + 2);
  ctx.stroke();

  // 4. Glowing Tech Core / Central Node
  const corePulse = Math.sin(pulsePhase) * 0.25 + 0.75;
  const coreSize = size * 0.38 * corePulse;

  // Outer core glow ring
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - coreSize / 2, cy - coreSize / 2, coreSize, coreSize);

  // Center solid luminescent dot
  ctx.fillStyle = coreColor;
  ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);

  // If virus: draw aggressive cyber cross / hazard notches
  if (theme !== 'player') {
    ctx.strokeStyle = sideColorDark;
    ctx.lineWidth = 1.2;
    // Cross lines
    ctx.beginPath();
    ctx.moveTo(cx - half + 4, cy);
    ctx.lineTo(cx + half - 4, cy);
    ctx.moveTo(cx, cy - half + 4);
    ctx.lineTo(cx, cy + half - 4);
    ctx.stroke();
  } else {
    // If player: draw sleek digital targeting reticle inside
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 5. Invulnerability Shield Overlay (When active)
  if (invulnerable) {
    const shieldAlpha = 0.5 + Math.sin(pulsePhase * 4) * 0.3;
    ctx.strokeStyle = `rgba(56, 189, 248, ${shieldAlpha})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Draws the player's motion trails to enhance tactile fluid movement
 */
export function drawPlayerTrail(
  ctx: CanvasRenderingContext2D,
  trail: { x: number; y: number }[],
  size: number
) {
  if (trail.length < 2) return;

  ctx.save();
  for (let i = 0; i < trail.length; i++) {
    const pt = trail[i];
    const factor = (i + 1) / trail.length;
    const trailSize = size * (0.4 + factor * 0.45);
    const alpha = factor * 0.22;

    ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
    ctx.fillRect(
      pt.x - trailSize / 2,
      pt.y - trailSize / 2,
      trailSize,
      trailSize
    );
  }
  ctx.restore();
}

/**
 * Draws holographic spawn indicator reticle for incoming viruses
 */
export function drawSpawnIndicator(
  ctx: CanvasRenderingContext2D,
  indicator: SpawnIndicator,
  time: number
) {
  const { x, y, size, progress, strain } = indicator;
  const radius = size * 1.6 * (1 - progress * 0.4);

  let color = '#ef4444';
  if (strain === 'drifter') color = '#a855f7';
  if (strain === 'pulsar') color = '#f97316';

  ctx.save();

  // Expanding/contracting warning circle
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Rotating outer tech brackets
  const rot = time * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  const bracket = radius * 0.75;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  // 4 corner indicators
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(bracket - 6, -bracket);
    ctx.lineTo(bracket, -bracket);
    ctx.lineTo(bracket, -bracket + 6);
    ctx.stroke();
  }
  ctx.restore();

  // Progress radial arc
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius + 4, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();

  // Warning text
  ctx.font = '600 11px Rajdhani, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText('INCOMING THREAT', x, y + radius + 16);

  ctx.restore();
}

/**
 * Draws animated dynamic particles (shards, spark bursts, glowing debris)
 */
export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;

    if (p.is3dShard) {
      // 3D rectangular debris shard
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.7);
    } else {
      // Glowing circular spark
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

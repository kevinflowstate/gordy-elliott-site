"use client";

import { useEffect, useRef } from "react";

const HERO_BLUE = [224, 64, 208] as const;

type HeroColor = typeof HERO_BLUE;

type RenderContext = {
  ctx: CanvasRenderingContext2D;
  blue: HeroColor;
};

type RuntimeSize = {
  width: number;
  height: number;
};

type Point = {
  x: number;
  y: number;
};

// --- COGS ---
class Cog {
  x: number; y: number; r: number; teeth: number;
  speed: number; opacity: number; angle: number;
  toothDepth: number; toothWidth: number; innerR: number;
  constructor(x: number, y: number, r: number, teeth: number, speed: number, opacity: number) {
    this.x = x; this.y = y; this.r = r; this.teeth = teeth;
    this.speed = speed; this.opacity = opacity;
    this.angle = Math.random() * Math.PI * 2;
    this.toothDepth = r * 0.18;
    this.toothWidth = (Math.PI * 2) / (teeth * 2);
    this.innerR = r * 0.35;
  }
  update() { this.angle += this.speed; }
  draw({ ctx, blue }: RenderContext) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.opacity})`;
    ctx.lineWidth = 1;
    ctx.shadowColor = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.opacity * 0.5})`;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let i = 0; i < this.teeth; i++) {
      const a1 = (i / this.teeth) * Math.PI * 2;
      const a2 = a1 + this.toothWidth * 0.3;
      const a4 = a1 + this.toothWidth * 1.3;
      const a5 = a1 + this.toothWidth * 2;
      const rOuter = this.r + this.toothDepth;
      const rInner = this.r;
      if (i === 0) ctx.moveTo(Math.cos(a1) * rInner, Math.sin(a1) * rInner);
      ctx.lineTo(Math.cos(a2) * rInner, Math.sin(a2) * rInner);
      ctx.lineTo(Math.cos(a2) * rOuter, Math.sin(a2) * rOuter);
      ctx.lineTo(Math.cos(a4) * rOuter, Math.sin(a4) * rOuter);
      ctx.lineTo(Math.cos(a4) * rInner, Math.sin(a4) * rInner);
      ctx.lineTo(Math.cos(a5) * rInner, Math.sin(a5) * rInner);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, this.innerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, this.innerR * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const sa = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa) * this.innerR * 0.4, Math.sin(sa) * this.innerR * 0.4);
      ctx.lineTo(Math.cos(sa) * this.innerR, Math.sin(sa) * this.innerR);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// --- PIPES ---
class Pipe {
  segments: Point[] = [];
  opacity = 0; pipeWidth = 0; progress = 0; speed = 0;
  fadeOut = false; fadeOpacity = 1;
  flowDots: { pos: number; speed: number }[] = [];
  constructor(runtime: RuntimeSize) { this.reset(runtime); }
  reset({ width, height }: RuntimeSize) {
    this.segments = [];
    let x = Math.random() * width;
    let y = Math.random() * height;
    const segCount = Math.floor(Math.random() * 4) + 3;
    let dir = Math.floor(Math.random() * 4);
    this.segments.push({ x, y });
    for (let i = 0; i < segCount; i++) {
      const len = Math.random() * 120 + 40;
      const dx = [1, 0, -1, 0][dir] * len;
      const dy = [0, 1, 0, -1][dir] * len;
      x += dx; y += dy;
      this.segments.push({ x, y });
      dir = (dir + (Math.random() > 0.5 ? 1 : 3)) % 4;
    }
    this.opacity = Math.random() * 0.1 + 0.06;
    this.pipeWidth = Math.random() * 4 + 3;
    this.progress = 0;
    this.speed = Math.random() * 0.004 + 0.002;
    this.fadeOut = false;
    this.fadeOpacity = 1;
    this.flowDots = [];
    for (let i = 0; i < 3; i++) {
      this.flowDots.push({ pos: Math.random(), speed: Math.random() * 0.003 + 0.001 });
    }
  }
  update(runtime: RuntimeSize) {
    if (!this.fadeOut) {
      this.progress += this.speed;
      if (this.progress >= 1.2) this.fadeOut = true;
    } else {
      this.fadeOpacity -= 0.005;
      if (this.fadeOpacity <= 0) this.reset(runtime);
    }
    this.flowDots.forEach(d => { d.pos += d.speed; if (d.pos > 1) d.pos = 0; });
  }
  getPointAtProgress(p: number) {
    if (this.segments.length < 2) return this.segments[0] ?? { x: 0, y: 0 };
    const totalSegs = this.segments.length - 1;
    const segF = p * totalSegs;
    const segI = Math.min(Math.floor(segF), totalSegs - 1);
    const segP = segF - segI;
    const a = this.segments[segI]; const b = this.segments[segI + 1];
    return { x: a.x + (b.x - a.x) * segP, y: a.y + (b.y - a.y) * segP };
  }
  draw({ ctx, blue }: RenderContext) {
    const alpha = this.opacity * (this.fadeOut ? this.fadeOpacity : 1);
    const drawProgress = Math.min(this.progress, 1);
    const totalSegs = this.segments.length - 1;
    const drawSegs = Math.floor(drawProgress * totalSegs);
    const partialProgress = (drawProgress * totalSegs) - drawSegs;
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = pass === 0 ? this.pipeWidth : this.pipeWidth - 2;
      ctx.strokeStyle = pass === 0
        ? `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha})`
        : `rgba(26,26,26,${alpha * 4})`;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(this.segments[0].x, this.segments[0].y);
      for (let i = 1; i <= drawSegs && i < this.segments.length; i++) {
        ctx.lineTo(this.segments[i].x, this.segments[i].y);
      }
      if (drawSegs < totalSegs) {
        const a = this.segments[drawSegs]; const b = this.segments[drawSegs + 1];
        ctx.lineTo(a.x + (b.x - a.x) * partialProgress, a.y + (b.y - a.y) * partialProgress);
      }
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha * 1.5})`;
    for (let i = 1; i < Math.min(drawSegs + 1, this.segments.length - 1); i++) {
      ctx.beginPath();
      ctx.arc(this.segments[i].x, this.segments[i].y, this.pipeWidth * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!this.fadeOut && this.progress > 0.3) {
      this.flowDots.forEach(d => {
        if (d.pos <= drawProgress) {
          const pt = this.getPointAtProgress(d.pos);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha * 4})`;
          ctx.fill();
        }
      });
    }
    ctx.fillStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha * 1.5})`;
    ctx.beginPath();
    ctx.arc(this.segments[0].x, this.segments[0].y, this.pipeWidth * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- I-BEAMS ---
class IBeam {
  x: number; y: number; size: number; angle: number; opacity: number;
  rotSpeed: number; drift: Point;
  constructor(x: number, y: number, size: number, angle: number, opacity: number) {
    this.x = x; this.y = y; this.size = size; this.angle = angle; this.opacity = opacity;
    this.rotSpeed = (Math.random() - 0.5) * 0.002;
    this.drift = { x: (Math.random() - 0.5) * 0.15, y: (Math.random() - 0.5) * 0.1 };
  }
  update({ width, height }: RuntimeSize) {
    this.angle += this.rotSpeed;
    this.x += this.drift.x; this.y += this.drift.y;
    if (this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) {
      this.x = Math.random() * width; this.y = Math.random() * height;
    }
  }
  draw({ ctx, blue }: RenderContext) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.opacity})`;
    ctx.lineWidth = 1;
    ctx.shadowColor = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.opacity * 0.4})`;
    ctx.shadowBlur = 6;
    const s = this.size;
    const fw = s; const fh = s * 0.15; const ww = s * 0.12; const bh = s * 1.2;
    ctx.beginPath();
    ctx.moveTo(-fw/2, -bh/2); ctx.lineTo(fw/2, -bh/2);
    ctx.lineTo(fw/2, -bh/2 + fh); ctx.lineTo(ww/2, -bh/2 + fh);
    ctx.lineTo(ww/2, bh/2 - fh); ctx.lineTo(fw/2, bh/2 - fh);
    ctx.lineTo(fw/2, bh/2); ctx.lineTo(-fw/2, bh/2);
    ctx.lineTo(-fw/2, bh/2 - fh); ctx.lineTo(-ww/2, bh/2 - fh);
    ctx.lineTo(-ww/2, -bh/2 + fh); ctx.lineTo(-fw/2, -bh/2 + fh);
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
}

// --- BOLTS ---
class Bolt {
  x: number; y: number; size: number; opacity: number;
  pulsePhase: number; currentOpacity = 0;
  constructor(x: number, y: number, size: number, opacity: number) {
    this.x = x; this.y = y; this.size = size; this.opacity = opacity;
    this.pulsePhase = Math.random() * Math.PI * 2;
  }
  update(t: number) {
    this.currentOpacity = this.opacity * (0.6 + 0.4 * Math.sin(t * 0.008 + this.pulsePhase));
  }
  draw({ ctx, blue }: RenderContext) {
    ctx.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.currentOpacity})`;
    ctx.lineWidth = 0.8;
    ctx.shadowColor = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.currentOpacity * 0.5})`;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const px = this.x + Math.cos(a) * this.size;
      const py = this.y + Math.sin(a) * this.size;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * 0.35, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// --- DIMENSION LINES ---
class DimensionLine {
  horizontal = true; x1 = 0; y1 = 0; x2 = 0; y2 = 0;
  tickLen = 6; opacity = 0; progress = 0; speed = 0;
  fadeOut = false; fadeOpacity = 1;
  constructor(runtime: RuntimeSize) { this.reset(runtime); }
  reset({ width, height }: RuntimeSize) {
    this.horizontal = Math.random() > 0.5;
    this.x1 = Math.random() * width; this.y1 = Math.random() * height;
    if (this.horizontal) { this.x2 = this.x1 + Math.random() * 180 + 60; this.y2 = this.y1; }
    else { this.x2 = this.x1; this.y2 = this.y1 + Math.random() * 180 + 60; }
    this.opacity = Math.random() * 0.08 + 0.05;
    this.progress = 0; this.speed = Math.random() * 0.005 + 0.002;
    this.fadeOut = false; this.fadeOpacity = 1;
  }
  update(runtime: RuntimeSize) {
    if (!this.fadeOut) { this.progress += this.speed; if (this.progress >= 1.3) this.fadeOut = true; }
    else { this.fadeOpacity -= 0.006; if (this.fadeOpacity <= 0) this.reset(runtime); }
  }
  draw({ ctx, blue }: RenderContext) {
    const alpha = this.opacity * (this.fadeOut ? this.fadeOpacity : 1);
    const p = Math.min(this.progress, 1);
    const cx = this.x1 + (this.x2 - this.x1) * p;
    const cy = this.y1 + (this.y2 - this.y1) * p;
    ctx.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(this.x1, this.y1); ctx.lineTo(cx, cy); ctx.stroke();
    if (this.horizontal) {
      ctx.beginPath(); ctx.moveTo(this.x1, this.y1 - this.tickLen); ctx.lineTo(this.x1, this.y1 + this.tickLen); ctx.stroke();
      if (p > 0.95) { ctx.beginPath(); ctx.moveTo(this.x2, this.y2 - this.tickLen); ctx.lineTo(this.x2, this.y2 + this.tickLen); ctx.stroke(); }
    } else {
      ctx.beginPath(); ctx.moveTo(this.x1 - this.tickLen, this.y1); ctx.lineTo(this.x1 + this.tickLen, this.y1); ctx.stroke();
      if (p > 0.95) { ctx.beginPath(); ctx.moveTo(this.x2 - this.tickLen, this.y2); ctx.lineTo(this.x2 + this.tickLen, this.y2); ctx.stroke(); }
    }
    if (p > 0.1) {
      const aSize = 4;
      ctx.fillStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha})`;
      if (this.horizontal) {
        ctx.beginPath(); ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x1 + aSize, this.y1 - aSize/2);
        ctx.lineTo(this.x1 + aSize, this.y1 + aSize/2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x1 - aSize/2, this.y1 + aSize);
        ctx.lineTo(this.x1 + aSize/2, this.y1 + aSize); ctx.fill();
      }
    }
  }
}

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasElement: HTMLCanvasElement = canvas;
    const ctx = canvasElement.getContext("2d");
    if (!ctx) return;
    const context: CanvasRenderingContext2D = ctx;

    const runtime: RuntimeSize = { width: 0, height: 0 };
    const renderContext: RenderContext = { ctx: context, blue: HERO_BLUE };
    let animationId: number;

    function resize() {
      runtime.width = canvasElement.width = window.innerWidth;
      runtime.height = canvasElement.height = window.innerHeight;
    }

    // --- GRID ---
    function drawGrid() {
      const { width, height } = runtime;
      const blue = HERO_BLUE;
      context.shadowBlur = 0;
      const gridSize = 80;
      context.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},0.025)`;
      context.lineWidth = 0.5;
      for (let x = 0; x < width; x += gridSize) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y < height; y += gridSize) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
      context.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},0.012)`;
      const minor = gridSize / 4;
      for (let x = 0; x < width; x += minor) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
      for (let y = 0; y < height; y += minor) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
    }

    const cogs: Cog[] = [];
    const pipes: Pipe[] = [];
    const ibeams: IBeam[] = [];
    const bolts: Bolt[] = [];
    const dims: DimensionLine[] = [];

    function initElements() {
      const { width, height } = runtime;
      cogs.length = 0; pipes.length = 0; ibeams.length = 0; bolts.length = 0; dims.length = 0;
      const cogPositions = [
        { x: width * 0.08, y: height * 0.15, r: 55, teeth: 16, speed: 0.003, opacity: 0.14 },
        { x: width * 0.08 + 78, y: height * 0.15 + 48, r: 35, teeth: 10, speed: -0.00525, opacity: 0.12 },
        { x: width * 0.85, y: height * 0.7, r: 70, teeth: 20, speed: -0.002, opacity: 0.11 },
        { x: width * 0.85 + 98, y: height * 0.7 - 10, r: 42, teeth: 12, speed: 0.00367, opacity: 0.1 },
        { x: width * 0.5, y: height * 0.85, r: 45, teeth: 14, speed: 0.0025, opacity: 0.09 },
        { x: width * 0.35, y: height * 0.4, r: 30, teeth: 8, speed: -0.004, opacity: 0.08 },
        { x: width * 0.92, y: height * 0.2, r: 25, teeth: 8, speed: 0.005, opacity: 0.08 },
      ];
      cogPositions.forEach(c => cogs.push(new Cog(c.x, c.y, c.r, c.teeth, c.speed, c.opacity)));
      for (let i = 0; i < 5; i++) pipes.push(new Pipe(runtime));
      const beamConfigs = [
        { x: width * 0.2, y: height * 0.6, size: 28, angle: 0.2, opacity: 0.1 },
        { x: width * 0.7, y: height * 0.3, size: 22, angle: -0.5, opacity: 0.09 },
        { x: width * 0.45, y: height * 0.15, size: 18, angle: 0.8, opacity: 0.07 },
        { x: width * 0.15, y: height * 0.85, size: 24, angle: -0.3, opacity: 0.08 },
        { x: width * 0.75, y: height * 0.85, size: 20, angle: 1.2, opacity: 0.07 },
      ];
      beamConfigs.forEach(b => ibeams.push(new IBeam(b.x, b.y, b.size, b.angle, b.opacity)));
      for (let i = 0; i < 15; i++) {
        bolts.push(new Bolt(Math.random() * width, Math.random() * height, Math.random() * 6 + 4, Math.random() * 0.08 + 0.05));
      }
      for (let i = 0; i < 6; i++) dims.push(new DimensionLine(runtime));
    }

    resize();
    initElements();

    const handleResize = () => { resize(); initElements(); };
    window.addEventListener("resize", handleResize);

    let t = 0;
    function animate() {
      context.clearRect(0, 0, runtime.width, runtime.height);
      t++;
      drawGrid();
      dims.forEach(d => { d.update(runtime); d.draw(renderContext); });
      pipes.forEach(p => { p.update(runtime); p.draw(renderContext); });
      ibeams.forEach(b => { b.update(runtime); b.draw(renderContext); });
      cogs.forEach(c => { c.update(); c.draw(renderContext); });
      bolts.forEach(b => { b.update(t); b.draw(renderContext); });
      animationId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full z-0"
    />
  );
}

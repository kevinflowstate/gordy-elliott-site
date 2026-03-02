"use client";

import { useEffect, useRef } from "react";

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w: number, h: number;
    let animationId: number;
    const green = [16, 185, 129];

    function resize() {
      w = canvas!.width = window.innerWidth;
      h = canvas!.height = window.innerHeight;
    }

    class Node {
      x: number; y: number; baseX: number; baseY: number;
      r: number; opacity: number; pulsePhase: number; driftSpeed: number;
      constructor(x: number, y: number, r: number, opacity: number) {
        this.x = x; this.y = y; this.baseX = x; this.baseY = y;
        this.r = r; this.opacity = opacity;
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.driftSpeed = Math.random() * 0.5 + 0.2;
      }
      update(t: number) {
        this.x = this.baseX + Math.sin(t * 0.001 * this.driftSpeed) * 15;
        this.y = this.baseY + Math.cos(t * 0.0008 * this.driftSpeed) * 10;
      }
      draw(t: number) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.003 + this.pulsePhase);
        const alpha = this.opacity * pulse;
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${green[0]},${green[1]},${green[2]},${alpha})`;
        ctx!.shadowColor = `rgba(${green[0]},${green[1]},${green[2]},${alpha * 0.6})`;
        ctx!.shadowBlur = 12;
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.r * 0.4, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${green[0]},${green[1]},${green[2]},${alpha * 1.8})`;
        ctx!.fill();
      }
    }

    class Connection {
      a: Node; b: Node; progress: number; speed: number;
      flowDots: { pos: number; speed: number }[];
      constructor(a: Node, b: Node) {
        this.a = a; this.b = b;
        this.progress = 0;
        this.speed = Math.random() * 0.003 + 0.001;
        this.flowDots = [];
        for (let i = 0; i < 2; i++) {
          this.flowDots.push({ pos: Math.random(), speed: Math.random() * 0.004 + 0.002 });
        }
      }
      draw() {
        const dx = this.b.x - this.a.x;
        const dy = this.b.y - this.a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 280;
        if (dist > maxDist) return;
        const alpha = (1 - dist / maxDist) * 0.12;
        ctx!.beginPath();
        ctx!.moveTo(this.a.x, this.a.y);
        ctx!.lineTo(this.b.x, this.b.y);
        ctx!.strokeStyle = `rgba(${green[0]},${green[1]},${green[2]},${alpha})`;
        ctx!.lineWidth = 0.8;
        ctx!.shadowBlur = 0;
        ctx!.stroke();
        this.flowDots.forEach(d => {
          d.pos += d.speed;
          if (d.pos > 1) d.pos = 0;
          const fx = this.a.x + dx * d.pos;
          const fy = this.a.y + dy * d.pos;
          ctx!.beginPath();
          ctx!.arc(fx, fy, 1.5, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(${green[0]},${green[1]},${green[2]},${alpha * 3})`;
          ctx!.fill();
        });
      }
    }

    class Ring {
      x: number; y: number; r: number; maxR: number;
      opacity: number; speed: number;
      constructor() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.r = 0;
        this.maxR = Math.random() * 80 + 40;
        this.opacity = Math.random() * 0.06 + 0.03;
        this.speed = Math.random() * 0.3 + 0.15;
      }
      update() {
        this.r += this.speed;
        if (this.r > this.maxR) {
          this.r = 0;
          this.x = Math.random() * w;
          this.y = Math.random() * h;
        }
      }
      draw() {
        const alpha = this.opacity * (1 - this.r / this.maxR);
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(${green[0]},${green[1]},${green[2]},${alpha})`;
        ctx!.lineWidth = 0.6;
        ctx!.shadowBlur = 0;
        ctx!.stroke();
      }
    }

    function drawGrid() {
      ctx!.shadowBlur = 0;
      const gridSize = 80;
      ctx!.strokeStyle = `rgba(${green[0]},${green[1]},${green[2]},0.02)`;
      ctx!.lineWidth = 0.5;
      for (let x = 0; x < w; x += gridSize) { ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, h); ctx!.stroke(); }
      for (let y = 0; y < h; y += gridSize) { ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(w, y); ctx!.stroke(); }
    }

    const nodes: Node[] = [];
    const connections: Connection[] = [];
    const rings: Ring[] = [];

    function initElements() {
      nodes.length = 0; connections.length = 0; rings.length = 0;
      const nodePositions = [
        { x: w * 0.1, y: h * 0.2, r: 5, o: 0.3 },
        { x: w * 0.25, y: h * 0.15, r: 4, o: 0.25 },
        { x: w * 0.4, y: h * 0.3, r: 6, o: 0.35 },
        { x: w * 0.55, y: h * 0.1, r: 3.5, o: 0.2 },
        { x: w * 0.7, y: h * 0.25, r: 5, o: 0.3 },
        { x: w * 0.85, y: h * 0.15, r: 4, o: 0.22 },
        { x: w * 0.15, y: h * 0.5, r: 4.5, o: 0.28 },
        { x: w * 0.35, y: h * 0.55, r: 5.5, o: 0.32 },
        { x: w * 0.5, y: h * 0.45, r: 7, o: 0.4 },
        { x: w * 0.65, y: h * 0.5, r: 4, o: 0.25 },
        { x: w * 0.8, y: h * 0.45, r: 5, o: 0.3 },
        { x: w * 0.9, y: h * 0.6, r: 3.5, o: 0.2 },
        { x: w * 0.08, y: h * 0.75, r: 4, o: 0.22 },
        { x: w * 0.3, y: h * 0.8, r: 5, o: 0.3 },
        { x: w * 0.45, y: h * 0.7, r: 4.5, o: 0.28 },
        { x: w * 0.6, y: h * 0.75, r: 6, o: 0.35 },
        { x: w * 0.75, y: h * 0.7, r: 3.5, o: 0.2 },
        { x: w * 0.92, y: h * 0.85, r: 4, o: 0.22 },
        { x: w * 0.2, y: h * 0.4, r: 3, o: 0.18 },
        { x: w * 0.5, y: h * 0.88, r: 4, o: 0.25 },
      ];
      nodePositions.forEach(n => nodes.push(new Node(n.x, n.y, n.r, n.o)));
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].baseX - nodes[j].baseX;
          const dy = nodes[i].baseY - nodes[j].baseY;
          if (Math.sqrt(dx * dx + dy * dy) < 280) {
            connections.push(new Connection(nodes[i], nodes[j]));
          }
        }
      }
      for (let i = 0; i < 8; i++) rings.push(new Ring());
    }

    resize();
    initElements();

    const handleResize = () => { resize(); initElements(); };
    window.addEventListener("resize", handleResize);

    let t = 0;
    function animate() {
      ctx!.clearRect(0, 0, w, h);
      t++;
      drawGrid();
      rings.forEach(r => { r.update(); r.draw(); });
      connections.forEach(c => c.draw());
      nodes.forEach(n => { n.update(t); n.draw(t); });
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

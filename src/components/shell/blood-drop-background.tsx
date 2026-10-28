"use client";

import { useEffect, useRef } from "react";

interface Droplet {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  acceleration: number;
  alpha: number;
  layer: number; // 0: background/blurry, 1: midground, 2: foreground/crisp
  wobble: number;
  wobbleSpeed: number;
  stretch: number;
  isForming: boolean;
  formProgress: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export function BloodDropBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rawCtx = canvas.getContext("2d", { alpha: true });
    if (!rawCtx) return;
    const ctx = rawCtx;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Respect reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const droplets: Droplet[] = [];
    const ripples: Ripple[] = [];

    // Realistic density across viewport
    const maxDroplets = Math.min(26, Math.max(14, Math.floor(width / 65)));

    function createDroplet(startY?: number): Droplet {
      const layer = Math.random() < 0.25 ? 0 : Math.random() < 0.6 ? 1 : 2;

      let baseWidth = 16;
      let alpha = 0.85;
      let baseSpeed = 2.4;

      if (layer === 0) {
        // Far background - smaller, softer
        baseWidth = 10 + Math.random() * 6;
        alpha = 0.45 + Math.random() * 0.15;
        baseSpeed = 1.4 + Math.random() * 0.8;
      } else if (layer === 1) {
        // Midground
        baseWidth = 16 + Math.random() * 8;
        alpha = 0.75 + Math.random() * 0.15;
        baseSpeed = 2.4 + Math.random() * 1.2;
      } else {
        // Foreground - rich, glossy, prominent teardrops
        baseWidth = 24 + Math.random() * 12;
        alpha = 0.9 + Math.random() * 0.1;
        baseSpeed = 3.6 + Math.random() * 1.6;
      }

      const dropletHeight = baseWidth * 2.1; // realistic elongated teardrop ratio
      const isTopDrip = Math.random() < 0.35 && (startY === undefined || startY < 0);

      return {
        x: Math.random() * width,
        y: startY !== undefined ? startY : Math.random() * height,
        width: baseWidth,
        height: dropletHeight,
        speed: isTopDrip ? 0.4 : baseSpeed,
        acceleration: 0.08 + Math.random() * 0.06,
        alpha,
        layer,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.03 + Math.random() * 0.04,
        stretch: 1,
        isForming: isTopDrip,
        formProgress: isTopDrip ? 0.2 : 1,
      };
    }

    for (let i = 0; i < maxDroplets; i++) {
      droplets.push(createDroplet());
    }

    function drawTeardrop(
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      rawW: number,
      rawH: number,
      alpha: number,
      stretch: number,
      layer: number
    ) {
      const w = Math.max(4, Math.abs(rawW));
      const h = Math.max(8, Math.abs(rawH));

      context.save();
      context.translate(x, y);
      context.scale(1, Math.max(0.85, Math.min(1.45, stretch)));
      context.globalAlpha = Math.max(0.1, Math.min(1, alpha));

      if (layer === 0) {
        context.filter = "blur(1.2px)";
      }

      const w2 = w / 2;
      const bulbRadius = w2;
      const apexY = -h * 0.52;
      const bulbCenterY = h * 0.26;

      // 1. Natural surface tension teardrop geometry
      context.beginPath();
      context.moveTo(0, apexY);
      context.bezierCurveTo(w2 * 0.14, apexY + h * 0.32, w2, bulbCenterY - bulbRadius * 0.35, w2, bulbCenterY);
      context.arc(0, bulbCenterY, bulbRadius, 0, Math.PI, false);
      context.bezierCurveTo(-w2, bulbCenterY - bulbRadius * 0.35, -w2 * 0.14, apexY + h * 0.32, 0, apexY);
      context.closePath();

      // 2. Base arterial blood radial gradient
      const bodyGrad = context.createRadialGradient(
        -w2 * 0.2,
        bulbCenterY - bulbRadius * 0.15,
        Math.max(1, bulbRadius * 0.15),
        0,
        bulbCenterY,
        Math.max(2, bulbRadius * 1.55)
      );
      bodyGrad.addColorStop(0, "#FF1A3D");    // brilliant bright ruby core
      bodyGrad.addColorStop(0.35, "#D80024");  // rich arterial red
      bodyGrad.addColorStop(0.75, "#8A0016");  // deep oxblood
      bodyGrad.addColorStop(1, "#44000D");     // dark rich crimson rim

      context.fillStyle = bodyGrad;
      context.shadowColor = "rgba(120, 0, 20, 0.45)";
      context.shadowBlur = w * 0.5;
      context.shadowOffsetY = h * 0.08;
      context.fill();

      context.shadowColor = "transparent";
      context.shadowBlur = 0;

      // 3. Realistic lower-left bright specular highlight (as seen in user's image)
      context.beginPath();
      context.ellipse(
        -w2 * 0.32,
        bulbCenterY + bulbRadius * 0.28,
        Math.max(1, Math.abs(w2 * 0.36)),
        Math.max(1, Math.abs(bulbRadius * 0.24)),
        -Math.PI / 7,
        0,
        Math.PI * 2
      );
      const specGrad = context.createLinearGradient(
        -w2 * 0.6,
        bulbCenterY,
        0,
        bulbCenterY + bulbRadius * 0.6
      );
      specGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      specGrad.addColorStop(0.45, "rgba(255, 220, 230, 0.7)");
      specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = specGrad;
      context.fill();

      // 4. Secondary delicate rim glow along right side (subsurface scattering)
      context.beginPath();
      context.ellipse(
        w2 * 0.44,
        bulbCenterY + bulbRadius * 0.1,
        Math.max(1, Math.abs(w2 * 0.16)),
        Math.max(1, Math.abs(bulbRadius * 0.4)),
        Math.PI / 10,
        0,
        Math.PI * 2
      );
      const rimGrad = context.createLinearGradient(
        w2 * 0.1,
        bulbCenterY,
        w2 * 0.65,
        bulbCenterY
      );
      rimGrad.addColorStop(0, "rgba(255, 120, 140, 0)");
      rimGrad.addColorStop(1, "rgba(255, 190, 210, 0.6)");
      context.fillStyle = rimGrad;
      context.fill();

      // 5. Glossy vertical spine reflection tapering to apex
      context.beginPath();
      context.ellipse(
        -w2 * 0.14,
        apexY + h * 0.38,
        Math.max(1, Math.abs(w2 * 0.15)),
        Math.max(1, Math.abs(h * 0.22)),
        -Math.PI / 22,
        0,
        Math.PI * 2
      );
      const spineGrad = context.createLinearGradient(
        -w2 * 0.25,
        apexY,
        0,
        apexY + h * 0.55
      );
      spineGrad.addColorStop(0, "rgba(255, 255, 255, 0.88)");
      spineGrad.addColorStop(0.6, "rgba(255, 180, 195, 0.4)");
      spineGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = spineGrad;
      context.fill();

      context.restore();
    }

    function drawRipples(context: CanvasRenderingContext2D) {
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += 0.95;
        r.alpha -= 0.015;

        if (r.alpha <= 0 || r.radius >= r.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        context.save();
        context.beginPath();
        context.ellipse(
          r.x,
          r.y,
          Math.max(1, Math.abs(r.radius)),
          Math.max(0.5, Math.abs(r.radius * 0.35)),
          0,
          0,
          Math.PI * 2
        );
        context.strokeStyle = `rgba(180, 0, 30, ${Math.max(0, r.alpha * 0.6)})`;
        context.lineWidth = 1.6;
        context.stroke();
        context.restore();
      }
    }

    // Animation Loop
    let lastTime = performance.now();

    function render(currentTime: number) {
      const delta = Math.min((currentTime - lastTime) / 16.67, 2.5);
      lastTime = currentTime;

      ctx.clearRect(0, 0, width, height);

      // Render ripples at bottom
      drawRipples(ctx);

      // Render and update each droplet
      for (let i = 0; i < droplets.length; i++) {
        const d = droplets[i];

        d.wobble += d.wobbleSpeed * delta;
        const wobbleOffset = Math.sin(d.wobble) * (d.layer === 2 ? 0.7 : 0.35);

        if (d.isForming) {
          // Top ceiling gather and drip formation
          d.formProgress += 0.012 * delta;
          const currentH = d.height * Math.min(1, Math.max(0.2, d.formProgress));
          const currentW = d.width * (0.6 + 0.4 * Math.min(1, d.formProgress));

          drawTeardrop(
            ctx,
            d.x,
            currentH * 0.4,
            currentW,
            currentH,
            d.alpha * Math.min(1, d.formProgress * 1.5),
            1.1,
            d.layer
          );

          if (d.formProgress >= 1) {
            d.isForming = false;
            d.speed = 1.2;
          }
          continue;
        }

        // Falling physics
        d.speed += d.acceleration * delta;
        d.y += d.speed * delta;
        d.x += wobbleOffset * 0.25;

        // Dynamic stretch based on velocity
        d.stretch = 1 + Math.min(d.speed * 0.025, 0.35);

        drawTeardrop(ctx, d.x, d.y, d.width, d.height, d.alpha, d.stretch, d.layer);

        // When droplet hits bottom, trigger subtle ripple and reset
        if (d.y - d.height > height) {
          if (d.layer >= 1 && Math.random() < 0.65) {
            ripples.push({
              x: d.x,
              y: height - 12,
              radius: 4,
              maxRadius: d.width * 2.8,
              alpha: d.alpha * 0.8,
            });
          }
          droplets[i] = createDroplet(-d.height * 1.5);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    }

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-85 transition-opacity duration-1000"
      style={{ willChange: "transform" }}
    />
  );
}

"use client";

import { useState, useRef } from "react";
import { motion, useSpring, useMotionValue, useTransform } from "motion/react";

interface InteractiveBloodDropProps {
  className?: string;
  size?: "small" | "medium" | "large";
}

export function InteractiveBloodDrop({
  className = "",
  size = "medium",
}: InteractiveBloodDropProps) {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Motion values for fluid mouse tracking and rolling
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth physics springs for organic liquid feel
  const springConfig = { damping: 18, stiffness: 180, mass: 0.6 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Roll tilt based on cursor movement
  const rollRotate = useTransform(smoothX, [-60, 60], [-18, 18]);

  // Dimension scaling
  const dimensions = {
    small: { w: 46, h: 80 },
    medium: { w: 64, h: 112 },
    large: { w: 84, h: 148 },
  }[size];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-flex items-center justify-center cursor-pointer select-none ${className}`}
      style={{
        width: dimensions.w + 40,
        height: dimensions.h + 40,
      }}
      aria-label="Interactive blood droplet"
      role="img"
    >
      {/* Ambient Red Glow Behind Drop */}
      <motion.div
        className="pointer-events-none absolute rounded-full bg-red-600/25 blur-xl"
        style={{
          width: dimensions.w * 1.4,
          height: dimensions.h * 1.1,
        }}
        animate={{
          scale: isHovered ? [1.2, 1.4, 1.25] : [0.9, 1.05, 0.9],
          opacity: isHovered ? 0.65 : 0.35,
        }}
        transition={{
          duration: isHovered ? 1.5 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Main Liquid Droplet with Fluid Hover Zoom & Roll */}
      <motion.div
        className="relative"
        style={{
          width: dimensions.w,
          height: dimensions.h,
          rotate: isHovered ? rollRotate : undefined,
          transformOrigin: "center 70%",
        }}
        animate={
          isHovered
            ? {
                scale: 1.35, // Zooms in on hover
                y: -6,
                transition: { type: "spring", stiffness: 260, damping: 15 },
              }
            : {
                scale: 1, // Shrinks back to normal size
                y: [0, -8, 0], // Gentle idle floating bob
                rotate: [-4, 4, -4], // Idle liquid rolling sway in place
                transition: {
                  y: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
                  rotate: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
                  scale: { type: "spring", stiffness: 200, damping: 20 },
                },
              }
        }
      >
        {/* Organic Surface Tension Liquid Breathing */}
        <motion.div
          className="h-full w-full"
          animate={
            isHovered
              ? {
                  scaleX: [1, 1.06, 0.96, 1],
                  scaleY: [1, 0.95, 1.05, 1],
                }
              : {
                  scaleX: [0.98, 1.02, 0.98],
                  scaleY: [1.02, 0.98, 1.02],
                }
          }
          transition={{
            duration: isHovered ? 1.6 : 3.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <svg
            viewBox="0 0 100 175"
            className="h-full w-full filter drop-shadow-[0_12px_16px_rgba(110,0,18,0.45)]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Arterial Blood Core Gradient */}
              <radialGradient
                id="bloodCoreGrad"
                cx="38%"
                cy="62%"
                r="65%"
                fx="32%"
                fy="56%"
              >
                <stop offset="0%" stopColor="#FF1840" />
                <stop offset="28%" stopColor="#DF0026" />
                <stop offset="68%" stopColor="#8A0017" />
                <stop offset="92%" stopColor="#4A000E" />
                <stop offset="100%" stopColor="#2D0008" />
              </radialGradient>

              {/* Lower-left primary specular highlight gradient (matching user image) */}
              <linearGradient
                id="primaryGloss"
                x1="0%"
                y1="20%"
                x2="85%"
                y2="90%"
              >
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
                <stop offset="40%" stopColor="#FFDEE5" stopOpacity="0.82" />
                <stop offset="75%" stopColor="#FF8598" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#FF1A3D" stopOpacity="0" />
              </linearGradient>

              {/* Secondary Subsurface Rim Reflection (Right Side) */}
              <linearGradient
                id="rimGlow"
                x1="0%"
                y1="50%"
                x2="100%"
                y2="50%"
              >
                <stop offset="0%" stopColor="#FF6680" stopOpacity="0" />
                <stop offset="70%" stopColor="#FFA6B8" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.75" />
              </linearGradient>

              {/* Neck & Spine Glint */}
              <linearGradient
                id="spineGlint"
                x1="30%"
                y1="0%"
                x2="60%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#FFD1DA" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#FF3355" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* 1. Base 3D Teardrop Silhouette */}
            <path
              d="M 50,5
                 C 53,28 72,68 85,98
                 C 96,122 93,148 76,163
                 C 61,176 39,176 24,163
                 C 7,148 4,122 15,98
                 C 28,68 47,28 50,5 Z"
              fill="url(#bloodCoreGrad)"
            />

            {/* 2. Deep Subsurface Shadow on Back Rim */}
            <path
              d="M 50,8
                 C 53,30 71,69 83,98
                 C 93,121 90,146 75,160
                 C 65,170 48,173 34,168
                 C 52,168 76,155 78,132
                 C 80,108 68,76 50,8 Z"
              fill="#220005"
              opacity="0.55"
            />

            {/* 3. Primary Specular Arc (The Glossy Lower-Left Reflection) */}
            <path
              d="M 23,126
                 C 21,138 27,152 38,158
                 C 43,161 47,157 44,153
                 C 37,146 32,136 34,124
                 C 34,120 25,120 23,126 Z"
              fill="url(#primaryGloss)"
            />

            {/* Brightest Specular Hotspot on Lower Left Belly */}
            <ellipse
              cx="33"
              cy="142"
              rx="9"
              ry="16"
              transform="rotate(-25 33 142)"
              fill="#FFFFFF"
              opacity="0.95"
            />

            {/* Soft Secondary Reflection on Bottom Rim */}
            <path
              d="M 38,162
                 C 48,166 58,165 68,159
                 C 65,156 50,158 40,157
                 Z"
              fill="#FFA8B8"
              opacity="0.5"
            />

            {/* 4. Subsurface Rim Light Along Right Curve */}
            <path
              d="M 83,105
                 C 89,122 88,142 77,154
                 C 79,146 81,128 76,112
                 C 74,106 81,100 83,105 Z"
              fill="url(#rimGlow)"
            />

            {/* 5. Delicate Gleam along the Upper Droplet Spine */}
            <path
              d="M 48,22
                 C 47,42 42,65 37,86
                 C 35,92 41,94 43,88
                 C 47,70 52,48 51,22
                 C 51,18 48,18 48,22 Z"
              fill="url(#spineGlint)"
            />

            {/* Fine Apex Highlight Point */}
            <ellipse
              cx="49.5"
              cy="14"
              rx="1.8"
              ry="4"
              fill="#FFFFFF"
              opacity="0.8"
            />
          </svg>
        </motion.div>
      </motion.div>

      {/* Interactive Tooltip on Hover */}
      <motion.div
        className="pointer-events-none absolute -bottom-4 z-20 whitespace-nowrap rounded bg-charcoal/90 px-2.5 py-1 text-[11px] font-medium text-ivory shadow-md backdrop-blur-sm"
        initial={{ opacity: 0, y: 6, scale: 0.9 }}
        animate={{
          opacity: isHovered ? 1 : 0,
          y: isHovered ? 0 : 6,
          scale: isHovered ? 1 : 0.9,
        }}
        transition={{ duration: 0.2 }}
      >
        Every drop counts · Roll &amp; explore
      </motion.div>
    </div>
  );
}

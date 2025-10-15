'use client'

import React, { useRef, useEffect, useCallback } from 'react';

type PixelBlastVariant = 'square' | 'circle' | 'triangle' | 'diamond';

type PixelBlastProps = {
  variant?: PixelBlastVariant;
  pixelSize?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  patternScale?: number;
  patternDensity?: number;
  liquid?: boolean;
  liquidStrength?: number;
  liquidRadius?: number;
  pixelSizeJitter?: number;
  enableRipples?: boolean;
  rippleIntensityScale?: number;
  rippleThickness?: number;
  rippleSpeed?: number;
  liquidWobbleSpeed?: number;
  speed?: number;
  transparent?: boolean;
  edgeFade?: number;
};

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
}

const PixelBlast: React.FC<PixelBlastProps> = ({
  variant = 'circle',
  pixelSize = 6,
  color = '#B19EEF',
  className,
  style,
  patternScale = 3,
  patternDensity = 1.2,
  pixelSizeJitter = 0.5,
  enableRipples = true,
  rippleSpeed = 0.4,
  rippleThickness = 0.12,
  rippleIntensityScale = 1.5,
  liquid = true,
  liquidStrength = 0.12,
  liquidRadius = 1.2,
  liquidWobbleSpeed = 5,
  speed = 0.6,
  edgeFade = 0.25,
  transparent = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const ripplesRef = useRef<Ripple[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);

  // Draw pixel shape
  const drawPixel = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    opacity: number
  ) => {
    ctx.globalAlpha = opacity;
    
    switch (variant) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'square':
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        break;
      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(x, y - size / 2);
        ctx.lineTo(x + size / 2, y + size / 2);
        ctx.lineTo(x - size / 2, y + size / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(x, y - size / 2);
        ctx.lineTo(x + size / 2, y);
        ctx.lineTo(x, y + size / 2);
        ctx.lineTo(x - size / 2, y);
        ctx.closePath();
        ctx.fill();
        break;
    }
  };

  // Animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    if (transparent) {
      ctx.clearRect(0, 0, width, height);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
    }

    timeRef.current += speed * 0.016;

    // Update ripples
    if (enableRipples) {
      ripplesRef.current = ripplesRef.current.filter(ripple => {
        ripple.radius += ripple.speed;
        return ripple.radius < ripple.maxRadius;
      });
    }

    // Draw pixels
    const spacing = pixelSize * patternScale;
    const cols = Math.ceil(width / spacing) + 2;
    const rows = Math.ceil(height / spacing) + 2;

    ctx.fillStyle = color;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let x = i * spacing;
        let y = j * spacing;

        // Add liquid wobble effect
        if (liquid) {
          const wobbleX = Math.sin(timeRef.current * liquidWobbleSpeed + i * 0.5) * liquidStrength * spacing;
          const wobbleY = Math.cos(timeRef.current * liquidWobbleSpeed + j * 0.5) * liquidStrength * spacing;
          x += wobbleX;
          y += wobbleY;
        }

        // Calculate distance from mouse for liquid distortion
        const dx = x - mouseRef.current.x;
        const dy = y - mouseRef.current.y;
        const distFromMouse = Math.sqrt(dx * dx + dy * dy);
        const liquidRadiusPx = liquidRadius * spacing * 3;

        if (liquid && distFromMouse < liquidRadiusPx) {
          const force = (1 - distFromMouse / liquidRadiusPx) * liquidStrength * spacing * 2;
          x += (dx / distFromMouse) * force;
          y += (dy / distFromMouse) * force;
        }

        // Calculate base opacity
        let opacity = patternDensity;

        // Apply edge fade
        if (edgeFade > 0) {
          const fadeDistance = Math.min(width, height) * edgeFade;
          const distFromEdgeX = Math.min(x, width - x);
          const distFromEdgeY = Math.min(y, height - y);
          const distFromEdge = Math.min(distFromEdgeX, distFromEdgeY);
          const fadeFactor = Math.min(1, distFromEdge / fadeDistance);
          opacity *= fadeFactor;
        }

        // Apply ripple effects
        if (enableRipples) {
          ripplesRef.current.forEach(ripple => {
            const dx = x - ripple.x;
            const dy = y - ripple.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const rippleWidth = ripple.maxRadius * rippleThickness;
            
            if (Math.abs(dist - ripple.radius) < rippleWidth) {
              const rippleIntensity = (1 - Math.abs(dist - ripple.radius) / rippleWidth) * rippleIntensityScale;
              opacity *= (1 + rippleIntensity);
            }
          });
        }

        // Add pixel size jitter
        const jitter = pixelSizeJitter > 0 
          ? 1 + (Math.sin(timeRef.current + i * 0.5 + j * 0.5) * pixelSizeJitter * 0.5)
          : 1;
        const currentPixelSize = pixelSize * jitter;

        // Clamp opacity
        opacity = Math.max(0, Math.min(1, opacity));

        if (opacity > 0.01) {
          drawPixel(ctx, x, y, currentPixelSize, opacity);
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [
    variant,
    pixelSize,
    color,
    patternScale,
    patternDensity,
    pixelSizeJitter,
    enableRipples,
    rippleSpeed,
    rippleThickness,
    rippleIntensityScale,
    liquid,
    liquidStrength,
    liquidRadius,
    liquidWobbleSpeed,
    speed,
    edgeFade,
    transparent
  ]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }, []);

  // Handle mouse click for ripples
  const handleClick = useCallback((e: MouseEvent) => {
    if (!enableRipples) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ripplesRef.current.push({
      x,
      y,
      radius: 0,
      maxRadius: Math.max(canvas.width, canvas.height) * 0.8,
      speed: rippleSpeed * 10
    });
  }, [enableRipples, rippleSpeed]);

  // Setup canvas and resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    // Start animation
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate, handleMouseMove, handleClick]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden ${className ?? ''}`}
      style={style}
      aria-label="PixelBlast interactive background"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default PixelBlast;

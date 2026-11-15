import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  targetAlpha: number;
  twinkleSpeed: number;
  color: string;
}

interface Meteor {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  alpha: number;
  active: boolean;
}

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initStars();
    };
    window.addEventListener("resize", handleResize);

    const starColors = ["#ffffff", "#e0f2fe", "#7dd3fc", "#fef08a", "#a5f3fc", "#c4b5fd"];
    let stars: Star[] = [];

    const initStars = () => {
      const count = Math.floor((width * height) / 3600); // responsive star count
      stars = Array.from({ length: Math.min(count, 350) }, () => {
        const radius = Math.random() < 0.85 ? Math.random() * 0.9 + 0.3 : Math.random() * 1.5 + 0.9;
        const alpha = Math.random() * 0.7 + 0.2;
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          radius,
          alpha,
          targetAlpha: alpha,
          twinkleSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() < 0.5 ? 1 : -1),
          color: starColors[Math.floor(Math.random() * starColors.length)],
        };
      });
    };
    initStars();

    // Meteors
    let meteors: Meteor[] = [];
    let lastMeteorTime = Date.now();

    const spawnMeteor = () => {
      meteors.push({
        x: Math.random() * width * 0.8 + width * 0.1,
        y: Math.random() * height * 0.4,
        length: Math.random() * 80 + 40,
        speed: Math.random() * 8 + 6,
        angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1),
        alpha: 1,
        active: true,
      });
    };

    let lastFrame = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;

      ctx.clearRect(0, 0, width, height);

      // Render stars
      for (const s of stars) {
        s.alpha += s.twinkleSpeed;
        if (s.alpha > 0.95 || s.alpha < 0.15) {
          s.twinkleSpeed = -s.twinkleSpeed;
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0.05, Math.min(1, s.alpha));
        ctx.fill();

        // Extra glow for brighter stars
        if (s.radius > 1.2) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = Math.max(0.02, s.alpha * 0.15);
          ctx.fill();
        }
      }

      // Random meteor spawn (every 6-12 seconds)
      const currentTime = Date.now();
      if (currentTime - lastMeteorTime > 8000 && Math.random() < 0.03) {
        spawnMeteor();
        lastMeteorTime = currentTime;
      }

      // Render meteors
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        if (!m.active) {
          meteors.splice(i, 1);
          continue;
        }

        const tailX = m.x - Math.cos(m.angle) * m.length;
        const tailY = m.y - Math.sin(m.angle) * m.length;

        const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, `rgba(125, 232, 255, ${m.alpha})`);
        grad.addColorStop(0.3, `rgba(56, 200, 248, ${m.alpha * 0.7})`);
        grad.addColorStop(1, "rgba(56, 200, 248, 0)");

        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = m.alpha;
        ctx.stroke();

        m.x += Math.cos(m.angle) * m.speed;
        m.y += Math.sin(m.angle) * m.speed;
        m.alpha -= 0.015;

        if (m.alpha <= 0 || m.x > width || m.y > height) {
          m.active = false;
        }
      }

      ctx.globalAlpha = 1.0;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas id="starfield" ref={canvasRef} aria-hidden="true" />;
}

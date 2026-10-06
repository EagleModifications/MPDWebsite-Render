import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { WheelEntry } from "./types";

export type WheelHandle = {
  spin: () => void;
};

type WheelProps = {
  entries: WheelEntry[];
  spinning: boolean;
  onSpinStart?: () => void;
  onWinner: (winner: WheelEntry, index: number) => void;
};

const TAU = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2;

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

export const Wheel = forwardRef<WheelHandle, WheelProps>(
  ({ entries, spinning, onSpinStart, onWinner }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rotationRef = useRef(0);
    const animationRef = useRef<number | null>(null);
    const [size, setSize] = useState(620);

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(240, rect.width);
      const height = Math.max(240, rect.height);
      const diameter = Math.min(width, height);
      const radius = diameter / 2;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, width / 2, height / 2);
      ctx.clearRect(-width / 2, -height / 2, width, height);

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius - 5, 0, TAU);
      ctx.shadowColor = "rgba(0,0,0,.35)";
      ctx.shadowBlur = 22;
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();

      if (!entries.length) {
        ctx.beginPath();
        ctx.arc(0, 0, radius - 7, 0, TAU);
        ctx.fillStyle = "#e5e7eb";
        ctx.fill();

        ctx.fillStyle = "#6b7280";
        ctx.font = "600 20px Quicksand, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Add entries to spin", 0, 0);
        return;
      }

      const slice = TAU / entries.length;

      ctx.save();
      ctx.rotate(rotationRef.current);

      entries.forEach((entry, index) => {
        const start = index * slice;
        const end = start + slice;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius - 8, start, end);
        ctx.closePath();
        ctx.fillStyle = entry.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.95)";
        ctx.lineWidth = Math.max(1, radius / 220);
        ctx.stroke();

        const mid = start + slice / 2;
        ctx.save();
        ctx.rotate(mid);
        ctx.translate(Math.max(70, radius * 0.64), 0);
        ctx.rotate(Math.PI / 2);

        const fontSize = Math.max(
          10,
          Math.min(22, radius * 0.075, 270 / Math.max(1, entries.length)),
        );

        ctx.font = `700 ${fontSize}px Quicksand, Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const maxTextWidth = Math.max(35, radius * 0.48);
        const label = fitText(ctx, entry.text || " ", maxTextWidth);

        ctx.lineWidth = Math.max(3, fontSize * 0.18);
        ctx.strokeStyle = "rgba(0,0,0,.18)";
        ctx.strokeText(label, 0, 0);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, 0, 0);
        ctx.restore();
      });

      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.115, 0, TAU);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,.25)";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.restore();
    };

    useEffect(() => {
      const resize = () => {
        const parent = canvasRef.current?.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        setSize(Math.max(240, Math.min(rect.width, rect.height || rect.width)));
      };

      resize();
      const observer = new ResizeObserver(resize);
      if (canvasRef.current?.parentElement) {
        observer.observe(canvasRef.current.parentElement);
      }
      window.addEventListener("resize", resize);

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", resize);
      };
    }, []);

    useEffect(() => {
      draw();
    }, [entries, size]);

    useImperativeHandle(ref, () => ({
      spin() {
        if (spinning || entries.length === 0) return;

        onSpinStart?.();

        const winnerIndex = Math.floor(Math.random() * entries.length);
        const slice = TAU / entries.length;

        // Land the centre of the chosen slice under the top pointer.
        const targetSliceCenter = winnerIndex * slice + slice / 2;
        const target =
          POINTER_ANGLE - targetSliceCenter + TAU * (6 + Math.random() * 2);

        const startRotation = rotationRef.current;
        const delta =
          ((target - startRotation) % TAU + TAU) % TAU +
          TAU * 5;
        const duration = 5000;
        const startTime = performance.now();

        const tick = new Audio("/sounds/misc-spin/tick.mp3");
        tick.volume = 0.2;

        let lastIndex = -1;

        const animate = (now: number) => {
          const progress = Math.min(1, (now - startTime) / duration);
          const eased = 1 - Math.pow(1 - progress, 4);

          rotationRef.current = startRotation + delta * eased;

          const currentIndex =
            Math.floor(
              (((POINTER_ANGLE - rotationRef.current) % TAU + TAU) % TAU) /
                slice,
            );

          if (currentIndex !== lastIndex && progress < 0.96) {
            lastIndex = currentIndex;
            tick.currentTime = 0;
            void tick.play().catch(() => {});
          }

          draw();

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
            return;
          }

          rotationRef.current =
            ((rotationRef.current % TAU) + TAU) % TAU;

          animationRef.current = null;
          const winner = entries[winnerIndex];
          const winSound = new Audio(
            "/sounds/after-spin/game-win-ding.mp3",
          );
          winSound.volume = 0.65;
          void winSound.play().catch(() => {});

          onWinner(winner, winnerIndex);
        };

        animationRef.current = requestAnimationFrame(animate);
      },
    }));

    useEffect(() => {
      return () => {
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, []);

    return (
      <div className="relative flex h-full min-h-[min(72vh,760px)] w-full items-center justify-center">
        <canvas
          ref={canvasRef}
          aria-label="Random selection wheel"
          className="aspect-square h-auto w-full max-w-[min(82vh,760px)] touch-none select-none"
          style={{ width: size, height: size }}
        />

        <div
          className="pointer-events-none absolute left-1/2 top-[1%] z-10 -translate-x-1/2"
          aria-hidden="true"
        >
          <div
            className="h-0 w-0 border-l-[19px] border-r-[19px] border-t-[42px] border-l-transparent border-r-transparent drop-shadow-[0_3px_3px_rgba(0,0,0,.35)]"
            style={{ borderTopColor: "#333" }}
          />
        </div>
      </div>
    );
  },
);

Wheel.displayName = "Wheel";

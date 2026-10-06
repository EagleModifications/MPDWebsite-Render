import { useEffect, useMemo, useRef, useState } from "react";
import type { WheelConfig, WheelEntry } from "@/pages/SpinWheel";

const TAU = Math.PI * 2;

function pickWeighted(entries: WheelEntry[]) {
  return entries[Math.floor(Math.random() * entries.length)];
}

export function Wheel({
  config,
  muted,
  onWinner,
  onMute,
}: {
  config: WheelConfig;
  muted: boolean;
  onWinner: (entry: WheelEntry) => void;
  onMute: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const frameRef = useRef<number | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tickRef = useRef<AudioContext | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [pointerColor, setPointerColor] = useState("#1976d2");

  const entries = useMemo(
    () => config.entries.filter((entry) => entry.text.trim()),
    [config.entries],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      draw();
    };

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const size = Math.min(canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = size * 0.475;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (config.drawShadow) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,.28)";
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, TAU);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.restore();
      }

      if (!entries.length) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, TAU);
        ctx.fillStyle = "#cccccc";
        ctx.fill();
      } else {
        const slice = TAU / entries.length;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotationRef.current);

        entries.forEach((entry, index) => {
          const start = -Math.PI / 2 + index * slice;
          const end = start + slice;

          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, radius, start, end);
          ctx.closePath();
          ctx.fillStyle = entry.color || "#cccccc";
          ctx.fill();

          if (config.drawOutlines) {
            ctx.strokeStyle = "rgba(0,0,0,.35)";
            ctx.lineWidth = Math.max(1, size * 0.003);
            ctx.stroke();
          }

          const labelAngle = start + slice / 2;
          const labelRadius = radius * 0.62;
          const maxChars = Math.max(8, Math.floor(34 / Math.max(1, entries.length / 8)));
          const text = entry.text.length > maxChars ? `${entry.text.slice(0, maxChars - 1)}…` : entry.text;

          ctx.save();
          ctx.rotate(labelAngle);
          ctx.translate(labelRadius, 0);
          ctx.rotate(Math.PI / 2);
          ctx.fillStyle = "#111";
          ctx.font = `600 ${Math.max(12, Math.min(28, radius * 0.055))}px Quicksand, Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, 0, 0);
          ctx.restore();
        });

        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, TAU);
      ctx.lineWidth = Math.max(2, size * 0.006);
      ctx.strokeStyle = "rgba(0,0,0,.12)";
      ctx.stroke();

      // Wheel of Names-style hub.
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.115, 0, TAU);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.lineWidth = Math.max(2, size * 0.005);
      ctx.strokeStyle = "rgba(0,0,0,.12)";
      ctx.stroke();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [config, entries]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const update = () => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const radius = Math.min(rect.width, rect.height) * 0.475;
      const pointerAngle = -Math.PI / 2 - rotationRef.current;
      const normalized = ((pointerAngle + TAU) % TAU) / TAU;
      const index = Math.floor(normalized * Math.max(1, entries.length));
      const entry = entries[index % Math.max(1, entries.length)];
      if (entry?.color) setPointerColor(entry.color);
      void cx; void cy; void radius;
    };
    update();
  }, [entries, rotationRef]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      audioRef.current?.pause();
      tickRef.current?.close().catch(() => undefined);
    };
  }, []);

  const tick = () => {
    if (muted || !config.duringSpinSound) return;
    try {
      if (!tickRef.current) tickRef.current = new AudioContext();
      const ctx = tickRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 950;
      gain.gain.setValueAtTime(Math.max(0.01, config.duringSpinSoundVolume / 1000), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch {
      // Audio can be blocked until a user gesture.
    }
  };

  const spin = () => {
    if (spinning || !entries.length) return;
    setSpinning(true);

    const winner = pickWeighted(entries);
    const winnerIndex = entries.findIndex((entry) => entry.id === winner.id);
    const slice = TAU / entries.length;

    // Pointer is at -90°. Land the chosen segment center under it.
    const targetCenter = -Math.PI / 2 - (winnerIndex + 0.5) * slice;
    const current = rotationRef.current;
    const currentNorm = ((current % TAU) + TAU) % TAU;
    let delta = targetCenter - currentNorm;
    while (delta < 0) delta += TAU;

    const turns = Math.max(5, Math.round(config.spinTime / 1.2));
    const target = current + turns * TAU + delta;
    const duration = Math.max(1500, config.spinTime * 1000);
    const start = performance.now();
    let lastTickBucket = Math.floor(current / slice);

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = current + (target - current) * easeOut(progress);
      rotationRef.current = next;

      const bucket = Math.floor(next / slice);
      if (bucket !== lastTickBucket) {
        lastTickBucket = bucket;
        tick();
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const event = new Event("resize");
        canvas.dispatchEvent(event);
      }

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        rotationRef.current = target;
        setSpinning(false);

        if (!muted && config.afterSpinSound && config.afterSpinSound !== "no-sound") {
          const soundMap: Record<string, string> = {
            "applause-sound-soft": "/sounds/after-spin/subdued-applause.mp3",
            applause: "/sounds/after-spin/loud-applause.mp3",
            "correct-answer-ding": "/sounds/after-spin/correct-answer-ding.mp3",
            fireworks: "/sounds/after-spin/fireworks.mp3",
            fanfare: "/sounds/after-spin/fanfare.mp3",
          };
          const src = soundMap[config.afterSpinSound];
          if (src) {
            audioRef.current = new Audio(src);
            audioRef.current.volume = config.afterSpinSoundVolume / 100;
            void audioRef.current.play().catch(() => undefined);
          }
        }

        onWinner(winner);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
  };

  return (
    <div className="wheel-shell">
      <button
        type="button"
        className="wheel-pointer"
        style={{ borderTopColor: config.pointerChangesColor ? pointerColor : "#1976d2" }}
        onClick={spin}
        disabled={spinning || !entries.length}
        aria-label="Spin wheel"
      />

      <canvas
        ref={canvasRef}
        className={`wheel-canvas ${spinning ? "is-spinning" : ""}`}
        onClick={spin}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") spin();
        }}
        role="button"
        tabIndex={0}
        aria-label="Spin the wheel"
      />

      <button
        type="button"
        className="wheel-mute"
        onClick={onMute}
        aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </div>
  );
}

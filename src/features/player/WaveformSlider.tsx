import { useRef, useEffect, useCallback, useState } from 'react';

interface WaveformSliderProps {
  waveform: number[];
  progress: number;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number, duration?: number): string {
  // For short audio (< 10 seconds), show tenths of a second like macOS
  const effectiveDuration = duration ?? seconds;
  if (effectiveDuration < 10) {
    const wholeSecs = Math.floor(seconds);
    const tenths = Math.floor((seconds - wholeSecs) * 10);
    return `0:${wholeSecs.toString().padStart(2, '0')}.${tenths}`;
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Calculate bar dimensions based on container width - responsive sizing
function calculateBarDimensions(containerWidth: number, barCount: number) {
  const minBarWidth = 2;
  const maxBarWidth = 4;
  const minGap = 1;
  const maxGap = 2;

  const idealTotalBarWidth = containerWidth / barCount;
  const barWidth = Math.max(minBarWidth, Math.min(maxBarWidth, idealTotalBarWidth * 0.6));
  const barGap = Math.max(minGap, Math.min(maxGap, idealTotalBarWidth * 0.4));
  const totalBarWidth = barWidth + barGap;
  const waveformWidth = barCount * totalBarWidth - barGap;
  const startX = (containerWidth - waveformWidth) / 2;

  return { barCount, barWidth, barGap, totalBarWidth, waveformWidth, startX };
}

export function WaveformSlider({
  waveform,
  progress,
  duration,
  currentTime,
  isPlaying,
  onSeek,
}: WaveformSliderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [dragX, setDragX] = useState(0); // Actual mouse X position relative to container

  // Draw waveform on canvas
  const drawWaveform = useCallback(
    (progressValue: number, _isDragging: boolean = false, playheadX?: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get device pixel ratio for crisp rendering
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      // Set canvas size accounting for DPR
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Scale context
      ctx.scale(dpr, dpr);

      // Clear canvas
      ctx.clearRect(0, 0, rect.width, rect.height);

      const barCount = waveform.length || 50;
      const { barWidth, barGap, totalBarWidth, startX } = calculateBarDimensions(rect.width, barCount);

      // Calculate which bar the progress line is at
      // If we have a playheadX (during drag), calculate from that position
      let progressBar: number;
      if (playheadX !== undefined) {
        // Calculate bar index from actual X position
        const relativeX = playheadX - startX;
        progressBar = Math.ceil(relativeX / totalBarWidth);
      } else {
        progressBar = Math.floor(progressValue * barCount);
      }

      // Get colors (compute CSS variables once)
      const styles = getComputedStyle(document.documentElement);
      const primaryColor = styles.getPropertyValue('--color-primary').trim() || '#3b82f6';
      const unplayedColor = styles.getPropertyValue('--waveform-unplayed').trim() || 'rgba(255, 255, 255, 0.3)';

      // Draw bars
      waveform.forEach((value, index) => {
        const x = startX + index * totalBarWidth;
        const barHeight = Math.max(4, value * (rect.height - 4));
        const y = (rect.height - barHeight) / 2;

        // Color based on progress
        ctx.fillStyle = index < progressBar ? primaryColor : unplayedColor;

        // Draw rounded bar
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1);
        ctx.fill();
      });

      // Draw playhead line
      const lineX = playheadX !== undefined
        ? playheadX
        : startX + progressValue * (barCount * totalBarWidth - barGap);
      const playheadColor = styles.getPropertyValue('--waveform-playhead').trim() || '#ffffff';
      ctx.strokeStyle = playheadColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lineX, 2);
      ctx.lineTo(lineX, rect.height - 2);
      ctx.stroke();
    },
    [waveform]
  );

  // Redraw when waveform, progress, or playing state changes
  useEffect(() => {
    const progressValue = isDragging ? dragProgress : progress;
    drawWaveform(progressValue, isDragging, isDragging ? dragX : undefined);
  }, [waveform, progress, isPlaying, isDragging, dragProgress, dragX, drawWaveform]);

  // Handle resize and theme change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const redraw = () => {
      const progressValue = isDragging ? dragProgress : progress;
      drawWaveform(progressValue, isDragging, isDragging ? dragX : undefined);
    };

    // ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(redraw);
    resizeObserver.observe(container);

    // MediaQuery for theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', redraw);

    return () => {
      resizeObserver.disconnect();
      mediaQuery.removeEventListener('change', redraw);
    };
  }, [progress, isDragging, dragProgress, dragX, drawWaveform]);

  // Helper to calculate bar dimensions based on container width
  const getBarDimensions = useCallback(
    (containerWidth: number) => {
      const barCount = waveform.length || 50;
      return calculateBarDimensions(containerWidth, barCount);
    },
    [waveform.length]
  );

  // Get X position relative to container, clamped to waveform bar area
  const getXFromEvent = useCallback(
    (clientX: number): number => {
      const container = containerRef.current;
      if (!container) return 0;

      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;

      const { waveformWidth, startX } = getBarDimensions(rect.width);
      const endX = startX + waveformWidth;

      // Clamp to waveform area
      return Math.max(startX, Math.min(endX, x));
    },
    [getBarDimensions]
  );

  // Calculate progress from X position (relative to waveform bar area)
  const getProgressFromX = useCallback(
    (x: number): number => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;

      const rect = canvas.getBoundingClientRect();
      const { waveformWidth, startX } = getBarDimensions(rect.width);

      // Calculate progress relative to the waveform bar area
      const relativeX = x - startX;
      const progress = relativeX / waveformWidth;
      return Math.max(0, Math.min(1, progress));
    },
    [getBarDimensions]
  );

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (duration <= 0) return;

      setIsDragging(true);
      const x = getXFromEvent(e.clientX);
      setDragX(x);
      setDragProgress(getProgressFromX(x));
    },
    [duration, getXFromEvent, getProgressFromX]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const x = getXFromEvent(e.clientX);
      setDragX(x);
      setDragProgress(getProgressFromX(x));
    },
    [isDragging, getXFromEvent, getProgressFromX]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const x = getXFromEvent(e.clientX);
      const newProgress = getProgressFromX(x);
      const newTime = newProgress * duration;
      onSeek(newTime);
      setIsDragging(false);
    },
    [isDragging, duration, onSeek, getXFromEvent, getProgressFromX]
  );

  // Global mouse event listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle click (for non-drag clicks)
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (duration <= 0) return;

      const x = getXFromEvent(e.clientX);
      const newProgress = getProgressFromX(x);
      const newTime = newProgress * duration;
      onSeek(newTime);
    },
    [duration, onSeek, getXFromEvent, getProgressFromX]
  );

  const displayTime = isDragging ? dragProgress * duration : currentTime;

  return (
    <div className="waveform-slider">
      <div
        ref={containerRef}
        className={`waveform-canvas-container ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onClick={!isDragging ? handleClick : undefined}
      >
        <canvas ref={canvasRef} className="waveform-canvas" />
      </div>
      <span className="time-display">
        {formatTime(displayTime, duration)} / {formatTime(duration)}
      </span>
    </div>
  );
}

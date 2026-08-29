import { useEffect, useState } from 'react';

import {
  PHONE_SHELL_HEIGHT,
  PHONE_SHELL_MIN_VIEWPORT,
  PHONE_SHELL_WIDTH,
} from '@/constants/phoneShell';

function readRootSize(): { width: number; height: number } {
  if (typeof document === 'undefined') {
    return { width: PHONE_SHELL_WIDTH, height: PHONE_SHELL_HEIGHT };
  }
  const root = document.getElementById('root');
  if (root && root.clientWidth > 0 && root.clientHeight > 0) {
    return { width: root.clientWidth, height: root.clientHeight };
  }
  const w = typeof window !== 'undefined' ? window.innerWidth : PHONE_SHELL_WIDTH;
  const h = typeof window !== 'undefined' ? window.innerHeight : PHONE_SHELL_HEIGHT;
  if (w >= PHONE_SHELL_MIN_VIEWPORT) {
    return { width: PHONE_SHELL_WIDTH, height: PHONE_SHELL_HEIGHT };
  }
  return { width: w, height: h };
}

export function usePhoneShellActive(): boolean {
  const [active, setActive] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(min-width: ${PHONE_SHELL_MIN_VIEWPORT}px)`).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(min-width: ${PHONE_SHELL_MIN_VIEWPORT}px)`);
    const onChange = () => setActive(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return active;
}

function snapToDevicePixel(cssPx: number): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.round(cssPx * dpr) / dpr;
}

/**
 * Pin #root to device pixels. CSS-pixel centering on Windows 125%/150% DPI
 * lands the whole app on a half device-pixel, so clip-path + covers shimmer
 * on every screen. Never apply live scale.
 */
export function usePixelSnappedPhoneShell() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.getElementById('root');
    if (!root) return;

    let lastLeft = Number.NaN;
    let lastTop = Number.NaN;
    let lastW = Number.NaN;
    let lastH = Number.NaN;

    const clear = () => {
      root.style.position = '';
      root.style.left = '';
      root.style.top = '';
      root.style.right = '';
      root.style.margin = '';
      root.style.transform = '';
      root.style.width = '';
      root.style.height = '';
      lastLeft = Number.NaN;
      lastTop = Number.NaN;
      lastW = Number.NaN;
      lastH = Number.NaN;
    };

    const apply = () => {
      if (window.innerWidth < PHONE_SHELL_MIN_VIEWPORT) {
        clear();
        return;
      }
      const width = snapToDevicePixel(PHONE_SHELL_WIDTH);
      const height = snapToDevicePixel(PHONE_SHELL_HEIGHT);
      const left = snapToDevicePixel((window.innerWidth - width) / 2);
      const top = snapToDevicePixel(Math.max(16, (window.innerHeight - height) / 2));
      if (
        Number.isFinite(lastLeft) &&
        Math.abs(left - lastLeft) < 8 &&
        Math.abs(top - lastTop) < 8 &&
        lastW === width &&
        lastH === height
      ) {
        return;
      }
      lastLeft = left;
      lastTop = top;
      lastW = width;
      lastH = height;
      root.style.position = 'fixed';
      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
      root.style.right = 'auto';
      root.style.margin = '0';
      root.style.transform = 'none';
      root.style.width = `${width}px`;
      root.style.height = `${height}px`;
    };

    apply();
    window.addEventListener('resize', apply);
    return () => {
      window.removeEventListener('resize', apply);
      clear();
    };
  }, []);
}

/** Viewport of the app chrome (#root on web). Does not subscribe to window resize. */
export function useAppViewport(): { width: number; height: number } {
  const [size, setSize] = useState(readRootSize);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('root');
    if (!root) return;
    const update = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      if (width <= 0 || height <= 0) return;
      setSize((prev) =>
        Math.abs(prev.width - width) < 8 && Math.abs(prev.height - height) < 8
          ? prev
          : { width, height },
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  return size;
}

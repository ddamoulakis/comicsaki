import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

import {
  PHONE_SHELL_HEIGHT,
  PHONE_SHELL_MIN_VIEWPORT,
  PHONE_SHELL_WIDTH,
} from '@/constants/phoneShell';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="el">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0A1020" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: mobileShellCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const bezel = 10;

const mobileShellCss = `
html, body {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  overscroll-behavior: none;
  background-color: #050814;
  font-family: 'PlaypenSans', 'Playpen Sans', system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
body {
  display: flex;
  justify-content: stretch;
  align-items: stretch;
}
#root {
  width: 100%;
  height: 100%;
  max-height: 100%;
  flex: 1;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}
input, textarea, button, select {
  font-family: inherit;
}
#root > div {
  height: 100%;
  max-height: 100%;
  width: 100%;
  overflow: hidden !important;
}
#root [data-cover-scroll-shell="1"] {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  overflow: hidden !important;
}
#root [data-cover-scroll="1"] {
  scrollbar-width: none;
  -ms-overflow-style: none;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  overscroll-behavior-x: contain;
  touch-action: pan-x;
  -webkit-overflow-scrolling: touch;
}
#root [data-cover-scroll="1"]::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
  background: transparent;
}
#root [data-cover-scroll="1"]::-webkit-scrollbar-track,
#root [data-cover-scroll="1"]::-webkit-scrollbar-thumb {
  background: transparent;
}

@media (min-width: ${PHONE_SHELL_MIN_VIEWPORT}px) {
  body {
    display: block;
    background:
      radial-gradient(ellipse at 50% 28%, #1a2240 0%, #050814 68%);
  }
  #root {
    flex: none;
    position: absolute;
    /* Integer snap when the browser supports CSS round(); JS pin is the fallback. */
    top: round(nearest, max(16px, calc(50% - ${PHONE_SHELL_HEIGHT / 2}px)), 1px);
    left: round(nearest, calc(50% - ${PHONE_SHELL_WIDTH / 2}px), 1px);
    width: ${PHONE_SHELL_WIDTH}px;
    height: ${PHONE_SHELL_HEIGHT}px;
    max-width: ${PHONE_SHELL_WIDTH}px;
    max-height: ${PHONE_SHELL_HEIGHT}px;
    margin: 0;
    border: 0;
    border-radius: 44px;
    outline: ${bezel}px solid #1a1a1e;
    outline-offset: 0;
    box-shadow:
      0 0 0 1px #3a3a42,
      0 24px 64px rgba(0, 0, 0, 0.55);
    overflow: hidden;
    transform: none;
    box-sizing: content-box;
  }
}

#root * {
  clip-path: none !important;
  -webkit-clip-path: none !important;
}
`;

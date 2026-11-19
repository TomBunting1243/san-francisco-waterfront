// Capture the public CityWorld renderer in an isolated Chrome profile.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { constants } from 'node:fs';
import { access, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import {verifyWaterfront} from './verify-waterfront.mjs';

const output = fileURLToPath(new URL('../public/', import.meta.url));
const localhost = 'http://localhost:5173/';
const views = [
  { width: 1440, height: 940, scale: 5 / 3, portrait: false, suffix: '' },
  { width: 390, height: 844, scale: 3, portrait: true, suffix: '-portrait' },
];
const palettes = [
  { palette: 'paper', media: 'light', light: 'day', date: '2026-09-10T22:00:00Z', base: 'city-poster' },
  { palette: 'ink', media: 'dark', light: 'night-print', date: '2026-09-11T06:00:00Z', base: 'city-night' },
];
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: 'string' }, help: { type: 'boolean', short: 'h' },
    'check-interactions': { type: 'boolean' }, 'check-rides': { type: 'boolean' }, 'check-fog': { type: 'boolean' }, 'evidence-dir': { type: 'string' },
  },
});

async function chromeExecutable() {
  const platforms = {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      '/Applications/Chromium.app/Contents/MacOS/Chromium'],
    win32: [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LocalAppData].filter(Boolean)
      .map(path => join(path, 'Google/Chrome/Application/chrome.exe')),
    linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  };
  const names = process.platform === 'win32' ? ['chrome.exe', 'chromium.exe'] : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  const folders = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const candidates = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : [
    ...(platforms[process.platform] ?? []), ...folders.flatMap(dir => names.map(name => join(dir, name))),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch { /* Try the next install location. */ }
  }
  throw new Error('Chrome executable not found. Set CHROME_PATH to the browser executable.');
}

async function debuggerUrl(profile, signal, assertBrowser) {
  const deadline = Date.now() + 15_000;
  let port;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    assertBrowser();
    try {
      const portFile = await readFile(join(profile, 'DevToolsActivePort'), 'utf8');
      port = Number(portFile.split('\n')[0]);
      if (port) break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await delay(100, undefined, { signal });
  }
  if (!port) throw new Error('Chrome did not publish its DevTools port.');
  const tabs = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
  if (!tabs.ok) throw new Error('Unable to list the isolated browser tabs.');
  const page = (await tabs.json()).find(tab => tab.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('The isolated browser has no capture tab.');
  return page.webSocketDebuggerUrl;
}

async function connect(socket, signal) {
  await once(socket, 'open', { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
  let sequence = 0;
  const pending = new Map();
  function rejectPending(error) {
    for (const request of pending.values()) request.finish(error);
  }
  socket.addEventListener('close', () => rejectPending(new Error('Chrome closed the capture connection.')));
  socket.addEventListener('error', () => rejectPending(new Error('The Chrome capture connection failed.')));
  signal.addEventListener('abort', () => rejectPending(signal.reason), { once: true });
  socket.addEventListener('message', event => {
    const { id, error, result } = JSON.parse(event.data);
    const request = pending.get(id);
    if (!request) return;
    request.finish(error ? new Error(request.method + ': ' + error.message) : null, result);
  });
  return function send(method, params = {}) {
    signal.throwIfAborted();
    if (socket.readyState !== WebSocket.OPEN) throw new Error('Chrome capture connection closed.');
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => pending.get(id)?.finish(new Error(method + ' timed out.')), 30_000);
      pending.set(id, { method, finish(error, result) {
        clearTimeout(timer);
        pending.delete(id);
        if (error) reject(error);
        else resolve(result);
      } });
      socket.send(JSON.stringify({ id, method, params }));
    });
  };
}

async function evaluate(send, expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) {
    const { exception, text } = response.exceptionDetails;
    throw new Error(exception?.description ?? text);
  }
  return response.result.value;
}

// This runs before the application reads its clock, palette and motion preferences.
function preparePage({ palette, date, stamp }) {
  if (window !== window.top) return;
  globalThis.cityPosterCapture = stamp;
  const RealDate = Date;
  const instant = RealDate.parse(date);
  globalThis.Date = new Proxy(RealDate, {
    construct(target, args, type) { return Reflect.construct(target, args.length ? args : [instant], type); },
    apply() { return new RealDate(instant).toString(); },
    get(target, property, receiver) { return property === 'now' ? () => instant : Reflect.get(target, property, receiver); },
  });
  localStorage.setItem('portfolio-palette', palette);
  localStorage.setItem('tom-city-motion-paused', 'true');
  const observer = new MutationObserver(configure);
  function configure() {
    if (!document.documentElement) return;
    observer.disconnect();
    document.documentElement.dataset.palette = palette;
    window.dispatchEvent(new Event('portfolio-palette-change'));
  }
  observer.observe(document, { childList: true });
  configure();
}

const canvasSelector = '.world > .world-scene > canvas';
function isolateCanvas(selector) {
  const style = document.createElement('style');
  style.textContent = `
    html, body { overflow: hidden !important; }
    *, *::before, *::after { visibility: hidden !important; }
    *::before, *::after { content: none !important; }
    .world > .world-scene { opacity: 1 !important; transition: none !important; }
    ${selector} { visibility: visible !important; }
  `;
  document.head.append(style);
  window.scrollTo(0, 0);
}

function renderedCity(selector) {
  const canvas = document.querySelector(selector);
  if (!canvas) return null;
  const host = canvas.parentElement;
  if (host.dataset.ready !== 'true' || !Number(host.dataset.triangles)) return null;
  const { x, y, width, height } = canvas.getBoundingClientRect();
  const context = canvas.getContext('webgl2');
  return {
    x, y, width, height, bufferWidth: canvas.width, bufferHeight: canvas.height,
    antialias: context?.getContextAttributes()?.antialias ?? false,
    palette: document.documentElement.dataset.palette, light: host.dataset.light, motion: host.dataset.motion,
    stamp: globalThis.cityPosterCapture,
  };
}

async function waitForCity(send, theme, view, stamp, signal) {
  const deadline = Date.now() + 90_000;
  let latest = null;
  const select = JSON.stringify(canvasSelector);
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    try {
      latest = await evaluate(send, `(${renderedCity})(${select})`);
    } catch (error) {
      if (!/Cannot find (default )?(execution )?context|Execution context was destroyed/.test(error.message)) throw error;
      latest = null;
    }
    if (latest?.stamp === stamp && latest.palette === theme.palette && latest.light === theme.light &&
        latest.motion === 'paused' && latest.width === view.width && latest.height === view.height) return;
    await delay(250, undefined, { signal });
  }
  throw new Error(`The ${theme.light} city did not finish rendering at ${view.width}×${view.height}. Last canvas state: ${JSON.stringify(latest)}`);
}

async function capture(send, url, theme, view, signal) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: view.width, height: view.height, deviceScaleFactor: view.scale, mobile: view.portrait,
    screenOrientation: { type: view.portrait ? 'portraitPrimary' : 'landscapePrimary', angle: view.portrait ? 0 : 90 },
  });
  await send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-color-scheme', value: theme.media },
      { name: 'prefers-reduced-motion', value: 'reduce' },
      { name: 'prefers-reduced-data', value: 'no-preference' },
    ],
  });
  const name = theme.base + view.suffix + '.webp';
  const source = `(${preparePage})(${JSON.stringify({ palette: theme.palette, date: theme.date, stamp: name })})`;
  const script = await send('Page.addScriptToEvaluateOnNewDocument', { source });
  try {
    const navigation = await send('Page.navigate', { url });
    if (navigation.errorText) throw new Error(navigation.errorText);
    await waitForCity(send, theme, view, name, signal);
    const select = JSON.stringify(canvasSelector);
    await evaluate(send, `(${isolateCanvas})(${select}); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
    const state = await evaluate(send, `(${renderedCity})(${select})`);
    const widthPx = Math.round(view.width * view.scale), heightPx = Math.round(view.height * view.scale);
    if (!state || state.x !== 0 || state.y !== 0 || state.width !== view.width || state.height !== view.height ||
        Math.abs(state.bufferWidth - widthPx) > 1 || Math.abs(state.bufferHeight - heightPx) > 1 || !state.antialias) {
      throw new Error(`Expected a full-size antialiased viewport. Canvas state: ${JSON.stringify(state)}`);
    }
    const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    const image = sharp(Buffer.from(data, 'base64'));
    const { width, height } = await image.metadata();
    if (width !== widthPx || Math.abs(height - heightPx) > 1) throw new Error(`Unexpected screenshot size: ${width}×${height}`);
    const { channels } = await image.stats();
    if (channels.slice(0, 3).every(channel => channel.stdev < 4)) throw new Error('Chrome captured an empty city frame.');
    return { name, bytes: await image.webp({ quality: 85 }).toBuffer(), width, height };
  } finally {
    if (!signal.aborted) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier });
  }
}

async function render(url) {
  const executable = await chromeExecutable();
  const profile = await mkdtemp(join(tmpdir(), 'city-poster-chrome-'));
  const controller = new AbortController();
  const { signal } = controller;
  const interrupt = () => controller.abort(new Error('Poster capture interrupted.'));
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  let browser, socket, stage;
  let startupError, log = '';
  try {
    browser = spawn(executable, [
      '--headless', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
      '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--disable-extensions', '--force-color-profile=srgb',
      '--hide-scrollbars', 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    browser.on('error', error => { startupError = error; });
    browser.stderr.on('data', chunk => { log = (log + chunk).slice(-1400); });
    const address = await debuggerUrl(profile, signal, () => {
      if (startupError) throw startupError;
      if (browser.exitCode !== null || browser.signalCode) throw new Error('Chrome exited before capture.\n' + log.trim());
    });
    socket = new WebSocket(address);
    const send = await connect(socket, signal);
    socket.addEventListener('message', event => {
      const message=JSON.parse(event.data);
      if(message.method!=='Runtime.consoleAPICalled'||message.params.type!=='error')return;
      const reason=message.params.args.map(arg=>arg.value??arg.description??'').join(' ');
      if(/WebGLProgram|Waterfront renderer could not start/.test(reason))
        controller.abort(new Error(reason));
    });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.bringToFront');
    if(values['check-interactions']||values['check-rides']){
      await verifyWaterfront(send,evaluate,url,signal,{checkRides:values['check-rides'],ridesOnly:!values['check-interactions'],checkFog:values['check-fog'],evidenceDir:values['evidence-dir']});
      return;
    }
    const images = [];
    for (const theme of palettes) {
      for (const view of views) {
        const image = await capture(send, url, theme, view, signal);
        images.push(image);
        console.log(`Captured ${image.name} at ${image.width}×${image.height}.`);
      }
    }
    signal.throwIfAborted();
    stage = await mkdtemp(join(output, '.city-poster-'));
    for (const image of images) await writeFile(join(stage, image.name), image.bytes);
    for (const image of images) await rename(join(stage, image.name), join(output, image.name));
  } finally {
    try {
      socket?.close();
      if (browser?.pid && browser.exitCode === null && browser.signalCode === null) {
        const closed = once(browser, 'exit', { signal: AbortSignal.timeout(2000) });
        browser.kill();
        try {
          await closed;
        } catch {
          const killed = once(browser, 'exit', { signal: AbortSignal.timeout(2000) });
          browser.kill('SIGKILL');
          await killed;
        }
      }
    } finally {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
      await rm(profile, { recursive: true, force: true, maxRetries: 3 });
      if (stage) await rm(stage, { recursive: true, force: true, maxRetries: 3 });
    }
  }
}

if (values.help) {
  console.log('Usage: node scripts/render-city-poster.mjs [--url URL]\n' +
    'Browser regression: add --check-interactions [--check-fog] [--evidence-dir PATH]\n' +
    'Standalone driver camera regression: add --check-rides [--evidence-dir PATH]\n' +
    'Default: ' + localhost + '\nSet CHROME_PATH to override Chrome discovery.');
} else {
  if (positionals.length > 1 || (values.url && positionals.length)) throw new Error('Pass one capture URL.');
  if(values['check-fog']&&!values['check-interactions'])throw new Error('--check-fog requires --check-interactions.');
  if(values['evidence-dir']&&!values['check-interactions']&&!values['check-rides']){
    throw new Error('--evidence-dir requires --check-interactions or --check-rides.');
  }
  const url = new URL(values.url ?? positionals[0] ?? localhost);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('The capture URL must use HTTP or HTTPS.');
  await render(url.href);
}

const movie = document.querySelector('video');
const enter = document.querySelector('.enter');
const error = document.querySelector('.error');

const portrait = matchMedia('(orientation: portrait)');
let source = movie.currentSrc || new URL(portrait.matches ? 'bridge-to-city-portrait.mp4' : 'bridge-to-city.mp4', document.baseURI).href;
movie.poster = selection().poster;
let objectURL;
let request;
movie.dataset.filmSrc = source;

function selection() {
  const opening = document.querySelector('input[name="opening"]:checked').value;
  const light = document.querySelector('input[name="film"]:checked').value;
  const bridge = opening === 'bridge';
  const name = (bridge ? 'city-to-bridge' : 'bridge-to-city') + (light === 'night' ? '-night' : '') + (portrait.matches ? '-portrait' : '');
  return {
    src: new URL(name + '.mp4', document.baseURI).href,
    poster: name + '.webp',
    label: (bridge ? 'City to Bay Bridge' : 'Bay Bridge to city') + ', ' + light,
    href: '../?opening=' + opening + '&film=' + light,
  };
}

async function switchFilm(upgradeInitial = false) {
  const film = selection();
  enter.href = film.href;
  error.hidden = true;
  error.querySelector('a').href = film.src;
  if (request?.src === film.src) return;
  request?.controller.abort();
  request = undefined;
  if (film.src === source && !upgradeInitial) return;

  const controller = new AbortController();
  request = {src: film.src, controller};
  try {
    // A host can return HTTP 200 for every Range request. A local Blob supports
    // native seeking even there. Fetch just the selected edition; the old film
    // stays operable while the replacement downloads.
    const response = await fetch(film.src, {signal: controller.signal});
    if (!response.ok) throw new Error('Film unavailable');
    const blob = await response.blob();
    if (controller.signal.aborted) return;

    const time = movie.currentTime;
    const playing = !movie.paused && !movie.ended;
    const previousURL = objectURL;
    objectURL = URL.createObjectURL(blob);
    source = film.src;
    movie.poster = film.poster;
    movie.setAttribute('aria-label', film.label);
    movie.src = objectURL;
    movie.load();
    // At HAVE_NOTHING this sets the native default start position. It remains
    // available to a subsequent rapid switch before metadata arrives.
    movie.currentTime = time;
    if (playing) void movie.play().catch(() => {});
    movie.dataset.filmSrc = source;
    if (previousURL) URL.revokeObjectURL(previousURL);
  } catch {
    if (!controller.signal.aborted) error.hidden = false;
  } finally {
    if (request?.controller === controller) request = undefined;
  }
}

function checkInitialSeekability() {
  if (objectURL || request || movie.readyState < 1 || selection().src !== source) return;
  if (Number.isFinite(movie.duration) && movie.duration > 0 &&
      (!movie.seekable.length || movie.seekable.end(movie.seekable.length - 1) < movie.duration - .1))
    void switchFilm(true);
}

window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  request?.controller.abort();
  if (objectURL) URL.revokeObjectURL(objectURL);
});
movie.addEventListener('loadedmetadata', checkInitialSeekability);
movie.addEventListener('error', () => {
  if (!request) error.hidden = false;
});
portrait.addEventListener('change', () => { void switchFilm(); });
for (const group of document.querySelectorAll('fieldset')) {
  group.disabled = false;
  group.addEventListener('change', () => {
    void switchFilm();
    checkInitialSeekability();
  });
}

if (selection().src !== source) void switchFilm();
else checkInitialSeekability();

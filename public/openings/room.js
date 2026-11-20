const movie = document.querySelector('video');
const enter = document.querySelector('.enter');
const error = document.querySelector('.error');
let transfer;

function switchFilm() {
  const opening = document.querySelector('input[name="opening"]:checked').value;
  const light = document.querySelector('input[name="film"]:checked').value;
  const bridge = opening === 'bridge';
  const name = (bridge ? 'city-to-bridge' : 'bridge-to-city') + (light === 'night' ? '-night' : '');
  const src = new URL(name + '.mp4', document.baseURI).href;
  const time = transfer?.time ?? (movie.ended ? 0 : movie.currentTime);
  const playing = transfer?.playing ?? (!movie.paused && !movie.ended);
  transfer = {src, time, playing};
  error.hidden = true;
  error.querySelector('a').href = src;
  enter.href = '../?opening=' + opening + '&film=' + light;
  movie.setAttribute('aria-label', (bridge ? 'City to Bay Bridge' : 'Bay Bridge to city') + ', ' + light);
  movie.poster = name + '.webp';
  movie.src = src;
  movie.load();
  // Set the default playback start position while metadata is in flight.
  movie.currentTime = time;
  if (playing) void movie.play().catch(() => {});
}

movie.addEventListener('loadedmetadata', () => {
  if (!transfer || movie.currentSrc !== transfer.src || !Number.isFinite(movie.duration)) return;
  movie.currentTime = Math.min(transfer.time, movie.duration);
  transfer = undefined;
});
movie.addEventListener('error', () => {
  if (transfer && movie.currentSrc && movie.currentSrc !== transfer.src) return;
  error.hidden = false;
});
for (const group of document.querySelectorAll('fieldset')) {
  group.disabled = false;
  group.addEventListener('change', switchFilm);
}

if (!document.querySelector('input[value="bridge"]').checked ||
    !document.querySelector('input[value="day"]').checked) switchFilm();

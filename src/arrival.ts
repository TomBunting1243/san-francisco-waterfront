import './city.css';
import './standalone.css';

// Every visitor to the standalone site opens on the waterfront. Start the
// survey and its renderer dependencies while the controls are downloading.
// CityWorld still owns construction, the progress bar and WebGL recovery.
if (window.WebGL2RenderingContext) {
  void import('../app/landscape').catch(() => {});
}
void import('./main').catch(() => {
  const loader = document.querySelector('.world-loading');
  const message = loader?.querySelector('[role="status"]');
  if (message) message.textContent = 'The waterfront couldn’t load. Reload to try again.';
  loader?.querySelector('progress')?.remove();
});

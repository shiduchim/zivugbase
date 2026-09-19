/* ZivugBase entry point. */
import { start } from './ui/app.js';
start().catch(err => {
  console.error('ZivugBase failed to start', err);
  document.getElementById('screen').innerHTML =
    '<div class="empty">ZivugBase could not start. ' + String(err && err.message || err) + '</div>';
});

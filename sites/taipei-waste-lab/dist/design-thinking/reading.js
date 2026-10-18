// Retained PRD/workbook URLs resolve to the same flat reading page.
const destination = document.getElementById('definition-destination');
const targets = JSON.parse(document.getElementById('definition-targets').textContent);
let requested = '';
try { requested = decodeURIComponent(location.hash.slice(1)); } catch { /* Use the visible fallback. */ }
if (Object.hasOwn(targets, requested)) destination.hash = targets[requested];
location.replace(destination.href);

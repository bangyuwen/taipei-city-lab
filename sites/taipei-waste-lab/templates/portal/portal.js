// Preserve shared research URLs from before the two-entry homepage.
const oldQuery = ['year', 'district', 'q', 'venues'].some(key => new URLSearchParams(location.search).has(key));
if ((location.hash && location.hash !== '#main') || oldQuery) {
  location.replace('research/' + location.search + location.hash);
}

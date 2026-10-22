// Added at publication time; the research generator retains ownership of its page.
const header = document.querySelector('.site-header');
if (header) {
  const nav = document.createElement('nav');
  nav.className = 'portal-return';
  nav.setAttribute('aria-label', '網站入口');
  nav.innerHTML = '<a href="../">網站首頁</a><a href="../demo/">有桶體驗</a>';
  header.prepend(nav);
}

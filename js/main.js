// Small enhancements only. The site works without JavaScript:
// panels just don't stick, and the CAD buttons link to each case study's gallery.

(function () {
  document.documentElement.classList.add('has-js');

  // ---------------------------------------------------------------------------
  // Sticky project panels. Each panel should fit under the nav so it slides in, holds still, and is
  // covered like every other one. A panel that still overflows is shrunk slightly (never below 85%);
  // one that overflows even then gets a negative top, so it scrolls until its bottom shows and then sticks.
  // Scrolling itself is left entirely to the browser: the page never scrolls on its own.
  // ---------------------------------------------------------------------------
  const panels = [...document.querySelectorAll('.panel')];
  if (panels.length) {
    const navH = document.querySelector('[data-nav]')?.offsetHeight || 64;
    const sticky = window.matchMedia('(min-width: 1000px) and (min-height: 600px)');
    // Batched: all writes, then all reads, so the page is laid out a fixed number of times, not once per panel.
    const fit = () => {
      const inners = panels.map((p) => p.querySelector('.panel-inner'));
      inners.forEach((el) => { if (el) el.style.zoom = ''; });
      const room = window.innerHeight - navH;
      if (sticky.matches) {
        const zooms = panels.map((p) => (p.offsetHeight > room + 1 ? Math.max(0.85, room / p.offsetHeight) : 1));
        inners.forEach((el, k) => { if (el && zooms[k] < 1) el.style.zoom = zooms[k].toFixed(3); });
      }
      const tops = panels.map((p) => Math.min(navH, window.innerHeight - p.offsetHeight));
      panels.forEach((p, k) => {
        if (p.style.getPropertyValue('--stick-top') !== tops[k] + 'px') p.style.setProperty('--stick-top', tops[k] + 'px');
      });
    };
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('load', fit);
    document.fonts?.ready.then(fit);
    if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => requestAnimationFrame(fit)); panels.forEach((p) => ro.observe(p)); }
  }

  // ---------------------------------------------------------------------------
  // SAM map: play the shock pulse twice when the map comes into view, then rest.
  // ---------------------------------------------------------------------------
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.world').forEach((map) => {
    if (calm || !('IntersectionObserver' in window)) { map.classList.add('is-done'); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      map.classList.add('is-live');
      setTimeout(() => map.classList.add('is-done'), 16500);   // two 7 s cycles plus the longest start delay
    }, { threshold: 0.4 });
    io.observe(map);
  });

  // ---------------------------------------------------------------------------
  // CAD viewer: buttons with data-cad-open="<dialog id>" open a slideshow.
  // ---------------------------------------------------------------------------
  document.querySelectorAll('dialog.cad').forEach((dlg) => {
    const slides = [...dlg.querySelectorAll('.cad-slide')];
    const count = dlg.querySelector('.cad-count');
    let i = 0;
    const show = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
      if (count) count.textContent = `${i + 1} / ${slides.length}`;
    };
    dlg.querySelector('[data-cad-prev]')?.addEventListener('click', () => show(i - 1));
    dlg.querySelector('[data-cad-next]')?.addEventListener('click', () => show(i + 1));
    dlg.querySelector('[data-cad-close]')?.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // click on the backdrop
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
    });
    dlg._show = show;
  });
  document.querySelectorAll('[data-cad-open]').forEach((btn) => {
    const dlg = document.getElementById(btn.dataset.cadOpen);
    if (!dlg || typeof dlg.showModal !== 'function') return;   // falls back to the gallery link
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      dlg._show(0);
      dlg.showModal();
    });
  });

  // ---------------------------------------------------------------------------
  // Mobile menu.
  // ---------------------------------------------------------------------------
  const toggle = document.querySelector('[data-nav-toggle]');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Close' : 'Menu';
      links.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    links.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  // ---------------------------------------------------------------------------
  // Copy-to-clipboard buttons.
  // ---------------------------------------------------------------------------
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'Copied';
      } catch {
        btn.textContent = 'Press Ctrl+C';
      }
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });
})();

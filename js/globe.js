/* GTAP cover: a globe of where Japan's metal ore came from in 2019 (OECD ICIO 2025 shares).
   Drag to turn it; the buttons turn it to each supplier. Without JS or d3, the flat map stays.
   The globe only redraws when someone turns it (redrawing the land costs ~100 ms a frame on a slow CPU);
   the moving dashes are a cheap layer on top. */
(() => {
  const root = document.querySelector('[data-globe]');
  const d3 = window.d3, S = window.GLOBE_SHAPES;
  if (!root || !d3 || !d3.geoOrthographic || !S) return;

  const JP = [138.5, 36.5];
  const SUP = [
    { k: 'AUS', n: 'Australia', s: 32, p: [121, -23] }, { k: 'CHL', n: 'Chile', s: 17, p: [-70, -26] },
    { k: 'BRA', n: 'Brazil', s: 9, p: [-46, -12] }, { k: 'PER', n: 'Peru', s: 7, p: [-75, -10] },
    { k: 'ZAF', n: 'South Africa', s: 5, p: [26, -28] }, { k: 'USA', n: 'USA', s: 5, p: [-105, 40] },
    { k: 'CAN', n: 'Canada', s: 4, p: [-115, 56] },
  ];
  SUP.forEach((d) => {
    d.arc = { type: 'LineString', coordinates: [d.p, JP] };
    d.km = Math.round(d3.geoDistance(d.p, JP) * 6371 / 100) * 100;
  });
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = root.querySelector('.globe-stage');
  const info = root.querySelector('.globe-info');
  const chips = root.querySelector('.globe-chips');

  const canvas = document.createElement('canvas');
  const flow = document.createElement('canvas');
  flow.className = 'globe-flow'; flow.setAttribute('aria-hidden', 'true');
  canvas.className = 'globe-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', root.dataset.label + ' Drag or use the arrow keys to turn the globe.');
  stage.append(flow, canvas);
  root.classList.add('is-globe');
  chips.hidden = false;
  const ctx = canvas.getContext('2d'), fctx = flow.getContext('2d');
  const proj = d3.geoOrthographic().clipAngle(90).precision(1.5);
  const path = d3.geoPath(proj, ctx), fpath = d3.geoPath(proj, fctx);
  const grat = d3.geoGraticule().step([30, 30])();
  const supplierLand = { type: 'GeometryCollection', geometries: Object.keys(S.hi).filter((k) => k !== 'JPN').map((k) => S.hi[k]) };

  let rot = [-178, -4], size = 0, dpr = 1, t = 0, focus = -1, picked = -1;
  let tween = null, live = false, last = 0, frame = 0, dirty = true, scrollQuiet = 0;

  const centre = () => [-rot[0], -rot[1]];
  const seen = (p) => d3.geoDistance(p, centre()) < Math.PI / 2 - 0.05;

  function draw() {
    if (!size) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    proj.rotate(rot);
    const u = size / 320;
    const sphere = { type: 'Sphere' };
    ctx.beginPath(); path(sphere); ctx.fillStyle = '#0c2a38'; ctx.fill();
    ctx.beginPath(); path(grat); ctx.strokeStyle = 'rgba(230, 243, 247, .07)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); path(S.land); ctx.fillStyle = '#163f50'; ctx.fill();
    ctx.beginPath(); path(supplierLand); ctx.fillStyle = '#22596b'; ctx.fill();
    if (focus >= 0) { ctx.beginPath(); path(S.hi[SUP[focus].k]); ctx.fillStyle = '#2f8195'; ctx.fill(); }
    ctx.beginPath(); path(S.hi.JPN); ctx.fillStyle = '#ffb347'; ctx.fill();
    ctx.lineCap = 'round';
    SUP.forEach((d, i) => {
      ctx.beginPath(); path(d.arc);
      ctx.strokeStyle = i === focus ? 'rgba(98, 198, 217, .95)' : 'rgba(98, 198, 217, .5)';
      ctx.lineWidth = (1.2 + d.s * 0.17) * u;
      ctx.stroke();
    });
    ctx.beginPath(); path(sphere); ctx.strokeStyle = 'rgba(230, 243, 247, .28)'; ctx.lineWidth = 1; ctx.stroke();

    const fs = Math.max(12, Math.min(14, size / 24));
    const label = (x, y, name, share, colour, bold) => {
      ctx.font = `${bold ? 700 : 600} ${fs}px "Times New Roman", Tinos, Times, serif`;
      const w1 = ctx.measureText(name + ' ').width;
      ctx.font = `500 ${fs * 0.9}px "IBM Plex Mono", ui-monospace, Consolas, monospace`;
      const w2 = share ? ctx.measureText(share).width : 0;
      const left = x > size * 0.68;
      let lx = left ? x - 8 - w1 - w2 : x + 8;
      const ly = y + fs * 0.35;
      ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = '#081a25';
      ctx.font = `${bold ? 700 : 600} ${fs}px "Times New Roman", Tinos, Times, serif`;
      ctx.strokeText(name, lx, ly); ctx.fillStyle = colour; ctx.fillText(name, lx, ly);
      if (share) {
        ctx.font = `500 ${fs * 0.9}px "IBM Plex Mono", ui-monospace, Consolas, monospace`;
        ctx.strokeText(share, lx + w1, ly); ctx.fillStyle = '#62c6d9'; ctx.fillText(share, lx + w1, ly);
      }
    };
    SUP.forEach((d, i) => {
      if (!seen(d.p)) return;
      const [x, y] = proj(d.p);
      ctx.beginPath(); ctx.arc(x, y, (i === focus ? 4.5 : 3.5) * u, 0, 2 * Math.PI);
      ctx.fillStyle = '#62c6d9'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#081a25'; ctx.stroke();
      label(x, y, d.n, d.s + '%', '#e6f3f7', i === focus);
    });
    if (seen(JP)) {
      const [x, y] = proj(JP);
      ctx.beginPath(); ctx.arc(x, y, 5 * u, 0, 2 * Math.PI); ctx.fillStyle = '#ffb347'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#081a25'; ctx.stroke();
      label(x, y, 'Japan', '', '#ffb347', true);
    }
  }

  function drawFlow() {
    if (!size || calm) return;
    const u = size / 320;
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.clearRect(0, 0, size, size);
    fctx.beginPath(); SUP.forEach((d) => fpath(d.arc));   // dashes run toward Japan
    fctx.setLineDash([1.5 * u, 11 * u]); fctx.lineDashOffset = -t * u; fctx.lineCap = 'round';
    fctx.strokeStyle = 'rgba(230, 243, 247, .8)'; fctx.lineWidth = 1.6 * u; fctx.stroke();
  }

  function setFocus(i) {
    if (i === focus) return;
    focus = i; dirty = true;
    const d = SUP[i];
    info.innerHTML = i < 0 ? '' : `<b>${d.n}</b> supplied <b>${d.s}%</b> of Japan&rsquo;s metal ore, from about <span>${d.km.toLocaleString('en-US')} km</span> away.`;
    chips.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === picked)));
  }
  // after a drag, follow the supplier nearest the middle of the view
  function autoFocus() {
    if (picked >= 0) return;
    let best = -1, bd = Infinity;
    SUP.forEach((d, i) => { const g = d3.geoDistance(d.p, centre()); if (g < Math.PI / 2 - 0.2 && g < bd) { bd = g; best = i; } });
    if (best >= 0) setFocus(best);
  }

  function turnTo(i) {
    picked = i; setFocus(i);
    const d = SUP[i], mid = d3.geoInterpolate(d.p, JP)(0.5);
    const go = d3.geoInterpolate(centre(), mid);
    if (calm) { const c = go(1); rot = [-c[0], -c[1]]; draw(); return; }
    tween = { go, t0: performance.now(), dur: 1100 };
  }

  function tick(now) {
    frame = 0;
    if (!live) return;
    const dt = Math.min(64, now - (last || now)); last = now;
    frame = requestAnimationFrame(tick);
    if (now < scrollQuiet) return;   // hold still while the page scrolls
    t += dt * 0.025;
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / tween.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const c = tween.go(e); rot = [-c[0], -c[1]]; dirty = true;
      if (k === 1) tween = null;
    }
    if (dirty) { draw(); dirty = false; }
    drawFlow();
  }
  function start() { if (!frame && live && !calm) { last = 0; frame = requestAnimationFrame(tick); } }

  // drag to spin; on touch only sideways drags turn it, so the page still scrolls
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, r: rot.slice(), touch: e.pointerType === 'touch' };
    canvas.setPointerCapture(e.pointerId); tween = null; canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = 180 / (size * 1.15);
    rot[0] = drag.r[0] + (e.clientX - drag.x) * k;
    if (!drag.touch) rot[1] = Math.max(-60, Math.min(60, drag.r[1] - (e.clientY - drag.y) * k));
    picked = -1; autoFocus(); dirty = true; if (calm) { draw(); drawFlow(); }
  });
  const end = () => { drag = null; canvas.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: [10, 0], ArrowRight: [-10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[e.key];
    if (!step) return;
    e.preventDefault(); tween = null;
    rot = [rot[0] + step[0], Math.max(-60, Math.min(60, rot[1] + step[1]))];
    picked = -1; autoFocus(); draw(); drawFlow();
  });
  chips.querySelectorAll('button').forEach((b, i) => b.addEventListener('click', () => turnTo(i)));

  function resize() {
    const w = Math.round(stage.clientWidth);
    if (!w) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2); size = w;
    canvas.width = flow.width = w * dpr; canvas.height = flow.height = w * dpr;
    proj.translate([w / 2, w / 2]).scale(w / 2 - 2);
    draw(); drawFlow();
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  autoFocus(); if (focus < 0) setFocus(0); draw();
  // labels are drawn on the canvas, so redraw once the web fonts arrive
  if (document.fonts) document.fonts.ready.then(() => { draw(); drawFlow(); });

  window.addEventListener('scroll', () => { scrollQuiet = performance.now() + 220; }, { passive: true });

  // only animate while the panel is on screen and the tab is visible
  let inView = false;
  const update = () => { live = inView && !document.hidden; start(); };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { inView = es[0].isIntersecting; update(); }).observe(root);
    document.addEventListener('visibilitychange', update);
  }
})();

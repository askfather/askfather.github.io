/* 神父，請問…… — app shell. No framework, no external requests. */
(() => {
'use strict';

// ---------- storage (safe) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('af.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('af.' + k, JSON.stringify(v)); } catch {} }
};

const FONT_STEPS = [15, 16, 17, 18, 20, 22, 25];
const state = {
  script: store.get('script', /^zh-(cn|sg|hans)/i.test(navigator.language || '') ? 'hans' : 'hant'),
  font: store.get('font', 3),
  favs: store.get('favs', []),
  recent: store.get('recent', []),
  query: '',
  packs: {},
  search: null,
  t2s: null,
};

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- data ----------
async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}
async function pack() {
  if (!state.packs[state.script]) state.packs[state.script] = await getJSON(`data/${state.script}/pack.json`);
  return state.packs[state.script];
}
async function searchData() {
  if (!state.search) {
    const [idx, map] = await Promise.all([getJSON('data/search.json'), getJSON('data/t2s.json')]);
    state.search = idx;
    state.t2s = new Map();
    const ch = Array.from(map);
    for (let i = 0; i < ch.length; i += 2) state.t2s.set(ch[i], ch[i + 1]);
  }
}
const norm = s => Array.from(s, c => state.t2s.get(c) || c).join('').toLowerCase();

// ---------- ui helpers ----------
let P; // current pack
const T = k => (P && P.ui[k]) || k;
const cardBy = slug => P.cards.find(c => c.slug === slug);

function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = esc(msg) + (action ? ` <button type="button">${esc(action.label)}</button>` : '');
  if (action) el.querySelector('button').onclick = action.fn;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), action ? 10000 : 2200);
}

function applyChrome() {
  document.documentElement.lang = state.script === 'hans' ? 'zh-Hans' : 'zh-Hant';
  document.documentElement.style.setProperty('--fs', FONT_STEPS[state.font] + 'px');
  $('#bar-title').textContent = T('appName');
  $('#btn-script').textContent = state.script === 'hans' ? '简｜繁' : '繁｜简';
  $('#btn-script').setAttribute('aria-label', state.script === 'hans' ? '切换为繁体' : '切換為簡體');
  $('#btn-about').setAttribute('aria-label', T('about'));
}

const ICON = {
  search: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  star: on => `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  share: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4 4 4M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="m4 18 5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};

function cardRow(c, sub) {
  return `<li><a href="#/q/${esc(c.slug)}"><span class="t"><b>${esc(c.title)}</b>${sub ? `<small>${sub}</small>` : ''}</span>${ICON.chev}</a></li>`;
}
function cardList(cards, sub) {
  return cards.length ? `<ul class="list">${cards.map(c => cardRow(c, sub && sub(c))).join('')}</ul>` : '';
}
const count = n => `<span class="n">${n} ${esc(T('questionsCount'))}</span>`;

// ---------- views ----------
function viewHome() {
  document.title = T('appName');
  view.innerHTML = `
    <div class="hero"><img src="icons/icon-round-512.png" alt="${esc(T('appName'))}"></div>
    <div class="search">${ICON.search}<input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="${esc(T('searchPlaceholder'))}" aria-label="${esc(T('searchPlaceholder'))}"></div>
    <div id="results"></div>
    <div id="home-body"></div>`;
  const q = $('#q');
  q.value = state.query;
  q.addEventListener('input', () => { state.query = q.value; renderResults(); });
  renderResults();
}

function homeBody() {
  const favs = state.favs.map(cardBy).filter(Boolean);
  const recent = state.recent.map(cardBy).filter(Boolean);
  const topicCount = id => P.cards.filter(c => c.topics.includes(id)).length;
  let h = '';
  if (favs.length) h += `<h2 class="group">${esc(T('favourites'))}</h2>${cardList(favs.slice(0, 5))}` +
    (favs.length > 5 ? `<p><a href="#/fav">${esc(T('favourites'))} (${favs.length}) →</a></p>` : '');
  if (recent.length) h += `<h2 class="group">${esc(T('recent'))}</h2>${cardList(recent.slice(0, 5))}`;
  h += `<h2 class="group">${esc(T('sections'))}</h2><ul class="list">` +
    P.sections.map(s => `<li><a href="#/s/${s.id}"><span class="t"><b>${esc(s.title)}</b><small>${esc(s.desc || '')}</small></span>${count(P.cards.filter(c => c.section === s.id).length)}${ICON.chev}</a></li>`).join('') + '</ul>';
  h += `<h2 class="group">${esc(T('topics'))}</h2><div class="chips">` +
    P.topics.map(t => { const n = topicCount(t.id); return n ? `<a class="chip" href="#/t/${t.id}">${esc(t.name)}<span class="c">${n}</span></a>` : ''; }).join('') + '</div>';
  return h;
}

function highlight(text, terms) {
  if (!terms.length) return esc(text);
  const n = norm(text);
  const marks = new Array(text.length).fill(false);
  const chars = Array.from(text);
  // norm is char-for-char, so indices line up (Array.from handles surrogate pairs)
  const nchars = Array.from(n);
  const nstr = nchars.join('');
  for (const t of terms) {
    let i = nstr.indexOf(t);
    while (i !== -1) { for (let k = 0; k < Array.from(t).length; k++) marks[i + k] = true; i = nstr.indexOf(t, i + 1); }
  }
  let out = '', open = false;
  chars.forEach((c, i) => {
    if (marks[i] && !open) { out += '<mark>'; open = true; }
    if (!marks[i] && open) { out += '</mark>'; open = false; }
    out += esc(c);
  });
  return out + (open ? '</mark>' : '');
}

async function renderResults() {
  const box = $('#results'), body = $('#home-body');
  if (!box) return;
  const raw = state.query.trim();
  if (!raw) { box.innerHTML = ''; body.innerHTML = homeBody(); return; }
  await searchData();
  const terms = norm(raw).split(/\s+/).filter(Boolean);
  const W = { t: 10, k: 6, s: 4, o: 3, b: 1 };
  const hits = [];
  for (const e of state.search) {
    let score = 0, all = true;
    for (const t of terms) {
      let s = 0;
      for (const f in W) if (e[f] && e[f].includes(t)) s += W[f];
      if (!s) { all = false; break; }
      score += s;
    }
    if (all) hits.push({ slug: e.slug, score });
  }
  hits.sort((a, b) => b.score - a.score);
  const cards = hits.map(h => cardBy(h.slug)).filter(Boolean);
  body.innerHTML = '';
  box.innerHTML = `<h2 class="group">${esc(T('results'))} · ${cards.length}</h2>` + (cards.length
    ? `<ul class="list">${cards.map(c => `<li><a href="#/q/${esc(c.slug)}"><span class="t"><b>${highlight(c.title, terms)}</b><small>${highlight(c.short, terms)}</small></span>${ICON.chev}</a></li>`).join('')}</ul>`
    : `<p class="empty">${esc(T('noResults'))}</p>`);
}

function viewSection(id) {
  const s = P.sections.find(x => x.id === id);
  if (!s) return viewNotFound();
  document.title = s.title + ' · ' + T('appName');
  const cards = P.cards.filter(c => c.section === id);
  view.innerHTML = `<div class="page-head"><h1>${esc(s.title)}</h1><p>${esc(s.desc || '')}</p></div>` +
    cardList(cards, c => esc(c.short));
}

function viewTopic(id) {
  const t = P.topics.find(x => x.id === id);
  if (!t) return viewNotFound();
  document.title = t.name + ' · ' + T('appName');
  const cards = P.cards.filter(c => c.topics.includes(id));
  const chips = P.topics.filter(x => P.cards.some(c => c.topics.includes(x.id)))
    .map(x => `<a class="chip${x.id === id ? ' on' : ''}" href="#/t/${x.id}">${esc(x.name)}</a>`).join('');
  view.innerHTML = `<div class="page-head"><h1>${esc(t.name)}</h1></div><div class="chips" style="margin:6px 0 18px">${chips}</div>` +
    cardList(cards, c => esc(c.short));
}

function viewFavs() {
  document.title = T('favourites') + ' · ' + T('appName');
  const favs = state.favs.map(cardBy).filter(Boolean);
  view.innerHTML = `<div class="page-head"><h1>${esc(T('favourites'))}</h1></div>` +
    (favs.length ? cardList(favs, c => esc(c.short)) : `<p class="empty">${esc(T('noFavourites'))}</p>`);
}

function viewAbout() {
  document.title = T('about') + ' · ' + T('appName');
  view.innerHTML = `<article class="about"><div class="page-head"><h1>${esc(T('appName'))}</h1></div><div class="body">${P.about}</div></article>`;
}

function viewNotFound() {
  view.innerHTML = `<p class="empty">${esc(T('notFound'))}</p><p><a href="#/">← ${esc(T('home'))}</a></p>`;
}

function viewCard(slug) {
  const c = cardBy(slug);
  if (!c) return viewNotFound();
  document.title = c.title + ' · ' + T('appName');
  state.recent = [slug, ...state.recent.filter(s => s !== slug)].slice(0, 10);
  store.set('recent', state.recent);
  const fav = state.favs.includes(slug);
  const topicName = id => (P.topics.find(t => t.id === id) || {}).name || id;
  const refs = (c.scripture.length || c.magisterium.length) ? `
    <h2>${esc(T('references'))}</h2><div class="refs">
      ${c.scripture.length ? `<h4>${esc(T('scripture'))}</h4><ul>${c.scripture.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      ${c.magisterium.length ? `<h4>${esc(T('magisterium'))}</h4><ul>${c.magisterium.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
    </div>` : '';
  const related = c.related.length ? `<h2>${esc(T('related'))}</h2><ul class="list">` + c.related.map(r => r.planned
    ? `<li class="planned"><span class="row"><span class="t"><b>${esc(r.title)}</b></span><span class="n">${esc(T('comingSoon'))}</span></span></li>`
    : cardRow(r)).join('') + '</ul>' : '';
  view.innerHTML = `
  <article class="card">
    <div class="ask">${esc(T('askLabel'))}</div>
    <h1>${esc(c.question)}</h1>
    ${c.status === 'draft' ? `<span class="badge">${esc(T('draft'))}</span>` : ''}
    <div class="tools">
      <button class="tool" data-act="smaller" aria-label="${esc(T('fontSmaller'))}">A−</button>
      <button class="tool" data-act="larger" aria-label="${esc(T('fontLarger'))}">A+</button>
      <button class="tool grow${fav ? ' fav-on' : ''}" data-act="fav" aria-pressed="${fav}">${ICON.star(fav)}<span>${esc(fav ? T('unfav') : T('fav'))}</span></button>
      <button class="tool" data-act="share">${ICON.share}<span>${esc(T('share'))}</span></button>
    </div>
    <section class="short"><div class="lbl">${esc(T('shortAnswer'))}</div><p>${esc(c.short)}</p></section>
    <h2>${esc(T('answer'))}</h2>
    <div class="body">${c.answer}</div>
    ${c.objections.length ? `<h2>${esc(T('objections'))}</h2><div class="body">${c.objections.map(o => `<div class="obj"><div class="q">${esc(o.q)}</div><div class="a">${o.a}</div></div>`).join('')}</div>` : ''}
    ${refs}
    ${related}
    ${c.xundao ? `<h2>${esc(T('xundao'))}</h2><p><a href="${esc(c.xundao)}">${esc(c.xundao)}</a></p>` : ''}
    <div class="meta chips">${c.topics.map(t => `<a class="chip" href="#/t/${t}">${esc(topicName(t))}</a>`).join('')}</div>
  </article>`;
  view.querySelector('.tools').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'smaller' || act === 'larger') {
      state.font = Math.max(0, Math.min(FONT_STEPS.length - 1, state.font + (act === 'larger' ? 1 : -1)));
      store.set('font', state.font); applyChrome();
    } else if (act === 'fav') {
      const on = !state.favs.includes(slug);
      state.favs = on ? [slug, ...state.favs] : state.favs.filter(s => s !== slug);
      store.set('favs', state.favs);
      b.classList.toggle('fav-on', on); b.setAttribute('aria-pressed', on);
      b.innerHTML = ICON.star(on) + `<span>${esc(on ? T('unfav') : T('fav'))}</span>`;
    } else if (act === 'share') openShare(c);
  });
}

// ---------- sharing ----------
const cardLink = c => location.href.split('#')[0] + '#/q/' + c.slug;
const shareText = c => `${T('askLabel')}：${c.question}\n\n${c.short}\n\n——「${T('appName')}」\n${cardLink(c)}`;

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch {}
  ta.remove(); return ok;
}

function closeSheet() { const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; }
function openSheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sheet-box" role="dialog" aria-modal="true">${html}<button class="sheet-btn" data-act="close" style="justify-content:center">${esc(T('close'))}</button></div>`;
  s.hidden = false;
  s.onclick = e => { if (e.target === s || e.target.closest('[data-act=close]')) closeSheet(); };
}

function openShare(c) {
  openSheet(`<h3>${esc(T('share'))}</h3>
    <button class="sheet-btn" data-s="link">${ICON.link}${esc(T('shareLink'))}</button>
    <button class="sheet-btn" data-s="image">${ICON.image}${esc(T('shareImage'))}</button>
    <button class="sheet-btn" data-s="text">${ICON.copy}${esc(T('copyText'))}</button>`);
  $('#sheet').querySelector('.sheet-box').addEventListener('click', async e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    if (b.dataset.s === 'link') {
      if (navigator.share) {
        try { await navigator.share({ title: c.title, text: c.question, url: cardLink(c) }); closeSheet(); return; }
        catch (err) { if (err && err.name === 'AbortError') return; }
      }
      closeSheet(); toast((await copy(cardLink(c))) ? T('linkCopied') : cardLink(c));
    } else if (b.dataset.s === 'text') {
      closeSheet(); if (await copy(shareText(c))) toast(T('copied'));
    } else if (b.dataset.s === 'image') {
      shareImage(c);
    }
  });
}

// --- render question + 簡答 as an image ---
const NO_START = '，。、；：？！」』）〕》〉…—·．,.;:?!)]%';
const NO_END = '「『（〔《〈([';
function tokens(s) { return s.match(/[A-Za-z0-9][A-Za-z0-9.:'’\-–]*|[\s\S]/gu) || []; }
function wrap(ctx, text, maxW) {
  const lines = []; let line = '';
  for (const tk of tokens(text)) {
    const test = line + tk;
    if (ctx.measureText(test).width <= maxW || !line) { line = test; continue; }
    if (NO_START.includes(tk[0])) {               // keep closing punctuation on this line (hang)
      line = test; continue;
    }
    let carry = '';
    while (line && NO_END.includes(line[line.length - 1])) { carry = line[line.length - 1] + carry; line = line.slice(0, -1); }
    lines.push(line); line = (carry + tk).replace(/^\s+/, '');
  }
  if (line) lines.push(line);
  return lines;
}
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

async function renderShareImage(c) {
  const css = getComputedStyle(document.documentElement);
  const sans = css.getPropertyValue('--sans'), serif = css.getPropertyValue('--serif');
  const Wd = 1080, pad = 84, inner = Wd - pad * 2;
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  const qFont = `700 58px ${sans}`, aFont = `400 40px ${serif}`;
  ctx.font = qFont; const qLines = wrap(ctx, c.question, inner);
  ctx.font = aFont; const aLines = wrap(ctx, c.short, inner - 36);
  const headH = 170, qLH = 84, aLH = 70;
  const H = headH + 90 + 50 + qLines.length * qLH + 50 + 70 + aLines.length * aLH + 60 + 130;
  const scale = 1;
  cv.width = Wd * scale; cv.height = H * scale; ctx.scale(scale, scale);
  // background
  ctx.fillStyle = '#F8F5EF'; ctx.fillRect(0, 0, Wd, H);
  // header band
  ctx.fillStyle = '#172B4D'; ctx.fillRect(0, 0, Wd, headH);
  const icon = await loadImg('icons/icon-192.png');
  ctx.save(); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(pad, 37, 96, 96, 22) : ctx.rect(pad, 37, 96, 96); ctx.clip();
  ctx.drawImage(icon, pad, 37, 96, 96); ctx.restore();
  ctx.fillStyle = '#F8F5EF'; ctx.font = `700 50px ${sans}`; ctx.textBaseline = 'middle';
  ctx.fillText(T('appName'), pad + 124, headH / 2 + 2);
  ctx.fillStyle = '#C6A46A'; ctx.fillRect(0, headH, Wd, 6);
  // question
  let y = headH + 90;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#9C7B3E'; ctx.font = `700 32px ${sans}`;
  ctx.fillText(T('askLabel').split('').join(' '), pad, y);
  y += 50;
  ctx.fillStyle = '#172B4D'; ctx.font = qFont;
  for (const l of qLines) { y += qLH - 20; ctx.fillText(l, pad, y); y += 20; }
  y += 50;
  // short answer box
  const boxTop = y, boxH = 70 + aLines.length * aLH + 24;
  ctx.fillStyle = '#F0E7D6'; ctx.fillRect(pad, boxTop, inner, boxH);
  ctx.fillStyle = '#C6A46A'; ctx.fillRect(pad, boxTop, 8, boxH);
  ctx.fillStyle = '#6B7380'; ctx.font = `700 28px ${sans}`;
  ctx.fillText(T('shortAnswer').split('').join(' '), pad + 36, boxTop + 52);
  ctx.fillStyle = '#303A46'; ctx.font = aFont;
  let ay = boxTop + 70;
  for (const l of aLines) { ay += aLH - 16; ctx.fillText(l, pad + 36, ay); ay += 16; }
  // footer
  const fy = H - 100;
  ctx.fillStyle = '#557C78'; ctx.fillRect(pad, fy, 60, 4);
  ctx.fillStyle = '#557C78'; ctx.font = `400 30px ${sans}`;
  const host = location.host ? location.host + location.pathname.replace(/index\.html$/, '') : '';
  ctx.fillText(`${T('appName')}${host ? '　' + host : ''}`, pad, fy + 52);
  return cv;
}

async function shareImage(c) {
  const cv = await renderShareImage(c);
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const url = URL.createObjectURL(blob);
  const file = new File([blob], `${c.slug}.png`, { type: 'image/png' });
  const canShareFile = navigator.canShare && navigator.canShare({ files: [file] });
  openSheet(`<img class="sheet-img" src="${url}" alt="${esc(c.question)}">
    <p class="hint">${esc(T('saveImageHint'))}</p>
    ${canShareFile ? `<button class="sheet-btn primary" data-i="share" style="justify-content:center">${ICON.share}${esc(T('share'))}</button>` : ''}
    <a class="sheet-btn" style="justify-content:center" href="${url}" download="${esc(c.slug)}.png">${ICON.image}${esc(T('download'))}</a>`);
  const b = $('#sheet [data-i=share]');
  if (b) b.onclick = async () => { try { await navigator.share({ files: [file], title: c.title }); } catch {} };
}

// ---------- router ----------
async function route() {
  closeSheet();
  P = await pack();
  applyChrome();
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [kind, arg] = h.split('/');
  if (kind === 'q' && arg) viewCard(arg);
  else if (kind === 's' && arg) viewSection(arg);
  else if (kind === 't' && arg) viewTopic(arg);
  else if (kind === 'fav') viewFavs();
  else if (kind === 'about') viewAbout();
  else viewHome();
  if (!(kind === '' && state.query)) window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}

$('#btn-script').addEventListener('click', () => {
  state.script = state.script === 'hans' ? 'hant' : 'hans';
  store.set('script', state.script);
  const y = window.scrollY;
  route().then(() => window.scrollTo(0, y));
});
window.addEventListener('hashchange', route);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
route().catch(err => { view.innerHTML = `<p class="empty">${esc(err.message)}</p>`; });

// ---------- offline / updates ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => toast(T('updateReady'), { label: T('reload'), fn: () => w.postMessage('skipWaiting') });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed') navigator.serviceWorker.controller ? offer(w) : toast(T('offlineReady'));
      });
    });
  }).catch(() => {});
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
}
})();

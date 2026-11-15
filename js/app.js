// Mel Shop — uygulama: yönlendirme, sayfalar, olaylar
import { store, shrinkImage, blobToDataURL, dataURLToBlob } from "./store.js";
import {
  DEFAULT_CATS, FIELD_DEFS, STATUS, LIST_TO_STATUS, LIST_TITLE, PRIORITY, PRIORITY_ORDER, AGAIN, SUBSCORES, HUE,
  PICKABLE_ICONS, ic, esc, num, tl, safeUrl, lower, uid, today, fmtDate, cimriUrl, lowest, slug
} from "./data.js";

const S = { items: [], cats: [], lastBackup: null, noticeHiddenAt: null };
const photoURL = new Map();
const $ = sel => document.querySelector(sel);
const app = () => $("#app");
let lastPath = null;
let installEvt = null;

/* ================= yardımcılar ================= */
const byId = id => S.items.find(x => x.id === id);
const catOf = id => S.cats.find(c => c.id === id) || { id, name: "Diğer", icon: "etiket" };
const defsOf = catId => FIELD_DEFS[catId] || [];
const groupDef = catId => defsOf(catId).find(d => d.group);
const counts = list => ({ owned: list.filter(x => x.status === "owned").length, missing: list.filter(x => x.status === "missing").length, wish: list.filter(x => x.status === "wish").length });
const covOf = list => { const c = counts(list); const t = c.owned + c.missing; return t ? Math.round(c.owned / t * 100) : 0; };
const basketOf = list => list.filter(x => x.status === "missing").reduce((s, x) => s + (lowest(x)?.v || 0), 0);
const scoreOf = x => typeof x.marketScore === "number" ? x.marketScore : typeof x.rating === "number" ? x.rating : -1;
const hueOf = x => HUE[x.fields?.sub] ?? HUE[x.cat] ?? 200;
const clone = o => JSON.parse(JSON.stringify(o));
function sortItems(list, mode) {
  const a = [...list];
  const pri = x => PRIORITY_ORDER[x.priority] ?? 1;
  const priceOf = x => x.status === "owned" ? (x.paid ?? Infinity) : (lowest(x)?.v ?? Infinity);
  if (mode === "ad") a.sort((p, q) => p.name.localeCompare(q.name, "tr"));
  else if (mode === "fiyat") a.sort((p, q) => priceOf(p) - priceOf(q) || p.name.localeCompare(q.name, "tr"));
  else if (mode === "yeni") a.sort((p, q) => String(q.createdAt).localeCompare(String(p.createdAt)));
  else if (mode === "oncelik") a.sort((p, q) => pri(p) - pri(q) || p.name.localeCompare(q.name, "tr"));
  else a.sort((p, q) => scoreOf(q) - scoreOf(p) || pri(p) - pri(q) || p.name.localeCompare(q.name, "tr"));
  return a;
}
function parseHash() {
  const raw = decodeURIComponent((location.hash || "#/").slice(1));
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  return { parts, q: new URLSearchParams(query || ""), path };
}
const go = h => { location.hash = h; };
function setQuery(updates) {
  const { path, q } = parseHash();
  for (const [k, v] of Object.entries(updates)) { if (v == null || v === "") q.delete(k); else q.set(k, v); }
  const s = q.toString();
  location.hash = "#" + path + (s ? "?" + s : "");
}

async function loadPhotos(ids) {
  await Promise.all(ids.filter(id => id && !photoURL.has(id)).map(async id => {
    const rec = await store.getPhoto(id).catch(() => null);
    if (rec?.blob) photoURL.set(id, URL.createObjectURL(rec.blob));
  }));
}
function visual(x, opts = {}) {
  const pid = (x.photos || [])[opts.index || 0];
  const u = pid && photoURL.get(pid);
  if (u) return `<img class="photo" src="${u}" alt="${esc(x.name)}" loading="lazy">`;
  return `<div class="ph" style="--h:${hueOf(x)}"><span class="w">${esc(x.brand || x.name)}</span><span class="cam">${ic("camera")}Fotoğraf yok</span></div>`;
}
function meter(v, max = 10, cls = "") { let h = ""; for (let i = 1; i <= max; i++) h += `<i class="${i <= v ? "f" : ""}"></i>`; return `<span class="meter ${cls}" aria-hidden="true">${h}</span>`; }
function dots(v) { let h = ""; for (let i = 1; i <= 5; i++) h += `<i class="${i <= v ? "f" : ""}"></i>`; return `<span class="dots" aria-hidden="true">${h}</span>`; }

/* ================= bildirim ================= */
let toastTimer;
function toast(msg, actions = []) {
  const t = $("#toast");
  clearTimeout(toastTimer);
  t.innerHTML = `<span>${esc(msg)}</span>` + actions.map((a, i) => `<button type="button" data-ti="${i}">${esc(a.label)}</button>`).join("");
  t.onclick = e => { const b = e.target.closest("[data-ti]"); if (!b) return; t.hidden = true; actions[+b.dataset.ti].run(); };
  t.hidden = false;
  toastTimer = setTimeout(() => { t.hidden = true; }, 6500);
}

/* ================= veri işlemleri ================= */
async function saveItem(item, { silent } = {}) {
  item.updatedAt = new Date().toISOString();
  await store.putItem(item);
  const i = S.items.findIndex(x => x.id === item.id);
  if (i >= 0) S.items[i] = item; else S.items.push(item);
  if (!silent) rerender();
}
async function moveStatus(id, to) {
  const prev = byId(id); if (!prev || prev.status === to) return;
  const next = clone(prev);
  next.status = to;
  if (to === "owned" && !next.boughtAt) next.boughtAt = today();
  if (to === "missing" && prev.status === "owned") next.priority = "yuksek";
  await saveItem(next);
  const acts = [{ label: "Geri al", run: () => saveItem(prev) }];
  if (to === "owned") acts.unshift({ label: "Fiyat ve puan ekle", run: () => go(`#/duzenle/${id}`) });
  toast(`${next.name} → ${{ owned: "Elimdekilere", missing: "Sepete", wish: "Favorilere" }[to]} taşındı`, acts);
}
async function deleteItem(id) {
  const prev = byId(id); if (!prev) return;
  const photos = [];
  for (const pid of prev.photos || []) { const r = await store.getPhoto(pid).catch(() => null); if (r) photos.push(r); }
  await store.deleteItem(id);
  S.items = S.items.filter(x => x.id !== id);
  for (const pid of prev.photos || []) { const u = photoURL.get(pid); if (u) URL.revokeObjectURL(u); photoURL.delete(pid); }
  if (parseHash().parts[0] === "u") go(`#/k/${prev.cat}`); else rerender();
  toast(`${prev.name} silindi`, [{ label: "Geri al", run: async () => { for (const p of photos) await store.putPhoto(p); await saveItem(prev); } }]);
}

/* ================= üst bant ================= */
function renderChrome(activeCat) {
  const c = counts(S.items);
  $("#cnt-owned").textContent = c.owned;
  $("#cnt-wish").textContent = c.wish;
  $("#cnt-missing").textContent = c.missing;
  $("#cats").innerHTML = S.cats.map(cat => {
    const n = S.items.filter(x => x.cat === cat.id).length;
    return `<a class="cat${cat.id === activeCat ? " on" : ""}" href="#/k/${esc(cat.id)}">${ic(cat.icon)}${esc(cat.name)}<small>${n}</small></a>`;
  }).join("") + `<a class="cat" href="#/ayarlar" title="Kategori ekle">${ic("plus")}<span class="sr">Kategori ekle</span></a>`;
}

/* ================= kart ================= */
function card(x) {
  const st = STATUS[x.status];
  const lo = lowest(x);
  let score = "";
  if (x.status === "owned") score = typeof x.marketScore === "number" ? `<span class="score">Piyasa ${x.marketScore}/10</span>` : typeof x.rating === "number" ? `<span class="score mine">Senin ${x.rating}/10</span>` : `<span class="score mine">Puanlanmadı</span>`;
  let body = "", acts = "";
  if (x.status === "owned") {
    if (x.paid != null) body = `<div class="price"><small>Ödediğin: ${tl(x.paid)}</small></div>`;
    acts = `<a class="btn sm" href="#/duzenle/${esc(x.id)}?b=puan">${typeof x.rating === "number" ? "Puanı düzenle" : "Puanla"}</a>` +
      (x.fields?.rebuy ? `<button type="button" class="link" data-act="rebuy" data-id="${esc(x.id)}">Bitti, yeniden al</button>` : "");
  } else {
    body = `<div class="price"><b>${lo ? tl(lo.v) : "Fiyat yok"}</b><small>${lo ? "En uygun: " + esc(lo.label) : "Henüz fiyat eklenmedi"}</small></div>`;
    acts = `<button type="button" class="btn sm${x.status === "missing" ? " fill" : ""}" data-act="${x.status === "missing" ? "bought" : "tocart"}" data-id="${esc(x.id)}">${x.status === "missing" ? "Aldım" : "Sepete taşı"}</button>` +
      `<a class="link" href="${esc(lo ? safeUrl(lo.url) : cimriUrl(x))}" target="_blank" rel="noopener">${lo ? "Karşılaştır" : "Cimri'de ara"} ${ic("out")}</a>`;
  }
  const brand = x.brand || x.fields?.sub || catOf(x.cat).name;
  return `<article class="card">
    <a class="cover" href="#/u/${esc(x.id)}">${visual(x)}<span class="badge ${x.status}">${ic(st.icon)}${st.label}</span></a>
    <div class="meta"><span class="brand">${esc(brand)}</span>${score}</div>
    <h3 class="name"><a href="#/u/${esc(x.id)}">${esc(x.name)}</a></h3>${body}<div class="row">${acts}</div></article>`;
}
const grid = list => list.length ? `<div class="grid">${list.map(card).join("")}</div>` : "";

/* ================= ana sayfa ================= */
async function viewHome() {
  const c = counts(S.items), cov = covOf(S.items), basket = basketOf(S.items);
  const scored = S.items.filter(x => x.status === "owned" && typeof x.marketScore === "number").sort((a, b) => b.marketScore - a.marketScore);
  const top = scored[0];
  const missing = sortItems(S.items.filter(x => x.status === "missing"), "oncelik");
  const owned = sortItems(S.items.filter(x => x.status === "owned"), "puan");
  const wish = sortItems(S.items.filter(x => x.status === "wish"), "oncelik");
  await loadPhotos([...missing.slice(0, 10), ...owned.slice(0, 10), ...wish.slice(0, 10), top].filter(Boolean).map(x => (x.photos || [])[0]));
  const avg = scored.length ? (scored.reduce((s, x) => s + x.marketScore, 0) / scored.length) : null;
  const days = S.lastBackup ? (Date.now() - new Date(S.lastBackup)) / 864e5 : Infinity;
  const hid = S.noticeHiddenAt ? (Date.now() - new Date(S.noticeHiddenAt)) / 864e5 < 3 : false;
  const notice = S.items.length && days > 14 && !hid
    ? `<div class="notice" role="status"><span>${S.lastBackup ? `Son yedeğin ${Math.floor(days)} gün önce alındı.` : "Henüz yedek almadın."} Veriler sadece bu tarayıcıda duruyor.</span><span style="display:flex;gap:10px;align-items:center"><a class="link" href="#/ayarlar">Yedek al</a><button type="button" class="x" data-act="hide-notice" aria-label="Uyarıyı kapat">${ic("close")}</button></span></div>` : "";
  const sec = (id, title, sub, list, extra = "", listKey) => `<section class="sec" id="${id}">
      <div class="sec-h"><div><h2>${title}</h2><p>${sub}</p></div>${extra}</div>
      ${list.length ? grid(list.slice(0, 10)) : `<div class="empty"><b>Burada henüz ürün yok</b><a class="btn" href="#/ekle?d=${LIST_TO_STATUS[listKey]}">${ic("plus")} Ürün ekle</a></div>`}
      ${list.length > 10 ? `<div class="more"><a class="btn" href="#/liste/${listKey}">Tümünü gör (${list.length})</a></div>` : ""}
    </section>`;
  app().innerHTML = `<div class="wrap">
    ${notice}
    <section class="hero">
      <div>
        <div class="eyebrow">Mel Shop · Koleksiyon</div>
        <h1>Eşyaların <em>%${cov} tamam.</em></h1>
        <p>${c.owned} ürün elinde, ${c.missing} ürün sepette, ${c.wish} ürün favorilerinde.${c.missing ? " Sepettekilerin en uygun fiyatları toplandı." : ""}</p>
        <div class="prog" aria-hidden="true"><i style="width:${cov}%"></i></div>
        <div class="btns"><a class="btn fill" href="#/liste/sepet">${ic("bag")} Sepeti gör</a><a class="btn ghost" href="#/ekle">${ic("plus")} Ürün ekle</a></div>
        <div class="stats">
          <div class="stat"><b>${c.owned}</b><span>Elimde</span></div>
          <div class="stat"><b>${c.missing}</b><span>Sepette</span></div>
          <div class="stat"><b>${c.wish}</b><span>Favori</span></div>
          <div class="stat acc"><b>≈ ${tl(basket)}</b><span>Sepet tutarı</span></div>
        </div>
      </div>
      ${top ? `<a class="feature" href="#/u/${esc(top.id)}"><figure class="feature" style="margin:0">${visual(top)}<figcaption><span>En yüksek piyasa puanı</span><span><b>${esc(top.brand)}</b> · ${esc(top.name)} · ${top.marketScore}/10</span></figcaption></figure></a>` : ""}
    </section>
    ${sec("sepet", "Sepetindekiler", `${c.missing} ürün · öncelik sırasıyla, en uygun fiyatlarla`, missing, c.missing ? `<div class="sum"><span>Tahmini toplam</span><b>≈ ${tl(basket)}</b></div>` : "", "sepet")}
    ${sec("elimde", "Elimdekiler", `${c.owned} ürün${avg != null ? ` · ortalama piyasa puanı ${avg.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}/10` : ""}`, owned, "", "elimde")}
    ${sec("favoriler", "Favorilerin", `${c.wish} ürün · istek listesi`, wish, "", "favoriler")}
    <section class="sec">
      <div class="sec-h"><div><h2>Kategoriler</h2><p>${S.cats.length} kategori</p></div><a class="link" href="#/ayarlar">Kategorileri düzenle</a></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0 32px">
        ${S.cats.map(cat => { const l = S.items.filter(x => x.cat === cat.id); const cc = counts(l); return `<a href="#/k/${esc(cat.id)}" style="display:flex;align-items:center;gap:12px;padding-block:16px;border-bottom:1px solid var(--line);text-decoration:none">${ic(cat.icon)}<b style="flex:1;font-size:1.25rem;font-weight:700">${esc(cat.name)}</b><span class="muted" style="font-size:.85rem">${l.length ? `${cc.owned} elimde · ${cc.missing} sepette` : "Henüz boş"}</span></a>`; }).join("")}
      </div>
    </section>
  </div>`;
}

/* ================= filtre çubuğu ================= */
function filterBar(list, q, { showCats = false, showStatus = true, catId = null } = {}) {
  const d = q.get("d") || "all", s = q.get("s") || "puan", g = q.get("g") || "", k = q.get("k") || "";
  const c = counts(list);
  let chips = "";
  if (showStatus) chips += `<div class="chips" role="group" aria-label="Durum">${[["all", "Tümü", list.length], ["owned", "Elimde", c.owned], ["missing", "Sepette", c.missing], ["wish", "Favori", c.wish]]
    .map(([v, l, n]) => `<button type="button" class="chip" data-q="d" data-v="${v}" aria-pressed="${d === v}">${l}<small>${n}</small></button>`).join("")}</div>`;
  const gd = catId && groupDef(catId);
  if (gd) {
    const present = gd.options.filter(o => list.some(x => x.fields?.[gd.key] === o));
    if (present.length) chips += `<div class="chips" role="group" aria-label="${esc(gd.label)}"><button type="button" class="chip" data-q="g" data-v="" aria-pressed="${!g}">Tüm ${esc(lower(gd.label))}</button>${present.map(o => `<button type="button" class="chip" data-q="g" data-v="${esc(o)}" aria-pressed="${g === o}">${esc(o)}<small>${list.filter(x => x.fields?.[gd.key] === o).length}</small></button>`).join("")}</div>`;
  }
  if (showCats) {
    const present = S.cats.filter(cat => list.some(x => x.cat === cat.id));
    if (present.length > 1) chips += `<div class="chips" role="group" aria-label="Kategori"><button type="button" class="chip" data-q="k" data-v="" aria-pressed="${!k}">Tüm kategoriler</button>${present.map(cat => `<button type="button" class="chip" data-q="k" data-v="${esc(cat.id)}" aria-pressed="${k === cat.id}">${esc(cat.name)}<small>${list.filter(x => x.cat === cat.id).length}</small></button>`).join("")}</div>`;
  }
  const sorts = [["puan", "Puana göre"], ["oncelik", "Önceliğe göre"], ["fiyat", "Fiyata göre"], ["ad", "Ada göre"], ["yeni", "Yeni eklenen"]];
  return `<div class="bar"><div style="display:flex;flex-direction:column;gap:8px">${chips}</div>
    <label class="sort">Sırala <select id="sortsel">${sorts.map(([v, l]) => `<option value="${v}"${s === v ? " selected" : ""}>${l}</option>`).join("")}</select></label></div>`;
}
function applyFilters(list, q, catId) {
  const d = q.get("d") || "all", g = q.get("g") || "", k = q.get("k") || "";
  let out = list;
  if (d !== "all") out = out.filter(x => x.status === d);
  const gd = catId && groupDef(catId);
  if (gd && g) out = out.filter(x => x.fields?.[gd.key] === g);
  if (k) out = out.filter(x => x.cat === k);
  return sortItems(out, q.get("s") || "puan");
}

/* ================= kategori ================= */
async function viewCategory(id, q) {
  const cat = catOf(id);
  const all = S.items.filter(x => x.cat === id);
  const list = applyFilters(all, q, id);
  await loadPhotos(list.map(x => (x.photos || [])[0]));
  const c = counts(all), cov = covOf(all), basket = basketOf(all);
  app().innerHTML = `<div class="wrap">
    <div class="page-h"><div>
      <nav class="crumbs" aria-label="Konum"><a href="#/">Ana sayfa</a> › <span>${esc(cat.name)}</span></nav>
      <h1>${esc(cat.name)}</h1>
      <p>${all.length ? `${c.owned} elimde · ${c.missing} sepette · ${c.wish} favori${c.missing ? ` · sepet ≈ ${tl(basket)}` : ""}` : "Bu kategoride henüz ürün yok."}</p>
    </div>
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      ${all.length ? `<div class="cov"><span>%${cov} tamam</span><div class="prog"><i style="width:${cov}%"></i></div></div>` : ""}
      <a class="btn fill" href="#/ekle?k=${esc(id)}">${ic("plus")} Ürün ekle</a></div></div>
    ${all.length ? filterBar(all, q, { catId: id }) + (list.length ? grid(list) : `<div class="empty"><b>Bu filtrede ürün yok</b>Başka bir filtre seç.</div>`)
      : `<div class="empty" style="margin-top:20px"><b>${esc(cat.name)} kategorisi boş</b>İlk ürününü ekleyerek başla.<br><a class="btn fill" href="#/ekle?k=${esc(id)}">${ic("plus")} Ürün ekle</a></div>`}
  </div>`;
}

/* ================= listeler ve arama ================= */
async function viewList(key, q) {
  const st = LIST_TO_STATUS[key]; if (!st) return viewNotFound();
  const all = S.items.filter(x => x.status === st);
  const list = applyFilters(all, q, null);
  await loadPhotos(list.map(x => (x.photos || [])[0]));
  const basket = st === "missing" ? basketOf(list) : 0;
  app().innerHTML = `<div class="wrap">
    <div class="page-h"><div><nav class="crumbs"><a href="#/">Ana sayfa</a> › <span>${LIST_TITLE[key]}</span></nav>
      <h1>${LIST_TITLE[key]}</h1><p>${all.length} ürün${st === "missing" && all.length ? ` · tahmini toplam ≈ ${tl(basket)}` : ""}</p></div>
      <a class="btn fill" href="#/ekle?d=${st}">${ic("plus")} Ürün ekle</a></div>
    ${all.length ? filterBar(all, q, { showCats: true, showStatus: false }) + grid(list) : `<div class="empty" style="margin-top:20px"><b>Liste boş</b><a class="btn fill" href="#/ekle?d=${st}">${ic("plus")} Ürün ekle</a></div>`}
  </div>`;
}
async function viewSearch(term, q) {
  const t = lower(term).trim();
  $("#q").value = term;
  const hit = x => [x.name, x.brand, x.note, catOf(x.cat).name, ...Object.values(x.fields || {}).filter(v => typeof v === "string"), ...(x.offers || []).map(o => o.label)].some(v => lower(v).includes(t));
  const all = t ? S.items.filter(hit) : [];
  const list = applyFilters(all, q, null);
  await loadPhotos(list.map(x => (x.photos || [])[0]));
  app().innerHTML = `<div class="wrap">
    <div class="page-h"><div><nav class="crumbs"><a href="#/">Ana sayfa</a> › <span>Arama</span></nav>
      <h1>“${esc(term)}”</h1><p>${all.length} sonuç</p></div></div>
    ${all.length ? filterBar(all, q, { showCats: true }) + grid(list) : `<div class="empty" style="margin-top:20px"><b>Sonuç bulunamadı</b>Ürün adı, marka ya da not içinde aradım.<br><a class="btn fill" href="#/ekle?n=${encodeURIComponent(term)}">${ic("plus")} “${esc(term)}” ekle</a></div>`}
  </div>`;
}

/* ================= ürün sayfası ================= */
async function viewProduct(id) {
  const x = byId(id); if (!x) return viewNotFound("Ürün bulunamadı");
  await loadPhotos(x.photos || []);
  const cat = catOf(x.cat), st = STATUS[x.status], lo = lowest(x), defs = defsOf(x.cat);
  const photos = (x.photos || []).filter(p => photoURL.has(p));
  const sub = x.fields?.sub;
  const consumable = x.fields?.rebuy || ["bakim", "kahve"].includes(x.cat);
  const statusActs = x.status === "owned"
    ? (consumable ? `<button type="button" class="btn" data-act="rebuy" data-id="${esc(x.id)}">${ic("refresh")} Bitti, yeniden al</button>` : "")
    : x.status === "missing"
      ? `<button type="button" class="btn fill" data-act="bought" data-id="${esc(x.id)}">${ic("check")} Aldım</button><button type="button" class="btn" data-act="towish" data-id="${esc(x.id)}">${ic("heart")} Favorilere taşı</button>`
      : `<button type="button" class="btn fill" data-act="bought" data-id="${esc(x.id)}">${ic("check")} Aldım</button><button type="button" class="btn" data-act="tocart" data-id="${esc(x.id)}">${ic("bag")} Sepete taşı</button>`;
  const fieldRows = defs.map(d => {
    const v = x.fields?.[d.key];
    if (d.type === "check") return `<dt>${esc(d.label)}</dt><dd>${v ? "Evet" : "Hayır"}</dd>`;
    if (!v) return "";
    return `<dt>${esc(d.label)}</dt><dd>${esc(d.type === "date" ? fmtDate(v) : v)}</dd>`;
  }).join("");
  const hasMine = typeof x.rating === "number";
  const hasMarket = typeof x.marketScore === "number";
  app().innerHTML = `<div class="wrap">
    <nav class="crumbs" style="padding-top:22px" aria-label="Konum"><a href="#/">Ana sayfa</a> › <a href="#/k/${esc(cat.id)}">${esc(cat.name)}</a>${sub ? ` › <a href="#/k/${esc(cat.id)}?g=${encodeURIComponent(sub)}">${esc(sub)}</a>` : ""}</nav>
    <div class="pd">
      <div class="gal">
        <div class="main" id="galmain">${visual(x)}</div>
        ${photos.length > 1 ? `<div class="thumbs">${photos.map((p, i) => `<button type="button" data-thumb="${i}" aria-pressed="${i === 0}" aria-label="${i + 1}. fotoğraf"><img src="${photoURL.get(p)}" alt=""></button>`).join("")}</div>` : ""}
        ${photos.length ? "" : `<a class="link" href="#/duzenle/${esc(x.id)}">${ic("camera")} Fotoğraf ekle</a>`}
      </div>
      <div class="info">
        <div>
          <div class="brandline"><span class="brandname">${esc(x.brand || cat.name)}</span><span class="pill ${x.status}">${ic(st.icon)}${st.label}</span>${x.status !== "owned" && x.priority === "yuksek" ? `<span class="pill pri">Öncelikli</span>` : ""}</div>
          <h1>${esc(x.name)}</h1>
        </div>
        <div class="actions" id="pdacts">${statusActs}<a class="btn ghost" href="#/duzenle/${esc(x.id)}">${ic("edit")} Düzenle</a><button type="button" class="btn ghost" data-act="del-ask" data-id="${esc(x.id)}">${ic("trash")} Sil</button></div>
        <div id="delconfirm"></div>
        ${x.status === "owned"
          ? (x.paid != null || x.boughtAt ? `<div class="box"><h3>Satın alma</h3>${x.paid != null ? `<div class="bigprice">${tl(x.paid)}</div>` : ""}${x.boughtAt ? `<span class="muted">${fmtDate(x.boughtAt)} tarihinde alındı</span>` : ""}</div>` : "")
          : `<div class="box"><h3>En uygun fiyat</h3>${lo ? `<div class="bigprice">${tl(lo.v)}</div><span class="muted">${esc(lo.label)}${lo.hint ? " · " + esc(lo.hint) : ""}${x.offersCheckedAt ? ` · ${fmtDate(x.offersCheckedAt)}` : ""}</span>` : `<span class="muted">Henüz fiyat eklenmedi.</span>`}</div>`}
        <div class="box"><h3>Puanlar</h3>
          ${hasMarket ? `<div class="scorerow"><span style="min-width:110px;font-weight:700">Piyasa puanı</span>${meter(x.marketScore)}<b>${x.marketScore}/10</b></div>${x.marketWhy ? `<p class="why">${esc(x.marketWhy)}</p>` : ""}` : `<span class="muted">Piyasa puanı yok.${x.marketWhy ? " " + esc(x.marketWhy) : ""}</span>`}
          ${hasMine ? `<div class="scorerow" style="margin-top:6px"><span style="min-width:110px;font-weight:700">Senin puanın</span>${meter(x.rating, 10, "mine")}<b>${x.rating}/10</b></div>` : ""}
          ${SUBSCORES.some(([k]) => typeof x.scores?.[k] === "number") || x.again ? `<div class="subs">${SUBSCORES.filter(([k]) => typeof x.scores?.[k] === "number").map(([k, l]) => `<span>${l}</span>${dots(x.scores[k])}`).join("")}${x.again ? `<span>Tekrar alır mıyım?</span><b>${AGAIN[x.again]}</b>` : ""}</div>` : ""}
          ${!hasMine && x.status === "owned" ? `<div><a class="btn sm" href="#/duzenle/${esc(x.id)}?b=puan">Puanla</a></div>` : ""}
        </div>
        ${x.note ? `<div class="box"><h3>Not</h3><p style="margin:0;white-space:pre-wrap">${esc(x.note)}</p></div>` : ""}
        <div class="box"><h3>Fiyatlar ve linkler</h3>
          ${(x.offers || []).length ? `<ul class="offers">${x.offers.map(o => `<li><span style="min-width:0"><a href="${esc(safeUrl(o.url))}" target="_blank" rel="noopener">${esc(o.label || o.url)} ${ic("out")}</a>${o.hint ? `<small>${esc(o.hint)}</small>` : ""}</span><span class="p">${num(o.price) != null ? tl(num(o.price)) : esc(o.price || "")}</span></li>`).join("")}</ul>` : `<span class="muted">Kayıtlı link yok.</span>`}
          <div class="row"><a class="link" href="${esc(cimriUrl(x))}" target="_blank" rel="noopener">Cimri'de ara ${ic("out")}</a><a class="link" href="#/duzenle/${esc(x.id)}?b=fiyat">Linkleri düzenle</a></div>
        </div>
        <div class="box"><h3>Bilgiler</h3><dl class="dl"><dt>Kategori</dt><dd><a href="#/k/${esc(cat.id)}">${esc(cat.name)}</a></dd>${fieldRows}${x.status !== "owned" ? `<dt>Öncelik</dt><dd>${PRIORITY[x.priority] || "Sonra"}</dd>` : ""}<dt>Eklendi</dt><dd>${fmtDate(x.createdAt)}</dd></dl></div>
      </div>
    </div></div>`;
}

/* ================= ekle / düzenle ================= */
let draft = null, pending = new Map(), removed = new Set();
async function viewForm(id, q) {
  const fresh = !draft || draft.__for !== (id || "new:" + location.hash);
  if (fresh) {
    pending = new Map(); removed = new Set();
    if (id) { const x = byId(id); if (!x) return viewNotFound("Ürün bulunamadı"); draft = clone(x); }
    else {
      const k = q.get("k"); const d = q.get("d");
      draft = { id: uid(), name: q.get("n") || "", brand: "", cat: S.cats.some(c => c.id === k) ? k : (S.cats[0]?.id || "bakim"), status: STATUS[d] ? d : "owned", priority: "orta",
        paid: null, boughtAt: "", note: "", marketScore: null, marketWhy: "", rating: null, scores: {}, again: null, offers: [], offersCheckedAt: "", fields: {}, photos: [], createdAt: "", updatedAt: "" };
    }
    draft.__for = id || "new:" + location.hash;
  }
  await loadPhotos(draft.photos.filter(p => !pending.has(p)));
  renderForm(id);
  const b = q.get("b");
  if (fresh && b) setTimeout(() => document.getElementById("fs-" + b)?.scrollIntoView({ block: "start" }), 30);
}
function renderForm(id) {
  const x = draft, defs = defsOf(x.cat);
  const seg = (key, max, val, start = 1) => { let h = ""; for (let i = start; i <= max; i++) h += `<button type="button" data-seg="${key}" data-v="${i}" aria-pressed="${val === i}">${i}</button>`; return `<div class="seg">${h}</div>`; };
  const pslots = Array.from({ length: 4 }, (_, i) => {
    const p = x.photos[i];
    if (p) { const u = pending.get(p)?.url || photoURL.get(p); return `<div class="pslot"><img src="${u}" alt="${i + 1}. fotoğraf"><button type="button" class="rm" data-act="ph-rm" data-i="${i}" aria-label="Fotoğrafı kaldır">${ic("close")}</button>${i === 0 ? `<span class="cv">Kapak</span>` : `<button type="button" class="mk" data-act="ph-cover" data-i="${i}">Kapak yap</button>`}</div>`; }
    if (i === x.photos.length) return `<div class="pslot"><label>${ic("camera")}Fotoğraf ekle<input type="file" accept="image/*" multiple id="phin"></label></div>`;
    return `<div class="pslot" aria-hidden="true"></div>`;
  }).join("");
  const fieldHtml = defs.map(d => {
    const v = x.fields?.[d.key];
    if (d.type === "check") return `<label class="check"><input type="checkbox" data-f="${d.key}"${v ? " checked" : ""}>${esc(d.label)}</label>`;
    if (d.type === "select") return `<label class="fld"><span>${esc(d.label)}</span><select data-f="${d.key}"><option value="">Seç</option>${d.options.map(o => `<option${v === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
    return `<label class="fld"><span>${esc(d.label)}</span><input type="${d.type === "date" ? "date" : "text"}" data-f="${d.key}" value="${esc(v || "")}" placeholder="${esc(d.placeholder || "")}"></label>`;
  }).join("");
  const offerRows = (x.offers || []).map((o, i) => `<div class="offer-row">
      <label class="fld"><span>Ürün / satıcı</span><input type="text" data-o="${i}" data-ok="label" value="${esc(o.label)}" placeholder="ör. CeraVe 236 ml · Watsons"></label>
      <label class="fld"><span>Fiyat (TL)</span><input type="text" inputmode="decimal" data-o="${i}" data-ok="price" value="${esc(o.price)}" placeholder="ör. 599"></label>
      <label class="fld"><span>Link</span><input type="url" data-o="${i}" data-ok="url" value="${esc(o.url)}" placeholder="https://"></label>
      <button type="button" class="iconbtn" data-act="of-rm" data-i="${i}" aria-label="Linki kaldır">${ic("trash")}</button></div>`).join("");
  app().innerHTML = `<div class="wrap">
    <div class="page-h"><div><nav class="crumbs"><a href="#/">Ana sayfa</a> › <span>${id ? "Düzenle" : "Yeni ürün"}</span></nav><h1>${id ? esc(x.name || "Ürünü düzenle") : "Yeni ürün"}</h1></div></div>
    <form id="itemform" class="form" novalidate>
      <fieldset class="fs wide" style="border:1px solid var(--line)"><h3>Fotoğraflar</h3><div class="photos">${pslots}</div><span class="muted" style="font-size:.88rem">En fazla 4 fotoğraf. İlk fotoğraf kapak olur; yüklerken otomatik küçültülür.</span></fieldset>
      <fieldset class="fs" style="border:1px solid var(--line)"><h3>Ürün</h3>
        <label class="fld"><span>Ürün adı <em>*</em></span><input type="text" data-k="name" value="${esc(x.name)}" required placeholder="ör. CeraVe Köpüren Temizleyici 236 ml"></label>
        <div class="two"><label class="fld"><span>Marka</span><input type="text" data-k="brand" value="${esc(x.brand)}" placeholder="ör. CeraVe"></label>
        <label class="fld"><span>Kategori</span><select data-k="cat" id="catsel">${S.cats.map(c => `<option value="${esc(c.id)}"${c.id === x.cat ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label></div>
        ${fieldHtml ? `<div class="two">${fieldHtml}</div>` : ""}
        <div class="fld"><span>Durum</span><div class="seg words">${Object.entries(STATUS).map(([k, s]) => `<button type="button" data-seg="status" data-v="${k}" aria-pressed="${x.status === k}">${s.label}</button>`).join("")}</div></div>
        ${x.status !== "owned" ? `<div class="fld"><span>Öncelik</span><div class="seg words">${Object.entries(PRIORITY).map(([k, l]) => `<button type="button" data-seg="priority" data-v="${k}" aria-pressed="${x.priority === k}">${l}</button>`).join("")}</div></div>` : ""}
        <label class="fld"><span>Not</span><textarea data-k="note" placeholder="Nasıl kullanıyorsun, nereden aldın…">${esc(x.note)}</textarea></label>
      </fieldset>
      <fieldset class="fs" id="fs-fiyat" style="border:1px solid var(--line)"><h3>Fiyat</h3>
        ${x.status === "owned" ? `<div class="two"><label class="fld"><span>Ödediğin fiyat (TL)</span><input type="text" inputmode="decimal" data-k="paid" value="${x.paid ?? ""}" placeholder="ör. 450"></label><label class="fld"><span>Alış tarihi</span><input type="date" data-k="boughtAt" value="${esc(x.boughtAt)}"></label></div>` : ""}
        <div class="fld"><span>Fiyat linkleri</span><span class="muted" style="font-size:.88rem;font-weight:400">Mağaza ya da karşılaştırma sitesi linkleri. En düşük fiyat kartlarda gösterilir.</span></div>
        ${offerRows}
        <div class="row"><button type="button" class="btn sm" data-act="of-add">${ic("plus")} Link ekle</button><a class="link" id="cimrilink" href="${esc(cimriUrl(x))}" target="_blank" rel="noopener">Cimri'de ara ${ic("out")}</a></div>
      </fieldset>
      <fieldset class="fs wide" id="fs-puan" style="border:1px solid var(--line)"><h3>Puanlar</h3>
        <div class="two" style="align-items:start">
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="fld"><span>Piyasa puanı</span><span class="muted" style="font-size:.88rem;font-weight:400">Piyasadaki en iyisi 10. Bana sorarsan puanlayıp gerekçesini yazarım.</span>${seg("marketScore", 10, x.marketScore)}</div>
            <label class="fld"><span>Piyasaya göre gerekçe</span><textarea data-k="marketWhy">${esc(x.marketWhy)}</textarea></label>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="fld"><span>Senin puanın</span><span class="muted" style="font-size:.88rem;font-weight:400">Kullandıkça kendi deneyimine göre.</span>${seg("rating", 10, x.rating)}</div>
            ${SUBSCORES.map(([k, l]) => `<div class="subline"><span>${l}</span>${seg("sc:" + k, 5, x.scores?.[k])}</div>`).join("")}
            <div class="subline"><span>Tekrar alır mıyım?</span><div class="seg words">${Object.entries(AGAIN).map(([k, l]) => `<button type="button" data-seg="again" data-v="${k}" aria-pressed="${x.again === k}">${l}</button>`).join("")}</div></div>
          </div>
        </div>
      </fieldset>
    </form>
    <div class="formbar"><span class="err" id="formerr" role="alert"></span><a class="btn ghost" href="${id ? `#/u/${esc(id)}` : "#/"}" data-act="form-cancel">Vazgeç</a><button type="button" class="btn fill" data-act="form-save">${ic("check")} Kaydet</button></div>
  </div>`;
}
function syncDraftInput(el) {
  if (!draft) return;
  if (el.dataset.k) {
    const k = el.dataset.k;
    draft[k] = k === "paid" ? num(el.value) : el.value;
    if (k === "name") { const a = $("#cimrilink"); if (a) a.href = cimriUrl(draft); }
    if (k === "cat") { draft.fields = {}; renderForm(draft.__for.startsWith("new:") ? null : draft.id); }
  } else if (el.dataset.f) {
    draft.fields = draft.fields || {};
    draft.fields[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value;
  } else if (el.dataset.o != null) {
    draft.offers[+el.dataset.o][el.dataset.ok] = el.value;
  }
}
async function addPhotos(files) {
  for (const f of files) {
    if (draft.photos.length >= 4) { toast("En fazla 4 fotoğraf ekleyebilirsin"); break; }
    if (!f.type.startsWith("image/")) continue;
    const blob = await shrinkImage(f).catch(() => null);
    if (!blob) { toast("Bu fotoğraf okunamadı"); continue; }
    const pid = "p" + uid();
    pending.set(pid, { blob, url: URL.createObjectURL(blob) });
    draft.photos.push(pid);
  }
  renderForm(draft.__for.startsWith("new:") ? null : draft.id);
}
async function saveForm() {
  const isNew = draft.__for.startsWith("new:");
  draft.name = (draft.name || "").trim();
  if (!draft.name) { $("#formerr").textContent = "Ürün adı gerekli."; document.querySelector('[data-k="name"]')?.focus(); return; }
  draft.offers = (draft.offers || []).filter(o => (o.label || o.url || o.price)).map(o => ({ label: (o.label || "").trim(), price: (o.price || "").trim(), url: (o.url || "").trim(), hint: o.hint || "" }));
  const bad = draft.offers.find(o => o.url && !/^https:\/\//i.test(o.url));
  if (bad) { $("#formerr").textContent = "Linkler https:// ile başlamalı."; return; }
  if (draft.status === "owned") draft.priority = draft.priority || "orta";
  for (const [pid, p] of pending) if (draft.photos.includes(pid)) { await store.putPhoto({ id: pid, itemId: draft.id, blob: p.blob }); photoURL.set(pid, p.url); }
  for (const pid of removed) { await store.deletePhoto(pid); const u = photoURL.get(pid); if (u) URL.revokeObjectURL(u); photoURL.delete(pid); }
  const item = clone({ ...draft, photos: draft.photos });
  delete item.__for;
  if (isNew) item.createdAt = new Date().toISOString();
  await saveItem(item, { silent: true });
  draft = null; pending = new Map(); removed = new Set();
  go(`#/u/${item.id}`);
  toast(isNew ? "Ürün eklendi" : "Değişiklikler kaydedildi");
}

/* ================= ayarlar ================= */
async function viewSettings() {
  let est = "";
  try { const e = await navigator.storage?.estimate?.(); if (e?.usage != null) est = (e.usage / 1048576).toLocaleString("tr-TR", { maximumFractionDigits: 1 }) + " MB"; } catch (e) {}
  const nPhotos = S.items.reduce((s, x) => s + (x.photos || []).length, 0);
  app().innerHTML = `<div class="wrap">
    <div class="page-h"><div><nav class="crumbs"><a href="#/">Ana sayfa</a> › <span>Ayarlar</span></nav><h1>Ayarlar</h1></div></div>
    <div class="settings">
      <section class="box"><h3>Yedek</h3>
        <p>Tüm ürünler, puanlar ve fotoğraflar sadece bu tarayıcıda saklanıyor. Tarayıcı verilerini temizlersen silinirler; ara sıra yedek al.</p>
        <div class="kv"><span class="muted">Son yedek</span><b>${S.lastBackup ? fmtDate(S.lastBackup) : "Hiç alınmadı"}</b></div>
        <div class="kv"><span class="muted">İçerik</span><b>${S.items.length} ürün · ${nPhotos} fotoğraf</b></div>
        <div class="actions"><button type="button" class="btn fill" data-act="backup">${ic("download")} Yedek al</button>
          <label class="btn ghost" style="cursor:pointer">${ic("upload")} Yedekten yükle<input type="file" accept="application/json,.json" id="restorein" class="sr"></label></div>
        <div id="restoreconfirm"></div>
      </section>
      <section class="box" id="kategoriler"><h3>Kategoriler</h3>
        <ul class="catlist">${S.cats.map(c => { const n = S.items.filter(x => x.cat === c.id).length; return `<li>${ic(c.icon)}<input type="text" value="${esc(c.name)}" data-catname="${esc(c.id)}" aria-label="${esc(c.name)} adı"><span class="muted" style="font-size:.88rem;min-width:56px;text-align:right">${n} ürün</span><button type="button" class="iconbtn" data-act="cat-del" data-id="${esc(c.id)}" aria-label="${esc(c.name)} kategorisini sil"${n ? ` title="İçinde ürün olan kategori silinemez"` : ""}>${ic("trash")}</button></li>`; }).join("")}</ul>
        <div class="fld"><span>Yeni kategori</span><input type="text" id="newcat" placeholder="ör. Kitaplar" style="border:1px solid var(--line-strong);border-radius:8px;padding:9px 11px"></div>
        <div class="iconpick" role="group" aria-label="Simge">${PICKABLE_ICONS.map((k, i) => `<button type="button" data-icon="${k}" aria-pressed="${i === PICKABLE_ICONS.length - 1}" aria-label="${k}">${ic(k)}</button>`).join("")}</div>
        <div><button type="button" class="btn" data-act="cat-add">${ic("plus")} Kategori ekle</button></div>
        <span class="muted" style="font-size:.88rem">Kategori adlarını değiştirmek için kutuya yazman yeterli. İçinde ürün olan kategori silinemez; önce ürünleri başka kategoriye taşı.</span>
      </section>
      <section class="box"><h3>Uygulama</h3>
        <p>Mel Shop'u bilgisayarına uygulama olarak kurabilirsin; internetsiz de açılır.</p>
        ${installEvt ? `<div><button type="button" class="btn fill" data-act="install">${ic("download")} Uygulama olarak yükle</button></div>` : `<p style="font-size:.92rem">Yükle butonu görünmüyorsa: Chrome ya da Edge'de adres çubuğunun sağındaki yükle simgesine tıkla. Zaten yüklediysen bu buton çıkmaz.</p>`}
        ${est ? `<div class="kv"><span class="muted">Kullanılan alan</span><b>${est}</b></div>` : ""}
      </section>
    </div></div>`;
}
async function doBackup() {
  const photos = [];
  for (const p of await store.allPhotos()) photos.push({ id: p.id, itemId: p.itemId, data: await blobToDataURL(p.blob) });
  const out = { app: "melshop", version: 1, exportedAt: new Date().toISOString(), cats: S.cats, items: S.items, photos };
  const blob = new Blob([JSON.stringify(out)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `melshop-yedek-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  S.lastBackup = new Date().toISOString();
  await store.setMeta("lastBackup", S.lastBackup);
  toast("Yedek dosyası indirildi");
  rerender();
}
let restoreData = null;
async function readRestore(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "melshop" || !Array.isArray(data.items)) throw new Error();
    restoreData = data;
    $("#restoreconfirm").innerHTML = `<div class="confirm"><span>Mevcut ${S.items.length} ürün silinip yedekteki ${data.items.length} ürün ve ${(data.photos || []).length} fotoğraf yüklenecek.</span><button type="button" class="btn sm danger fill" data-act="restore-yes">Evet, yükle</button><button type="button" class="btn sm" data-act="restore-no">Vazgeç</button></div>`;
  } catch (e) { toast("Bu dosya bir Mel Shop yedeği değil"); }
}
async function doRestore() {
  const d = restoreData; if (!d) return;
  const photos = [];
  for (const p of d.photos || []) photos.push({ id: p.id, itemId: p.itemId, blob: await dataURLToBlob(p.data) });
  for (const u of photoURL.values()) URL.revokeObjectURL(u);
  photoURL.clear();
  await store.replaceAll({ items: d.items, photos, meta: { cats: d.cats || DEFAULT_CATS, seeded: true, lastBackup: d.exportedAt || null } });
  restoreData = null;
  await loadState();
  toast("Yedek yüklendi");
  go("#/");
}

/* ================= yönlendirme ================= */
function viewNotFound(msg = "Sayfa bulunamadı") {
  app().innerHTML = `<div class="wrap"><div class="empty" style="margin-top:40px"><b>${esc(msg)}</b><a class="btn" href="#/">Ana sayfaya dön</a></div></div>`;
}
async function route() {
  const { parts, q, path } = parseHash();
  const [a, b] = parts;
  let activeCat = a === "k" ? b : a === "u" ? byId(b)?.cat : null;
  renderChrome(activeCat);
  if (a !== "ekle" && a !== "duzenle") draft = null;
  if (a !== "ara") $("#q").value = "";
  if (!a) await viewHome();
  else if (a === "k") await viewCategory(b, q);
  else if (a === "liste") await viewList(b, q);
  else if (a === "ara") await viewSearch(b || "", q);
  else if (a === "u") await viewProduct(b);
  else if (a === "ekle") await viewForm(null, q);
  else if (a === "duzenle") await viewForm(b, q);
  else if (a === "ayarlar") await viewSettings();
  else viewNotFound();
  if (path !== lastPath) { window.scrollTo(0, 0); lastPath = path; }
  const t = { "": "Mel Shop", k: catOf(b).name, liste: LIST_TITLE[b], ara: "Arama", u: byId(b)?.name, ekle: "Yeni ürün", duzenle: "Düzenle", ayarlar: "Ayarlar" }[a || ""];
  document.title = t && a ? `${t} · Mel Shop` : "Mel Shop";
}
function rerender() { route(); }

/* ================= olaylar ================= */
document.addEventListener("click", async e => {
  const el = e.target.closest("[data-act],[data-q],[data-seg],[data-thumb],[data-icon]");
  if (!el) return;
  if (el.dataset.q) { setQuery({ [el.dataset.q]: el.dataset.v === "all" ? "" : el.dataset.v }); return; }
  if (el.dataset.thumb != null) {
    const x = byId(parseHash().parts[1]); const i = +el.dataset.thumb;
    $("#galmain").innerHTML = visual(x, { index: i });
    document.querySelectorAll("[data-thumb]").forEach(b => b.setAttribute("aria-pressed", String(b === el)));
    return;
  }
  if (el.dataset.icon) { document.querySelectorAll("[data-icon]").forEach(b => b.setAttribute("aria-pressed", String(b === el))); return; }
  if (el.dataset.seg) {
    const key = el.dataset.seg, raw = el.dataset.v;
    const v = /^\d+$/.test(raw) ? +raw : raw;
    if (key.startsWith("sc:")) { const k = key.slice(3); draft.scores = draft.scores || {}; draft.scores[k] = draft.scores[k] === v ? null : v; }
    else if (key === "status" || key === "priority") { draft[key] = v; renderForm(draft.__for.startsWith("new:") ? null : draft.id); return; }
    else draft[key] = draft[key] === v ? null : v;
    el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === el && (key.startsWith("sc:") ? draft.scores[key.slice(3)] : draft[key]) != null)));
    return;
  }
  const act = el.dataset.act, id = el.dataset.id;
  if (act === "bought") moveStatus(id, "owned");
  else if (act === "tocart") moveStatus(id, "missing");
  else if (act === "towish") moveStatus(id, "wish");
  else if (act === "rebuy") moveStatus(id, "missing");
  else if (act === "del-ask") $("#delconfirm").innerHTML = `<div class="confirm"><span>Bu ürün ve fotoğrafları silinecek.</span><button type="button" class="btn sm danger fill" data-act="del-yes" data-id="${esc(id)}">Evet, sil</button><button type="button" class="btn sm" data-act="del-no">Vazgeç</button></div>`;
  else if (act === "del-yes") deleteItem(id);
  else if (act === "del-no") $("#delconfirm").innerHTML = "";
  else if (act === "hide-notice") { S.noticeHiddenAt = new Date().toISOString(); await store.setMeta("noticeHiddenAt", S.noticeHiddenAt); rerender(); }
  else if (act === "ph-rm") {
    const i = +el.dataset.i, pid = draft.photos[i];
    draft.photos.splice(i, 1);
    if (pending.has(pid)) { URL.revokeObjectURL(pending.get(pid).url); pending.delete(pid); } else removed.add(pid);
    renderForm(draft.__for.startsWith("new:") ? null : draft.id);
  }
  else if (act === "ph-cover") { const i = +el.dataset.i; const [p] = draft.photos.splice(i, 1); draft.photos.unshift(p); renderForm(draft.__for.startsWith("new:") ? null : draft.id); }
  else if (act === "of-add") { draft.offers = draft.offers || []; draft.offers.push({ label: "", price: "", url: "", hint: "" }); renderForm(draft.__for.startsWith("new:") ? null : draft.id); document.querySelectorAll('[data-ok="label"]')[draft.offers.length - 1]?.focus(); }
  else if (act === "of-rm") { draft.offers.splice(+el.dataset.i, 1); renderForm(draft.__for.startsWith("new:") ? null : draft.id); }
  else if (act === "form-save") saveForm();
  else if (act === "form-cancel") { for (const p of pending.values()) URL.revokeObjectURL(p.url); draft = null; pending = new Map(); removed = new Set(); }
  else if (act === "backup") doBackup();
  else if (act === "restore-yes") doRestore();
  else if (act === "restore-no") { restoreData = null; $("#restoreconfirm").innerHTML = ""; }
  else if (act === "install" && installEvt) { installEvt.prompt(); await installEvt.userChoice.catch(() => null); installEvt = null; rerender(); }
  else if (act === "cat-add") {
    const name = $("#newcat").value.trim();
    if (!name) { $("#newcat").focus(); return; }
    let cid = slug(name); while (S.cats.some(c => c.id === cid)) cid += "-2";
    const icon = document.querySelector('[data-icon][aria-pressed="true"]')?.dataset.icon || "etiket";
    S.cats = [...S.cats, { id: cid, name, icon }];
    await store.setMeta("cats", S.cats);
    toast(`${name} kategorisi eklendi`);
    rerender();
  }
  else if (act === "cat-del") {
    const n = S.items.filter(x => x.cat === id).length;
    if (n) { toast("İçinde ürün olan kategori silinemez"); return; }
    const prev = S.cats;
    S.cats = S.cats.filter(c => c.id !== id);
    await store.setMeta("cats", S.cats);
    rerender();
    toast("Kategori silindi", [{ label: "Geri al", run: async () => { S.cats = prev; await store.setMeta("cats", S.cats); rerender(); } }]);
  }
});
document.addEventListener("input", e => { if (e.target.closest("#itemform")) syncDraftInput(e.target); });
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.id === "phin") { await addPhotos([...t.files]); return; }
  if (t.id === "restorein" && t.files[0]) { readRestore(t.files[0]); t.value = ""; return; }
  if (t.id === "sortsel") { setQuery({ s: t.value }); return; }
  if (t.closest("#itemform") && t.dataset.f) { syncDraftInput(t); return; }
  if (t.dataset.catname) {
    const name = t.value.trim(); if (!name) return;
    S.cats = S.cats.map(c => c.id === t.dataset.catname ? { ...c, name } : c);
    await store.setMeta("cats", S.cats);
    renderChrome(null);
    toast("Kategori adı güncellendi");
  }
});
$("#searchform").addEventListener("submit", e => { e.preventDefault(); const v = $("#q").value.trim(); if (v) go("#/ara/" + encodeURIComponent(v)); });
window.addEventListener("hashchange", route);
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (parseHash().parts[0] === "ayarlar") rerender(); });

/* ================= başlangıç ================= */
async function loadState() {
  let cats = await store.getMeta("cats");
  if (!cats) { cats = clone(DEFAULT_CATS); await store.setMeta("cats", cats); }
  let items = await store.allItems();
  const seeded = await store.getMeta("seeded");
  if (!seeded && !items.length) {
    try {
      const seed = await (await fetch("data/seed.json", { cache: "no-store" })).json();
      for (const it of seed.items) await store.putItem(it);
      items = seed.items;
    } catch (e) { console.warn("Başlangıç verisi yüklenemedi", e); }
    await store.setMeta("seeded", true);
  }
  S.items = items; S.cats = cats;
  S.lastBackup = await store.getMeta("lastBackup");
  S.noticeHiddenAt = await store.getMeta("noticeHiddenAt");
}
(async function boot() {
  try { await loadState(); }
  catch (e) { app().innerHTML = `<div class="wrap"><div class="empty" style="margin-top:40px"><b>Veriler açılamadı</b>Tarayıcın verileri saklamaya izin vermiyor olabilir (gizli pencere gibi). Normal bir pencerede dene.</div></div>`; return; }
  await route();
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();

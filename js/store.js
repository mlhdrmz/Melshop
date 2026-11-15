// Mel Shop — veri katmanı (IndexedDB)
// Depolar: items (ürünler), photos (fotoğraf blob'ları), meta (kategoriler, ayarlar)

const DB_NAME = "melshop";
const DB_VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "id" });
      if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(stores, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let out;
    Promise.resolve(fn(t)).then(v => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("İşlem iptal edildi"));
  }));
}

const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const store = {
  async allItems() { return tx(["items"], "readonly", t => reqP(t.objectStore("items").getAll())); },
  async getItem(id) { return tx(["items"], "readonly", t => reqP(t.objectStore("items").get(id))); },
  async putItem(item) { return tx(["items"], "readwrite", t => { t.objectStore("items").put(item); }); },
  async deleteItem(id) {
    const item = await this.getItem(id);
    return tx(["items", "photos"], "readwrite", t => {
      t.objectStore("items").delete(id);
      for (const pid of (item?.photos || [])) t.objectStore("photos").delete(pid);
    });
  },
  async getPhoto(id) { return tx(["photos"], "readonly", t => reqP(t.objectStore("photos").get(id))); },
  async putPhoto(rec) { return tx(["photos"], "readwrite", t => { t.objectStore("photos").put(rec); }); },
  async deletePhoto(id) { return tx(["photos"], "readwrite", t => { t.objectStore("photos").delete(id); }); },
  async allPhotos() { return tx(["photos"], "readonly", t => reqP(t.objectStore("photos").getAll())); },
  async getMeta(key, fallback = null) {
    const r = await tx(["meta"], "readonly", t => reqP(t.objectStore("meta").get(key)));
    return r ? r.value : fallback;
  },
  async setMeta(key, value) { return tx(["meta"], "readwrite", t => { t.objectStore("meta").put({ key, value }); }); },

  // Yedeği tamamen yükler: mevcut verilerin yerini alır.
  async replaceAll({ items, photos, meta }) {
    return tx(["items", "photos", "meta"], "readwrite", t => {
      const si = t.objectStore("items"), sp = t.objectStore("photos"), sm = t.objectStore("meta");
      si.clear(); sp.clear(); sm.clear();
      for (const it of items) si.put(it);
      for (const p of photos) sp.put(p);
      for (const [key, value] of Object.entries(meta)) sm.put({ key, value });
    });
  }
};

// Fotoğrafı küçültür (en uzun kenar 1600 px).
// Normal fotoğraflar JPEG %85 olarak saklanır. Arka planı şeffaf olanlar (PNG/WebP) JPEG'e
// çevrilince şeffaf alan siyaha boyanıyordu; bunlar WebP (desteklenmezse PNG) olarak saklanır,
// böylece arkada sitenin zemin rengi görünür.
export async function shrinkImage(file, max = 1600) {
  const bmp = await createImageBitmap(file).catch(() => null);
  let w, h, src;
  if (bmp) { w = bmp.width; h = bmp.height; src = bmp; }
  else {
    src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
    w = src.naturalWidth; h = src.naturalHeight;
  }
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const ctx = c.getContext("2d");
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const toBlob = (type, q) => new Promise(res => c.toBlob(b => res(b), type, q));
  if (file.type !== "image/jpeg" && hasTransparency(ctx, c.width, c.height)) {
    const webp = await toBlob("image/webp", 0.9);
    return webp && webp.type === "image/webp" ? webp : toBlob("image/png");
  }
  return toBlob("image/jpeg", 0.85);
}

function hasTransparency(ctx, w, h) {
  try {
    const d = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  } catch (e) { /* okunamadıysa normal fotoğraf say */ }
  return false;
}

export const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
export const dataURLToBlob = async u => (await fetch(u)).blob();

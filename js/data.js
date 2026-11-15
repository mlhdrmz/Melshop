// Mel Shop — sabitler, kategori tanımları ve yardımcılar

export const DEFAULT_CATS = [
  { id: "bakim", name: "Kişisel Bakım", icon: "bakim" },
  { id: "giyim", name: "Giyim & Ayakkabı", icon: "giyim" },
  { id: "elektronik", name: "Elektronik", icon: "elektronik" },
  { id: "kahve", name: "Kahve & Mutfak", icon: "kahve" },
  { id: "saat", name: "Saat & Aksesuar", icon: "saat" },
  { id: "oyun", name: "Oyun & Kontrolcü", icon: "oyun" },
  { id: "ev", name: "Ev", icon: "ev" }
];

export const BAKIM_SUBS = ["Yüz & Dudak", "Tıraş & Sakal", "Vücut", "Koltukaltı", "Hassas Bölge", "El & Ayak", "Saç", "Ağız", "Parfüm", "Diğer"];

// Kategoriye özel alanlar. Yeni eklenen kategorilerde özel alan yok.
export const FIELD_DEFS = {
  bakim: [
    { key: "sub", label: "Alt kategori", type: "select", options: BAKIM_SUBS, group: true },
    { key: "rebuy", label: "Bitince yeniden al", type: "check" }
  ],
  giyim: [
    { key: "beden", label: "Beden", type: "text", placeholder: "ör. 6XL, 46" },
    { key: "renk", label: "Renk", type: "text", placeholder: "ör. lacivert" }
  ],
  elektronik: [
    { key: "model", label: "Model", type: "text", placeholder: "ör. QP2824/10" },
    { key: "garanti", label: "Garanti bitişi", type: "date" }
  ],
  kahve: [
    { key: "skt", label: "Son kullanma tarihi", type: "date" }
  ],
  saat: [
    { key: "ref", label: "Model / referans no", type: "text", placeholder: "ör. 126000" }
  ],
  oyun: [
    { key: "platform", label: "Platform", type: "select", options: ["PC", "PlayStation", "Xbox", "Nintendo Switch", "Mobil", "Diğer"], group: true }
  ],
  ev: [
    { key: "oda", label: "Oda", type: "select", options: ["Salon", "Mutfak", "Yatak odası", "Banyo", "Çalışma odası", "Balkon", "Diğer"], group: true }
  ]
};

export const STATUS = {
  owned: { label: "Elimde", icon: "box", list: "elimde" },
  missing: { label: "Sepette", icon: "bag", list: "sepet" },
  wish: { label: "Favori", icon: "heart", list: "favoriler" },
  none: { label: "Listede değil", icon: "etiket", list: null }
};
// Her liste ayrı bir açık/kapalı işaret: ürün aynı anda hem elinde hem favoride olabilir.
export const LIST_FLAG = { owned: "owned", missing: "cart", wish: "fav" };
export const LIST_TO_STATUS = { elimde: "owned", sepet: "missing", favoriler: "wish" };
export const LIST_TITLE = { elimde: "Elimdekiler", sepet: "Sepetindekiler", favoriler: "Favorilerin" };

export const PRIORITY = { yuksek: "Öncelikli", orta: "Sonra", dusuk: "İsteğe bağlı" };
export const PRIORITY_ORDER = { yuksek: 0, orta: 1, dusuk: 2 };
export const AGAIN = { evet: "Evet", belki: "Belki", hayir: "Hayır" };
export const SUBSCORES = [["etki", "Etkisi"], ["kullanim", "Kullanım / doku / koku"], ["fp", "Fiyat / performans"]];

export const HUE = { "Yüz & Dudak": 18, "Tıraş & Sakal": 212, "Vücut": 160, "Koltukaltı": 190, "Hassas Bölge": 265, "El & Ayak": 35, "Saç": 120, "Ağız": 198, "Parfüm": 330,
  bakim: 198, giyim: 260, elektronik: 212, kahve: 30, saat: 45, oyun: 280, ev: 140 };

export const ICONS = {
  bakim: '<path d="M12 3c3.5 4.2 6 7.6 6 10.6A6 6 0 0 1 6 13.6C6 10.6 8.5 7.2 12 3z"/>',
  giyim: '<path d="M8 4 4 7l2 4 2-1v10h8V10l2 1 2-4-4-3c-.6 1.4-2.1 2.2-4 2.2S8.6 5.4 8 4z"/>',
  elektronik: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  kahve: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11 3v3"/>',
  saat: '<circle cx="12" cy="12" r="5"/><path d="M9 7.5 9.5 3h5l.5 4.5M9 16.5 9.5 21h5l.5-4.5M12 10v2l1.5 1"/>',
  oyun: '<path d="M7 8h10a4 4 0 0 1 3.9 4.9l-.8 3.5a2.4 2.4 0 0 1-4.1 1L14.5 16h-5L8 17.4a2.4 2.4 0 0 1-4.1-1l-.8-3.5A4 4 0 0 1 7 8z"/><path d="M8 11v3M6.5 12.5h3"/>',
  ev: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
  kitap: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
  spor: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16"/>',
  arac: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3zM7 19v1M17 19v1M5 11h14"/>',
  hediye: '<path d="M4 10h16v4H4zM6 14h12v6H6zM12 10v10"/><path d="M12 10c-2-4-6-4-6-1.5S10 10 12 10c2 0 6 1 6-1.5S14 6 12 10z"/>',
  etiket: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  camera: '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  out: '<path d="M7 17 17 7M9 7h8v8"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  star: '<path d="m12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.3 7 19l1.2-5.6L4 9.6 9.6 9z"/>'
};
export const PICKABLE_ICONS = ["bakim", "giyim", "elektronik", "kahve", "saat", "oyun", "ev", "kitap", "spor", "arac", "hediye", "etiket"];

export const ic = (k, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.etiket}</svg>`;
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const num = s => {
  if (s == null || s === "") return null;
  if (typeof s === "number") return isFinite(s) ? s : null;
  const t = String(s).replace(/TL|₺/gi, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const v = parseFloat(t);
  return isFinite(v) ? v : null;
};
export const tl = v => v == null ? "—" : v.toLocaleString("tr-TR", { maximumFractionDigits: v < 100 ? 2 : 0 }) + " TL";
export const safeUrl = u => /^https:\/\//i.test(u || "") ? u : "#";
export const lower = s => String(s || "").toLocaleLowerCase("tr");
export const uid = () => "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = s => { if (!s) return ""; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }); };
export const cimriUrl = x => "https://www.cimri.com/arama?q=" + encodeURIComponent([x.brand, x.name].filter(Boolean).join(" "));

export function lowest(x) {
  let best = null;
  for (const o of x.offers || []) {
    const v = num(o.price);
    if (v != null && (!best || v < best.v)) best = { ...o, v };
  }
  return best;
}
export const slug = s => lower(s).replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kategori";

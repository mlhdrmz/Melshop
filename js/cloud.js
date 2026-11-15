// Mel Shop — bulut katmanı (Supabase): giriş, ürünler, ayarlar, fotoğraflar
// Bu adres ve anahtar tarayıcıda kullanılmak içindir (herkese açık "publishable" anahtar).
// Verilerin güvenliğini veritabanındaki satır düzeyi kurallar sağlar: her hesap yalnızca
// kendi ürünlerini, ayarlarını ve fotoğraflarını görebilir/değiştirebilir.

export const SUPABASE_URL = "https://eofmrarfrhzemmhzvxmk.supabase.co";
export const SUPABASE_KEY = "sb_publishable_SM_FXkoef0UyKGTazA6sSw_C0U64uEI";
export const SUPABASE_LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm";
const BUCKET = "photos";

let sb = null;

export async function initCloud() {
  if (sb) return sb;
  const { createClient } = await import(SUPABASE_LIB);
  sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "melshop-auth" }
  });
  return sb;
}

const fail = (error, what) => { if (error) { const e = new Error(`${what}: ${error.message || error}`); e.cause = error; throw e; } };

/* ---------------- giriş ---------------- */
export const auth = {
  async session() { const { data } = await sb.auth.getSession(); return data.session || null; },
  onChange(fn) { return sb.auth.onAuthStateChange((event, session) => fn(event, session)); },
  async signIn(email, password) { return sb.auth.signInWithPassword({ email, password }); },
  async signUp(email, password) {
    return sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
  },
  async resetPassword(email) { return sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); },
  async updatePassword(password) { return sb.auth.updateUser({ password }); },
  async signOut() { return sb.auth.signOut(); }
};

/* ---------------- site ayarları ve profil ---------------- */
export async function signupsOpen() {
  const { data, error } = await sb.from("app_settings").select("value").eq("key", "signups_open").maybeSingle();
  if (error) return false;
  return data?.value === true;
}
export async function setSignupsOpen(open) {
  const { data, error } = await sb.from("app_settings").update({ value: !!open, updated_at: new Date().toISOString() }).eq("key", "signups_open").select("value");
  fail(error, "Kayıt ayarı değiştirilemedi");
  if (!data || !data.length) throw new Error("Bu ayarı yalnızca admin değiştirebilir");
  return data[0].value === true;
}
export async function myProfile() {
  const { data, error } = await sb.from("profiles").select("is_admin, created_at").maybeSingle();
  if (error) return { is_admin: false };
  return data || { is_admin: false };
}

/* ---------------- veri deposu: store.js ile aynı arayüz ---------------- */
export function cloudStore(uid) {
  const path = id => `${uid}/${id}`;
  const store = {
    async allItems() {
      const out = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from("items").select("data").order("id").range(from, from + 999);
        fail(error, "Ürünler okunamadı");
        out.push(...data.map(r => r.data));
        if (data.length < 1000) break;
      }
      return out;
    },
    async getItem(id) {
      const { data, error } = await sb.from("items").select("data").eq("id", id).maybeSingle();
      fail(error, "Ürün okunamadı");
      return data ? data.data : undefined;
    },
    async putItem(item) {
      const { error } = await sb.from("items").upsert({ user_id: uid, id: item.id, data: item, updated_at: new Date().toISOString() }, { onConflict: "user_id,id" });
      fail(error, "Ürün kaydedilemedi");
    },
    async putItems(items) {
      for (let i = 0; i < items.length; i += 200) {
        const rows = items.slice(i, i + 200).map(item => ({ user_id: uid, id: item.id, data: item, updated_at: new Date().toISOString() }));
        const { error } = await sb.from("items").upsert(rows, { onConflict: "user_id,id" });
        fail(error, "Ürünler kaydedilemedi");
      }
    },
    async deleteItem(id) {
      const item = await this.getItem(id);
      const pids = item?.photos || [];
      if (pids.length) { const { error } = await sb.storage.from(BUCKET).remove(pids.map(path)); fail(error, "Fotoğraflar silinemedi"); }
      const { error } = await sb.from("items").delete().eq("id", id);
      fail(error, "Ürün silinemedi");
    },
    async getPhoto(id) {
      const { data, error } = await sb.storage.from(BUCKET).download(path(id));
      if (error || !data) return undefined;
      return { id, blob: data };
    },
    async putPhoto(rec) {
      const { error } = await sb.storage.from(BUCKET).upload(path(rec.id), rec.blob, { upsert: true, contentType: rec.blob.type || "image/jpeg", cacheControl: "31536000" });
      fail(error, "Fotoğraf yüklenemedi");
    },
    async deletePhoto(id) {
      const { error } = await sb.storage.from(BUCKET).remove([path(id)]);
      fail(error, "Fotoğraf silinemedi");
    },
    async listPhotoIds() {
      const ids = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await sb.storage.from(BUCKET).list(uid, { limit: 1000, offset });
        fail(error, "Fotoğraflar listelenemedi");
        ids.push(...data.filter(f => f.id).map(f => f.name));
        if (data.length < 1000) break;
      }
      return ids;
    },
    async allPhotos() {
      const items = await this.allItems();
      const owner = new Map();
      for (const it of items) for (const pid of it.photos || []) owner.set(pid, it.id);
      const out = [];
      for (const id of await this.listPhotoIds()) {
        const rec = await this.getPhoto(id);
        if (rec) out.push({ ...rec, itemId: owner.get(id) || null });
      }
      return out;
    },
    async getMeta(key, fallback = null) {
      const { data, error } = await sb.from("user_meta").select("value").eq("key", key).maybeSingle();
      fail(error, "Ayar okunamadı");
      return data ? data.value : fallback;
    },
    async setMeta(key, value) {
      const { error } = await sb.from("user_meta").upsert({ user_id: uid, key, value }, { onConflict: "user_id,key" });
      fail(error, "Ayar kaydedilemedi");
    },
    // Yedeği tamamen yükler: hesaptaki mevcut verilerin yerini alır.
    async replaceAll({ items, photos, meta }) {
      const old = await this.listPhotoIds();
      for (let i = 0; i < old.length; i += 100) { const { error } = await sb.storage.from(BUCKET).remove(old.slice(i, i + 100).map(path)); fail(error, "Eski fotoğraflar silinemedi"); }
      { const { error } = await sb.from("items").delete().eq("user_id", uid); fail(error, "Eski ürünler silinemedi"); }
      { const { error } = await sb.from("user_meta").delete().eq("user_id", uid); fail(error, "Eski ayarlar silinemedi"); }
      for (const p of photos) await this.putPhoto(p);
      await this.putItems(items);
      for (const [key, value] of Object.entries(meta)) await this.setMeta(key, value);
    }
  };
  return store;
}

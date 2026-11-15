# Mel Shop

Sahip olduğun her şeyin kişisel vitrini. Alışveriş sitesi gibi görünür ama alım satım yoktur: elindekiler, sepetindekiler (alınacaklar) ve favorilerin kategorilere ayrılmış olarak burada durur.

## Özellikler

- **Kategoriler:** Kişisel Bakım, Giyim & Ayakkabı, Elektronik, Kahve & Mutfak, Saat & Aksesuar, Oyun & Kontrolcü, Ev. Ayarlar'dan yenisi eklenebilir.
- **Kategoriye özel alanlar:** Bakımda alt kategori ve "bitince yeniden al", giyimde beden ve renk, elektronikte model ve garanti bitişi, kahvede son kullanma tarihi, saatte referans no, oyunda platform, evde oda.
- **Listeler:** Elimde, Sepette, Favori. Her ürünün kartındaki kalp, çanta ve kutu düğmeleriyle tek tıkla eklenir ya da çıkarılır; bir ürün aynı anda birden fazla listede olabilir. "Aldım" sepetten elimdekilere, "Bitti, yeniden al" elimdekilerden sepete taşır. Elimdekiler sayfası kategori ve alt kategoriye göre gruplanır.
- **Kategori şeridi:** Yalnızca içinde ürün olan kategoriler görünür; "Kategori oluştur" ile yenisi eklenir.
- **Puanlar:** Piyasa puanı (gerekçesiyle) ve senin puanın (etkisi, kullanım, fiyat/performans, tekrar alır mıyım).
- **Fotoğraflar:** Ürün başına en fazla 4 fotoğraf; yüklerken otomatik küçültülür, şeffaf arka plan korunur. Kendi fotoğrafı olmayan ürünlerde mağazadaki ürün görseli (katalog fotoğrafı) gösterilir.
- **Fiyatlar:** Mağaza linkleri, en düşük fiyat kartlarda görünür; "Cimri'de ara" ile güncel fiyat aranır.
- **Yedek:** Ayarlar'dan tek dosya olarak yedek al / yedekten yükle (fotoğraflar dahil).
- **Hesaplar:** E-posta ve şifreyle giriş; veriler bulutta, her cihazdan aynı.
- **Uygulama olarak kurulur.**

## Hesaplar ve veriler

- Site Supabase'e bağlıdır (proje: `melshop`, Frankfurt). Giriş e-posta ve şifreyle yapılır; giriş yapmayan ziyaretçi yalnızca giriş sayfasını görür.
- Her hesabın ürünleri (`items`), ayarları (`user_meta`) ve fotoğrafları (`photos` deposu, `<hesap id>/` klasörü) ayrıdır. Satır düzeyi güvenlik kuralları sayesinde kimse başka bir hesabın verisini göremez ya da değiştiremez.
- İlk açılan hesap admin olur ve yeni kayıtlar kendiliğinden kapanır. Admin, Ayarlar → Yönetim'den yeni hesapları açıp kapatabilir.
- Hesaplardan önce tarayıcıda (IndexedDB) tutulan veriler silinmez; Ayarlar → "Bu tarayıcıdaki eski veriler" bölümünden tek seferde buluta taşınır.
- `js/cloud.js` içindeki adres ve anahtar tarayıcıda kullanılmak içindir (herkese açık "publishable" anahtar); gizli anahtar sitede yoktur.
- Ücretsiz planda Supabase, bir hafta hiç kullanılmayan projeyi duraklatır; panelden tek tıkla geri açılır, veri kaybolmaz.

Sitede hazır ürün listesi yoktur; her hesap kendi ürünlerini ekler. Kişisel listeler yalnızca sahibinin hesabında durur.

## Yapı

```
index.html            Sayfa iskeleti ve üst bant
css/styles.css        Tasarım (Mavi · saf tema, Source Sans 3)
js/app.js             Sayfalar, yönlendirme, olaylar
js/data.js            Kategoriler, özel alanlar, simgeler, yardımcılar
js/cloud.js           Supabase: giriş, ürünler, ayarlar, fotoğraflar
js/store.js           Tarayıcıdaki eski veri (IndexedDB), fotoğraf küçültme
sw.js                 Çevrimdışı önbellek
manifest.webmanifest  Uygulama bilgileri
fonts/                Source Sans 3 (SIL Open Font License)
icons/                Uygulama simgeleri
```

## Yayınlama

Derleme adımı yok, düz statik dosyalar. Vercel'de: **Add New → Project → bu repoyu seç → Framework Preset: Other → Deploy.** Sonraki her `main` gönderimi otomatik yayınlanır.

Yerelde denemek için: `python3 -m http.server 8000` ve tarayıcıda `http://localhost:8000`.

# Mel Shop

Sahip olduğun her şeyin kişisel vitrini. Alışveriş sitesi gibi görünür ama alım satım yoktur: elindekiler, sepetindekiler (alınacaklar) ve favorilerin kategorilere ayrılmış olarak burada durur.

## Özellikler

- **Kategoriler:** Kişisel Bakım, Giyim & Ayakkabı, Elektronik, Kahve & Mutfak, Saat & Aksesuar, Oyun & Kontrolcü, Ev. Ayarlar'dan yenisi eklenebilir.
- **Kategoriye özel alanlar:** Bakımda alt kategori ve "bitince yeniden al", giyimde beden ve renk, elektronikte model ve garanti bitişi, kahvede son kullanma tarihi, saatte referans no, oyunda platform, evde oda.
- **Durumlar:** Elimde, Sepette, Favori. "Aldım", "Sepete taşı", "Bitti, yeniden al" ile ürünler listeler arasında geçer.
- **Puanlar:** Piyasa puanı (gerekçesiyle) ve senin puanın (etkisi, kullanım, fiyat/performans, tekrar alır mıyım).
- **Fotoğraflar:** Ürün başına en fazla 4 fotoğraf; yüklerken otomatik küçültülür.
- **Fiyatlar:** Mağaza linkleri, en düşük fiyat kartlarda görünür; "Cimri'de ara" ile güncel fiyat aranır.
- **Yedek:** Ayarlar'dan tek dosya olarak yedek al / yedekten yükle (fotoğraflar dahil).
- **Uygulama olarak kurulur** ve internetsiz de açılır.

## Veriler nerede?

Tüm veriler tarayıcının kendi veritabanında (IndexedDB) saklanır; hiçbir sunucuya gitmez. Tarayıcı verileri temizlenirse silinir, bu yüzden düzenli yedek alınmalı.

İlk açılışta `data/seed.json` içindeki başlangıç verisi (Bakım Dolabı'ndan taşınan 30 ürün) yüklenir.

## Yapı

```
index.html            Sayfa iskeleti ve üst bant
css/styles.css        Tasarım (Mavi · saf tema, Source Sans 3)
js/app.js             Sayfalar, yönlendirme, olaylar
js/data.js            Kategoriler, özel alanlar, simgeler, yardımcılar
js/store.js           IndexedDB, fotoğraf küçültme
data/seed.json        Başlangıç verisi
sw.js                 Çevrimdışı önbellek
manifest.webmanifest  Uygulama bilgileri
fonts/                Source Sans 3 (SIL Open Font License)
icons/                Uygulama simgeleri
```

## Yayınlama

Derleme adımı yok, düz statik dosyalar. Vercel'de: **Add New → Project → bu repoyu seç → Framework Preset: Other → Deploy.** Sonraki her `main` gönderimi otomatik yayınlanır.

Yerelde denemek için: `python3 -m http.server 8000` ve tarayıcıda `http://localhost:8000`.

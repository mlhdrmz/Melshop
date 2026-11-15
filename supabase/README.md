# Supabase kurulumu (Mel Shop)

Proje: `melshop` (Frankfurt, eu-central-1). Veritabanı değişiklikleri Supabase'de
`melshop_baslangic` adlı geçişle uygulandı; içeriği `001_baslangic.sql` dosyasındadır.

Panelden yapılması gereken (kodla yapılamayan) ayar:
- Authentication → URL Configuration → **Site URL**: `https://melshop-tau.vercel.app`
  (onay ve şifre yenileme e-postalarındaki bağlantılar siteye dönsün diye).

Uygulanan geçişler: `001_baslangic.sql`, `002_is_admin_private.sql`.

Güvenlik testi (15.11.2026, iki sahte hesapla, sonunda geri alındı): kayıtlar kapalıyken
yeni hesap reddediliyor; her hesap yalnızca kendi ürün, ayar ve fotoğrafını görüyor;
başka hesabın ürününü güncelleyemiyor, silemiyor, onun adına ekleyemiyor; site ayarını
yalnızca admin değiştirebiliyor; giriş yapmamış ziyaretçi hiçbir ürün ya da fotoğraf göremiyor.

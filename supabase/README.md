# Supabase kurulumu (Mel Shop)

Proje: `melshop` (Frankfurt, eu-central-1). Veritabanı değişiklikleri Supabase'de
`melshop_baslangic` adlı geçişle uygulandı; içeriği `001_baslangic.sql` dosyasındadır.

Panelden yapılması gereken (kodla yapılamayan) ayar:
- Authentication → URL Configuration → **Site URL**: `https://melshop-tau.vercel.app`
  (onay ve şifre yenileme e-postalarındaki bağlantılar siteye dönsün diye).

Bekleyen iş: `public.is_admin()` fonksiyonu yalnızca güvenlik kurallarında kullanılıyor;
API'den çağrılabilmesi zararsız (yalnızca çağıranın kendi admin durumunu döndürür) ama
güvenlik danışmanı uyarı veriyor. `private` şemasına taşınacak.

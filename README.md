# FilmKanka — başlangıç sürümü

FilmKanka, oda kodu, yazılı sohbet, WebRTC sesli sohbet ve desteklenen doğrudan video URL'leri için senkronize oynatma içeren küçük bir web uygulaması başlangıcıdır.

## Gereksinimler
- Node.js 18 veya üzeri
- İnternet bağlantısı

## Bilgisayarda çalıştırma
```bash
npm install
npm start
```
Ardından `http://localhost:3000` adresini açın.

## İki telefondan deneme
Uygulamayı internete açık bir Node.js sunucusuna dağıtın ve HTTPS alan adından açın. Mikrofon erişimi için HTTPS gerekir. İki kullanıcı aynı oda kodunu girmelidir.

## Önemli sınırlar
- Video alanı yalnızca tarayıcıda doğrudan oynatılabilen video dosyası URL'lerini (ör. MP4/WebM) destekler. Normal film sitesi sayfaları, Google arama sonuçları veya üçüncü taraf oynatıcılar otomatik olarak senkronize edilemez.
- Yalnızca izleme hakkınız olan ve doğrudan paylaşılmasına izin verilen video kaynaklarını kullanın.
- Sesli sohbet için örnek STUN yapılandırması bulunur. Farklı mobil ağlarda bağlantı kararlılığı için üretimde TURN sunucusu gerekebilir.
- Bu bir prototiptir; oda kimlik doğrulaması, oran sınırlama, TURN hizmeti, kalıcı sohbet ve kötüye kullanım önlemleri üretim öncesi eklenmelidir.
- Sunucu yeniden başlatılırsa oda durumu silinir.

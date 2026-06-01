# Scan Adapter / Branch Daemon Integration Notes

## Amaç

Bu doküman, `scan-adapter` ile `branch-daemon` arasında yapılan entegrasyon düzeltmelerini, bu düzeltmelerin nedenlerini ve doğrulama adımlarını toplar.

Ana hedef:

- Eski Java adapter davranışını bozmadan `branch-daemon` REST akışını çalıştırmak
- `Scan -> GetFiles -> image bytes` zincirini uçtan uca doğrulamak
- Object-storage semantiğini korumak

## Başlangıçtaki Sorunlar

İlk durumda aşağıdaki problemler vardı:

1. `scan-adapter` içinde `DocPageInfo` için eski method isimleri kullanılıyordu.
   Eski isimler:
   - `getFilename()`
   - `setFilename(...)`

   Yeni jar ile gelen isimler:
   - `getFileName()`
   - `setFileName(...)`

2. `RestClient` query string encode ederken `?session_id=...&user_guid=...` bölümünü de path gibi encode ediyordu.
   Sonuç:
   - `GET /scan/get-files` yanlış endpoint formatıyla gidiyordu
   - `GetFiles` fallback moduna düşüyordu

3. `branch-daemon` tarafındaki `GET /scan/get-files` eski ağaç yapısını tarıyordu.
   Halbuki document scan metadata’sı `storage/<date>/document/<type>/<document_id>/metadata.json` altında duruyordu.

4. `scan-adapter` tarafı `GetFiles` response’undan gelen `image_path` alanını lokal filesystem path’i gibi açmaya çalışıyordu.
   Bu iki nedenle sorunluydu:
   - remote absolute path’e bağımlıydı
   - Linux/Windows karışık deployment’ta çalışmıyordu

5. `DMSSharedScanner` kaynak kodunda test amaçlı bırakılmış hardcode bağlantı vardı:

   ```java
   remoteScan = new RemoteScan("testUser", TEST_CLIENT_IP, DAEMON_HOST);
   ```

   Bu yüzden production host yerine `localhost` kullanılıyordu.

## Temel Tasarım Kararı

En önemli karar, image binary’yi `GetFiles` response’unda doğrudan döndürmemek oldu.

Sebep:

- Daemon tarafı object storage semantiğiyle çalışıyor
- gRPC akışında zaten önce metadata/path, sonra object fetch davranışı var
- REST tarafında da aynı iş semantiğini korumak gerekiyor

Son tasarım:

1. `GET /scan/get-files`
   - sadece metadata döner
   - `object_path`
   - `pages`
   - `filename`
   - `image_path` (object-storage path)

2. `GET /storage/object?path=...`
   - raw image bytes döner
   - `scan-adapter` bu endpoint üzerinden `DocPageInfo.objFile` doldurur

Bu yaklaşım:

- S3/object storage mantığını bozmaz
- remote filesystem bağımlılığını kaldırır
- gRPC ve REST arasında aynı iş akışını korur

## Branch Daemon Tarafında Yapılanlar

### 1. `GET /scan/get-files` düzeltildi

Önceden endpoint document scan metadata’sını kullanmıyordu.

Yeni davranış:

- persisted document metadata recursive olarak bulunuyor
- `session_id` ile filtreleniyor
- response içinde `batches` üretiliyor
- her page için metadata dönülüyor

Beklenen response şekli:

```json
{
  "return_code": 0,
  "batches": [
    {
      "batch_id": "11",
      "object_path": "storage/2026-04-28/document/generic/11",
      "pages": [
        {
          "page_id": "11_sheet_1_front",
          "page_number": 1,
          "filename": "001-front.jpg",
          "image_format": "jpg",
          "image_path": "storage/2026-04-28/document/generic/11/pages/001-front.jpg"
        }
      ]
    }
  ]
}
```

### 2. Yeni object fetch REST girişi eklendi

Yeni endpoint:

```text
GET /storage/object?path=storage/2026-04-28/document/generic/11/pages/001-front.jpg
```

Davranış:

- mevcut storage okuma mantığını yeniden kullanır
- raw binary döner
- uygun content type döner

### 3. `image_path` düzeltildi

Eski sorunlar:

- `storage/storage/...` duplication
- host-local Windows absolute path dönülmesi

Yeni durum:

- `image_path` artık object-storage path
- basename ayrıca `filename` alanında veriliyor

### 4. Branch daemon doğrulaması

Doğrulanan komutlar:

```bash
cargo check -p branch-daemon
cargo check -p branch-daemon --tests
```

Not:

- Ortam kaynaklı `could not canonicalize path C:\Users\alphan` uyarısı görüldü
- Proje dışı `unused import` warning’leri vardı
- Bunlar yapılan düzeltmenin sonucu değildi

## Scan Adapter Tarafında Yapılanlar

### 1. `DocPageInfo` API rename

`filename` alanı ve accessor’lar yeni isimlere geçirildi:

- `filename` -> `fileName`
- `getFilename()` -> `getFileName()`
- `setFilename(...)` -> `setFileName(...)`

Bu değişiklik:

- `wsBranch.DocPageInfo`
- `InnerScan`
- `IntegrationTest`

üzerinde güncellendi.

### 2. `RestClient` query encode bug fix

Eski durumda query string path gibi encode ediliyordu.

Düzeltme:

- path ve query string ayrıldı
- query raw bırakıldı

Sonuç:

- `/scan/get-files?session_id=...&user_guid=...` doğru gönderilmeye başladı

### 3. `RestClient` binary GET desteği

Yeni helper:

- `byte[] getBytes(String endpoint)`

Amaç:

- `/storage/object?path=...` üzerinden raw image byte çekebilmek

### 4. `InnerScan.GetFiles(...)` object fetch uyarlaması

Eski davranış:

- `image_data` yoksa `image_path` lokal diskten okunuyordu

Yeni davranış:

- `image_data` varsa decode edilir
- yoksa `/storage/object?path=<image_path>` çağrılır
- dönen byte[] `DocPageInfo.objFile` içine yazılır

### 5. Gerçek session id takibi

Branch daemon `session_id` ile filtrelediği için,
Java tarafında da gerçek persisted session korunmalıydı.

Sorun:

- `OpenSession` gerçek session id üretir
- `releaseScanner()` sonrası `activeSessionId` temizlenir
- `GetFiles(...)` eski `userGuid` ile çağrılırsa eşleşme bulunmaz

Düzeltme:

- `lastCompletedSessionId` eklendi
- `GetFiles(...)` şu sırayla session seçer:
  1. `activeSessionId`
  2. `lastCompletedSessionId`
  3. `scanUserGuid`

### 6. Path-separator bağımsız filename çıkarımı

Yeni helper ile:

- `/` ve `\` ayraçları birlikte destekleniyor
- `filename` üretimi platform bağımlı olmaktan çıkarıldı

## Integration Test Tarafında Yapılanlar

### 1. `IntegrationTest` gerçek ERE akışına yaklaştırıldı

Testler şu akışları doğrulayacak şekilde güncellendi:

- `RemoteScan.Scan(...)`
- `RemoteScan.ScanMulti(...)`
- `RemoteScan.EndScanning(...)`
- `GetFiles(...)`
- metadata + raw image payload

### 2. Yeni object payload testi eklendi

Özel test:

- `GetFiles Object Storage Resim Payload Test`

Doğruladıkları:

- batch dönüyor mu
- page dönüyor mu
- `fileName` dolu mu
- `objFile` dolu mu
- image header gerçek JPEG mi (`FF D8 FF`)

### 3. ERE full flow testi

Özel test:

- `ERE Tam Flow (Tarama → Dosya Fetch → Resim Byte'ları)`

Doğruladıkları:

- `Scan`
- `EndScanning`
- `GetFiles`
- batch/page parse
- `objFile` gerçekten doluyor mu

## DMSSharedScanner Uyarlama Testi

Paylaşılan gerçek sınıfın akışını doğrulamak için yeni bir test sınıfı eklendi:

- [DmsSharedScannerTest.java](/home/alphan/Desktop/scan-adapter/src/test/java/com/ere/scan/DmsSharedScannerTest.java:1)

Bu sınıf, paylaşılan DMS kodunun çalıştırılabilir uyarlamasıdır.

### Neden birebir kopya değil?

Paylaşılan sınıfın birebir hali şu bağımlılıklara sahipti:

- `JCSUtilityBean`
- Swing UI
- JAI codec
- PDFBox

Bunlar `scan-adapter` test projesinde olmadığı için test sınıfı koşamazdı.

Bu yüzden en dar runnable uyarlama yapıldı.

### Korunan davranış

Akış özellikle aynı tutuldu:

1. `initScanner(...)`
2. `reserveScanner(...)`
3. `endScanning()`
4. `getFiles(...)`
5. page listesi + `objFile`
6. base64 çıktı üretimi

### Bilinçli değişiklikler

Kod içinde `CHANGED:` yorumları ile belirtildi:

1. Test hardcode’u kaldırıldı

Eski:

```java
remoteScan = new RemoteScan("testUser", TEST_CLIENT_IP, DAEMON_HOST);
```

Yeni:

```java
remoteScan = new RemoteScan(clientHostName, clientHostAddress, centralServerIP);
```

Sebep:

- aksi halde production host yerine `localhost` kullanılıyor

2. `getFilename()` yerine `getFileName()` kullanıldı

Sebep:

- yeni jar API’si ile uyum

3. JAI/PDF üretimi yerine byte/base64 doğrulaması yapıldı

Sebep:

- test projesinde imaging bağımlılıkları yok
- entegrasyonun kritik noktası olan `objFile` doluluğu ve image byte geçerliliği zaten bu yolla doğrulanabiliyor

## Çalıştırma Komutları

### IntegrationTest

```bash
cd /home/alphan/Desktop/scan-adapter
mvn -q test-compile dependency:build-classpath -Dmdep.outputFile=/tmp/scan-adapter.cp
java -cp "target/test-classes:target/classes:$(cat /tmp/scan-adapter.cp)" com.ere.scan.IntegrationTest 10.10.10.151
```

### DMSSharedScanner uyarlama testi

```bash
cd /home/alphan/Desktop/scan-adapter
mvn -q test-compile dependency:build-classpath -Dmdep.outputFile=/tmp/scan-adapter.cp
java -cp "target/test-classes:target/classes:$(cat /tmp/scan-adapter.cp)" com.ere.scan.DmsSharedScannerTest 10.10.10.151
```

### İlk sayfayı dosyaya dump ederek görsel doğrulama

```bash
java -cp "target/test-classes:target/classes:$(cat /tmp/scan-adapter.cp)" \
  com.ere.scan.DmsSharedScannerTest 10.10.10.151 /tmp/first-page.jpg
```

Sonra:

```bash
file /tmp/first-page.jpg
```

ve istenirse:

```bash
xdg-open /tmp/first-page.jpg
```

## Nihai Doğrulama Sonuçları

### IntegrationTest

Son başarılı durum:

- `PASSED: 16`
- `FAILED: 0`

Özellikle geçen kritik testler:

- `GetFiles Object Storage Resim Payload Test`
- `ERE FLOW BAŞARILI! Resim byte'ları tamamen çalışıyor!`

### DMSSharedScannerTest

Son başarılı durum:

- `scanReferenceNo` üretildi
- `scanFileName = /DMSScannedFile.tiff`
- `pageCount = 1`
- `firstFileName = 001-front.jpg`
- `firstObjFileBytes = 319725`
- `base64Length = 426300`
- `✓ DMSSharedScanner uyarlama testi başarılı`

## Sonuç

Bu çalışma sonunda:

- `scan-adapter` ile `branch-daemon` REST entegrasyonu uçtan uca çalışır hale geldi
- object storage semantiği korundu
- `GetFiles` artık metadata-only davranıyor
- raw image bytes ayrı storage endpoint’ten çekiliyor
- Java adapter `DocPageInfo.objFile` alanını doğru dolduruyor
- hem IntegrationTest hem de DMSSharedScanner uyarlama testi başarıyla geçti

Kısa özet:

- eski host-local path yaklaşımı kaldırıldı
- session eşleşmesi düzeltildi
- binary fetch doğru yere taşındı
- gerçek dünya kullanım akışı testle doğrulandı

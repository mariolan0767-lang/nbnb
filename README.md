# Denbook

Denbook, buyuk sosyal ag uygulamalarindan ilham alan ama marka ve icerik olarak ozgun tasarlanmis full-stack bir web uygulamasidir.

## Icerik

- ust gezinme ve arama
- ana akis, hikayeler ve medya destekli gonderi olusturma
- arkadas ve topluluk ekrani
- kisa video akisi
- pazar alani
- etkinlik listesi
- mesaj kutusu
- profil sayfasi
- arama, begeni, yorum ve bildirimler
- SQLite veri katmani
- scrypt tabanli parola hashleme
- cookie + CSRF korumali oturum yonetimi
- rate limit ve temel validasyonlar
- rol tabanli admin/moderator paneli
- audit loglari
- PWA manifest ve service worker
- Render deploy dosyasi ve test

## Calistirma

1. `npm start`
2. Tarayicida `http://localhost:3000` ac

## Test

`npm test`

## Render

- `render.yaml` hazir
- persistent disk tanimli
- health check yolu: `/api/healthz`
- prod icin `APP_URL` ortam degiskenini kendi domainin olarak gir
- sqlite dosyasi Render diskine yazilir

## Demo hesaplar

- uye: `deniz@denbook.local` / `123456`
- admin: `admin@denbook.local` / `denbook123`

GitHub ve Render icin bu klasoru dogrudan repoya yukleyebilirsin.

# Spesifikasi Sistem Analitik & Pendukung Keputusan (Konteks Sekolah Militer)

Dokumen ini menguraikan spesifikasi terperinci untuk Portal Analitik & Pendukung Keputusan, mencakup kebutuhan data, pemetaan eksplisit antara item data dan jenis grafik, sumber data yang tepat (SIMRS vs. e-Lat), serta penempatan dalam tata letak UI untuk setiap tampilan analitik.

> **Konteks:** Spesifikasi ini diadaptasi untuk lingkungan **sekolah militer**. Dua sistem data utama yang digunakan adalah:
> - **SIMRS** *(Student Information & Registration Management System)* — setara militer dengan AIS, mengelola rekam data taruna, status akademik, penjadwalan, dan data administratif.
> - **e-Lat** *(e-Learning & Training)* — setara militer dengan LMS, mengelola modul pembelajaran digital, materi pelatihan, penilaian, dan keterlibatan taruna.

> [!NOTE]
> Semua jenis grafik dalam dokumen ini telah divalidasi kompatibilitasnya dengan **Apache Superset**. Apabila visualisasi yang dimaksud tidak didukung secara native oleh Superset, alternatif yang setara secara fungsional dan kompatibel dengan Superset telah disubstitusi dan dicatat.

---

## Daftar Isi
1. [Portal Analitik & Pendukung Keputusan](#1-portal-analitik--pendukung-keputusan)
2. [Analisis Data Terpadu](#2-analisis-data-terpadu)
3. [Dasbor Pendukung Keputusan](#3-dasbor-pendukung-keputusan)
4. [Tampilan Keputusan Eksekutif](#4-tampilan-keputusan-eksekutif)
5. [Tampilan Keputusan Operasional](#5-tampilan-keputusan-operasional)
6. [Analisis Tren](#6-analisis-tren)
7. [Analisis Historis](#7-analisis-historis)
8. [Analisis Kesiapan](#8-analisis-kesiapan)
9. [Analisis Kinerja](#9-analisis-kinerja)
10. [Analitik Penilaian](#10-analitik-penilaian)
11. [Analitik Kehadiran](#11-analitik-kehadiran)
12. [Analitik Partisipasi](#12-analitik-partisipasi)

---

## 1. Portal Analitik & Pendukung Keputusan

* **Data yang Dibutuhkan dari SIMRS:** Peran/izin pengguna (Instruktur, Komandan Pleton, Pimpinan), tanggal periode pelatihan saat ini, status akademik & fisik taruna, serta siaran peringatan global (mis., perubahan jadwal, perintah khusus).
* **Data yang Dibutuhkan dari e-Lat:** Jumlah tugas/latihan yang belum dinilai, pesan belum dibaca dari instruktur, pengumuman modul/mata pelajaran terkini.

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| Ringkasan status akademik & fisik taruna dan jumlah remediasi/probasi | **SIMRS** (Status akademik & fisik, rekam remediasi) | **Scorecard Angka Besar** (dengan indikator status Merah/Kuning/Hijau) | Baris Teratas (Scorecard "Angka Besar" Horizontal) |
| Tugas/latihan belum dinilai & tugas penilaian instruktur yang tertunda | **e-Lat** (Jumlah tugas belum dinilai, antrean tugas instruktur) | **Diagram Lingkaran** (mode donat, persentase penyelesaian) | Badan Utama (Kolom 1 Grid Seret-dan-Lepas Modular) |
| Tren keterlibatan taruna & aktivitas modul pelatihan | **e-Lat** (Waktu aktif mingguan, log akses modul) | **Angka Besar dengan Garis Tren** *(menggantikan Sparklines; satu panel per metrik utama menampilkan nilai + garis tren mini)* | Badan Utama (Kolom 2 Grid Seret-dan-Lepas Modular) |
| Peringatan sistem & siaran global (mis., *"Ujian Akhir dibuka dalam 48 jam"*) | **SIMRS & e-Lat** (Tanggal jadwal ujian/pelatihan, pengumuman sistem) | **Tabel Tersaring & Terurut** dengan lencana status berkode warna *(menggantikan Lencana Notifikasi / Kartu Daftar Tindakan; baris diurutkan berdasarkan urgensi, kolom lencana dikodekan warna berdasarkan prioritas)* | Panel Kanan Geser Persisten |

---

## 2. Analisis Data Terpadu

* **Data yang Dibutuhkan dari SIMRS:** Status beasiswa/bantuan keuangan, penanda demografis (angkatan, korps/cabang, daerah asal), jalur spesialisasi yang dipilih (cabang dinas), IPK kumulatif saat ini dan skor kebugaran fisik.
* **Data yang Dibutuhkan dari e-Lat:** Cap waktu login, total waktu keterlibatan dalam menit, tingkat penyelesaian modul.

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| Kontrol dimensi (Pemilihan sumbu untuk status bantuan, cabang dinas, IPK vs. keterlibatan e-Lat) | **SIMRS** (Cabang dinas, IPK, Bantuan Keuangan) + **e-Lat** (Menit Keterlibatan) | **Filter Native Dasbor** (dropdown filter) | 25% Kiri (Panel Kontrol Vertikal) |
| Ketergantungan beasiswa vs. rata-rata waktu keterlibatan e-Lat mingguan (identifikasi taruna berisiko) | **SIMRS** (Status Bantuan Keuangan) + **e-Lat** (Menit Keterlibatan Mingguan) | **Diagram Sebar** (Analisis korelasi) | 75% Kanan (Bagian Atas Kanvas Interaktif Utama) |
| Korelasi yang menyertakan variabel ke-3 (mis., ukuran kelas atau IPK bersama bantuan vs. keterlibatan) | **SIMRS** (IPK, Ukuran Kelas) + **e-Lat** (Menit Keterlibatan) | **Diagram Gelembung** | 75% Kanan (Tampilan toggle pada Kanvas Interaktif Utama) |
| Pola keterlibatan lintas modul/hari dalam minggu pelatihan | **e-Lat** (Cap waktu login harian, log penyelesaian modul) | **Peta Panas** | 75% Kanan (Tampilan Alternatif / Bagian Detail Kanvas) |
| Metrik terperinci tingkat taruna yang mendasari | **SIMRS** (Profil taruna, Cabang Dinas, IPK) + **e-Lat** (Total waktu keterlibatan) | **Tabel** (dapat diurutkan) | 75% Kanan (Bagian Bawah di bawah Kanvas) |

---

## 3. Dasbor Pendukung Keputusan

* **Data yang Dibutuhkan dari SIMRS:** Nilai evaluasi pertengahan pelatihan, janji mentoring/konseling yang terlewat, kewajiban administratif yang belum diselesaikan (mis., pengembalian perlengkapan yang belum lengkap).
* **Data yang Dibutuhkan dari e-Lat:** Penurunan tajam pada pengumpulan tugas baru-baru ini, ketidakhadiran berkepanjangan dari modul pelatihan.

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| 25 taruna teratas yang diprioritaskan dengan probabilitas prediktif >80% gagal akademik/pelatihan + tombol tindakan *"Jadwalkan Intervensi"* | **SIMRS** (Nilai pertengahan pelatihan, konseling terlewat) + **e-Lat** (Penurunan pengumpulan tugas) | **Tabel** (diurutkan berdasarkan skor risiko menurun, dengan kolom lencana risiko berkode warna) | Badan Utama (Tampilan Alur Kerja Utama Berorientasi Tindakan) |
| Tingkat risiko kegagalan/putus pelatihan prediktif & indikator ambang batas | **SIMRS & e-Lat** (Output model AI prediktif gabungan) | **Diagram Pengukur** (Tingkat Risiko) | Panel Sisi Kanan yang Dapat Diperluas (Bagian Atas) |
| Indikator kinerja pelatihan target vs. aktual (nilai, tingkat pengumpulan, skor fisik) | **SIMRS** (Nilai & skor fisik target vs. aktual) + **e-Lat** (Tingkat pengumpulan) | **Diagram Batang Berkelompok** (batang aktual vs. batang target berdampingan per metrik) *(menggantikan Bullet Graphs yang tidak didukung secara native di Superset)* | Panel Sisi Kanan yang Dapat Diperluas (Bagian Tengah) |
| Jalur aturan logis yang membenarkan rekomendasi (mis., konseling terlewat + nilai turun + skor fisik rendah) | **SIMRS** (Rekam konseling, nilai pertengahan pelatihan) + **e-Lat** (Log ketidakhadiran) | **Tabel Ringkasan Aturan Berkode Warna** (kolom = kondisi risiko, baris = taruna, sel = lencana terpicu/tidak terpicu) *(menggantikan Visualisasi Pohon Keputusan yang tidak didukung secara native di Superset)* | Panel Sisi Kanan yang Dapat Diperluas (Bagian Bawah) |

---

## 4. Tampilan Keputusan Eksekutif

* **Data yang Dibutuhkan dari SIMRS:** Jumlah pendaftaran/penerimaan taruna agregat per program (Latihan Dasar, Sekolah Calon Perwira, Latihan Lanjutan), total pemanfaatan anggaran pelatihan, data pendaftaran kohort historis, status pelacakan akreditasi dan sertifikasi.
* **Data yang Dibutuhkan dari e-Lat:** *(Minimal)* Tingkat adopsi sistem agregat di berbagai korps/departemen.

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| Total pendaftaran taruna periode pelatihan saat ini terhadap target, pemanfaatan anggaran pelatihan YTD, dan tingkat retensi taruna tahun pertama | **SIMRS** (Jumlah pendaftaran, total pemanfaatan anggaran, rekam retensi) | **Scorecard Angka Besar** (dengan indikator perubahan %) | Header Atas / Baris 1 (Tata Letak Kontras Tinggi) |
| Distribusi geografis asal taruna (wilayah/provinsi) | **SIMRS** (Alamat asal taruna, provinsi asal, wilayah komando regional) | **Peta Negara** / Deck.gl Polygon (Koropleth) | Badan Utama (Widget Grid Kiri) |
| Rincian anggaran pelatihan dan pendaftaran lintas korps/cabang dinas | **SIMRS** (Pemanfaatan anggaran, rincian korps/cabang) + **e-Lat** (Tingkat adopsi) | **Diagram Batang** (mode bertumpuk) | Badan Utama (Widget Grid Kanan) |

---

## 5. Tampilan Keputusan Operasional

* **Data yang Dibutuhkan dari SIMRS:** Jumlah pendaftaran mata pelajaran dan kapasitas kelas secara real-time, jadwal kelas/aula dan matriks kapasitas, alokasi lapangan latihan fisik.
* **Data yang Dibutuhkan dari e-Lat:** Pengguna bersamaan yang aktif di platform, latensi server, dan metrik uptime.

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| Pemanfaatan kursi kelas/aula harian & batas kapasitas beban server | **SIMRS** (Kapasitas kursi kelas/aula) + **e-Lat** (Batas beban server) | **Diagram Batang** (Penggunaan aktual vs. kapasitas maksimum) | Baris Widget Atas (Grid Pusat Komando) |
| Progres pendaftaran mata pelajaran secara real-time menuju target pendaftaran per kelas | **SIMRS** (Log pendaftaran mata pelajaran langsung) | **Diagram Batang Horizontal** (pendaftaran aktual vs. kapasitas target per kelas) *(menggantikan Progress Bars yang tidak didukung secara native di Superset)* | Header / Bilah Ringkasan |
| Pengguna bersamaan langsung, latensi server, dan uptime sistem | **e-Lat** (Telemetri sesi aktif, log uptime server) | **Diagram Garis** (dengan pembaruan otomatis dasbor) | Bagian Grid Tengah |
| Jumlah daftar tunggu real-time untuk mata pelajaran dasar yang menjadi bottleneck | **SIMRS** (Jumlah daftar tunggu, antrean pendaftaran mata pelajaran) | **Tabel** (dapat diurutkan, dengan lencana status berkode warna) | Tampilan Pusat Komando Bawah Utama (Diperbarui otomatis setiap beberapa menit) |

---

## 6. Analisis Tren

* **Data yang Dibutuhkan dari SIMRS:** Pilihan korps/cabang historis dan jam kredit yang dihasilkan per departemen selama 10+ semester/angkatan.
* **Data yang Dibutuhkan dari e-Lat:** Pergeseran historis dalam metode penyampaian pelatihan (online vs. hybrid vs. modul lapangan/tatap muka).

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| Trajektori 5 tahun yang membandingkan pergeseran pilihan cabang/korps (mis., penurunan pendaftaran infanteri vs. lonjakan korps siber/sinyal) | **SIMRS** (Deklarasi cabang historis selama 10+ semester/angkatan) | **Diagram Garis** (multi-seri) | Panggung Utama Tengah (Tata Letak Horizontal Lebar) |
| Volume jam kredit dari waktu ke waktu lintas departemen/bidang mata pelajaran | **SIMRS** (Jam kredit departemen yang dihasilkan) | **Diagram Area** | Kanvas Utama (Opsi Toggle Tampilan) |
| Pergeseran positif/negatif kumulatif dalam deklarasi cabang/spesialisasi | **SIMRS** (Pergeseran transfer/pemilihan cabang) | **Diagram Batang Berkelompok** (kolom delta positif vs. delta negatif, berkode warna hijau/merah) *(menggantikan Waterfall Chart yang tidak didukung secara native di Superset)* | Kanvas Utama (Opsi Toggle Tampilan) |
| Pengontrol zoom kerangka waktu (semester/angkatan/tahun) | **SIMRS & e-Lat** (Metadata timeline Semester/Angkatan/Tahun) | **Filter Rentang Tanggal Native Dasbor** *(menggantikan Master Timeline Slider yang tidak didukung secara native di Superset)* | Bilah filter persisten di bawah grafik utama |

---

## 7. Analisis Historis

* **Data yang Dibutuhkan dari SIMRS:** Rekam taruna yang lulus, penanda demografis (angkatan, jenis kelamin, daerah asal, korps), tahun masuk, serta tanggal kelulusan/pengangkatan.
* **Data yang Dibutuhkan dari e-Lat:** Hasil modul pelatihan agregat historis dan tingkat penyelesaian.

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| Perbandingan berdampingan tingkat kelulusan tepat waktu (Angkatan 2018 vs. Angkatan 2019 yang diisolasi berdasarkan daerah asal) | **SIMRS** (Rekam kelulusan, tahun masuk, penanda demografis) | **Diagram Batang** (mode berkelompok) | Setengah Atas Tampilan Terpisah (Dataset A di 50% Kiri vs. Dataset B di 50% Kanan) |
| Alur taruna, retensi, dan titik atrisi selama periode pelatihan penuh | **SIMRS** (Rekam retensi & pengangkatan kohort) + **e-Lat** (Hasil modul pelatihan agregat) | **Diagram Sankey** | Setengah Bawah Tampilan Terpisah (Dataset A di 50% Kiri vs. Dataset B di 50% Kanan) |

---

## 8. Analisis Kesiapan

* **Data yang Dibutuhkan dari SIMRS:** Transkrip pelatihan taruna, pohon logika mata pelajaran prasyarat, basis data kredensial instruktur dan rekam kualifikasi.
* **Data yang Dibutuhkan dari e-Lat:** Skor pra-penilaian atau tes penempatan yang diselesaikan sebelum periode pelatihan dimulai.

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| Persentase taruna terdaftar di Mata Pelajaran Lanjutan A yang menyelesaikan Mata Pelajaran Prasyarat C (nilai C atau lebih baik) | **SIMRS** (Transkrip taruna & pohon logika prasyarat) | **Angka Besar dengan Diagram Pengukur** (nilai persentase dengan busur pengukur) *(menggantikan Radial Progress Bar yang tidak didukung secara native di Superset)* | Ikhtisar Atas / Kartu Ringkasan |
| Pemetaan kompetensi awal taruna vs. tujuan pembelajaran mata pelajaran yang dipersyaratkan | **SIMRS** (Transkrip) + **e-Lat** (Skor pra-penilaian/tes penempatan) | **Diagram Radar** | Widget Sisi Panel Matriks |
| Pemenuhan prasyarat dan persyaratan akreditasi/sertifikasi per taruna/instruktur | **SIMRS** (Pohon prasyarat & rekam kualifikasi instruktur) + **e-Lat** (Penyelesaian tes penempatan) | **Tabel Pivot** (baris = entitas, kolom = persyaratan, nilai = status pemenuhan) *(menggantikan Tampilan Grid Matriks; pemformatan warna kondisional diterapkan pada nilai status)* | Ruang Kerja Matriks Pusat |

---

## 9. Analisis Kinerja

* **Data yang Dibutuhkan dari SIMRS:** Nilai akhir, cap waktu penarikan/putus pelatihan, penugasan instruktur per seksi mata pelajaran, dan skor tes kebugaran fisik.
* **Data yang Dibutuhkan dari e-Lat:** Skor evaluasi pengajaran teragregasi dan hasil survei taruna akhir periode.

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| Tingkat setara DFW (Drop/Fail/Withdraw) untuk mata pelajaran dasar (mis., Taktik Dasar 101) yang dibandingkan di antara 5 instruktur | **SIMRS** (Nilai akhir, cap waktu penarikan, penugasan seksi instruktur) | **Diagram Kotak** (menampilkan varians nilai & outlier) | Tampilan Utama Penelusuran Bertingkat (Penelusuran dari Departemen → Bidang Mata Pelajaran → Mata Pelajaran → Seksi) |
| Distribusi nilai per seksi/instruktur | **SIMRS** (Distribusi nilai akhir per seksi) | **Histogram** | Bagian Detail dalam Penelusuran Bertingkat |
| Skor evaluasi pengajaran taruna akhir periode per instruktur | **e-Lat** (Skor survei evaluasi pengajaran teragregasi) | **Diagram Batang** (mode horizontal) | Kartu perbandingan berdampingan dalam Penelusuran Seksi |

---

## 10. Analitik Penilaian

* **Data yang Dibutuhkan dari SIMRS:** Daftar resmi mata pelajaran taruna.
* **Data yang Dibutuhkan dari e-Lat:** Bank soal, respons tes taruna individual, waktu yang dihabiskan per soal, skor kriteria rubrik.

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| Distribusi skor kelas pada ujian pertengahan pelatihan | **SIMRS** (Daftar resmi) + **e-Lat** (Skor respons tes individual) | **Histogram** *(menggantikan Bell Curve / Distribution Chart; mendekati bentuk distribusi skor)* | Setengah Atas (Tampilan Horizontal Terpisah) |
| Analisis butir soal ujian (mis., peringatan yang menunjukkan 82% memilih pengecoh yang sama pada Soal 14) | **e-Lat** (Bank soal & log respons butir) | **Diagram Batang Horizontal** (dua seri warna: tingkat respons benar vs. salah per soal) *(menggantikan Diverging Bar Chart yang tidak didukung secara native di Superset)* | Setengah Bawah (Sisi Kiri Tabel Soal yang Dapat Diurutkan) |
| Waktu yang dihabiskan pada soal vs. skor akhir | **e-Lat** (Waktu yang dihabiskan per soal & skor soal akhir) | **Diagram Sebar** | Laci Detail Soal yang Dapat Diperluas / Panel Sisi |
| Tabel peringkat kesulitan soal | **e-Lat** (Indeks kesulitan bank soal) | **Tabel** (dapat diurutkan) | Setengah Bawah (Tampilan Horizontal Terpisah) |

---

## 11. Analitik Kehadiran

* **Data yang Dibutuhkan dari SIMRS:** Kebijakan kehadiran institusional dan ambang batas kepatuhan beasiswa/bantuan keuangan, aturan kehadiran wajib per peraturan dinas militer.
* **Data yang Dibutuhkan dari e-Lat:** Log check-in harian, waktu masuk/keluar kuliah virtual (mis., integrasi konferensi video), rekam kehadiran yang ditandai instruktur.

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| Pola kehadiran periode pelatihan dan kluster hari dengan ketidakhadiran tinggi | **SIMRS** (Tanggal kalender akademik/pelatihan) + **e-Lat** (Log check-in harian, waktu masuk/keluar virtual) | **Diagram Kalender** (Bayangan lebih gelap = hari ketidakhadiran lebih tinggi) | Area Layar Utama (Tampilan Dominan Berpusat pada Kalender) |
| Tren kehadiran/ketidakhadiran yang dilacak sepanjang periode pelatihan | **e-Lat** (Log kehadiran harian & telemetri kuliah) | **Diagram Area** (mode bertumpuk) | Di Bawah atau Tertanam dalam Tampilan Kalender |
| Daftar yang dibuat secara otomatis berisi taruna yang melewatkan 3 sesi berturut-turut (ditandai untuk tinjauan disipliner/administratif) | **SIMRS** (Ambang batas kepatuhan kehadiran per peraturan dinas militer) + **e-Lat** (Log ketidakhadiran berturut-turut) | **Tabel** dengan pemformatan warna kondisional (baris ditandai merah ketika ambang batas ketidakhadiran terlampaui) *(menggantikan Kartu Daftar Taruna yang Ditandai, yang merupakan komponen UI di luar cakupan grafik Superset)* | Panel Sidebar (Sisi Kanan Layar) |

---

## 12. Analitik Partisipasi

* **Data yang Dibutuhkan dari SIMRS:** Daftar resmi mata pelajaran taruna.
* **Data yang Dibutuhkan dari e-Lat:** Telemetri pemutar video (putar/jeda/gulung), jumlah posting papan diskusi, log unduhan file/materi, cap waktu tampilan halaman.

### Matriks Pemetaan Grafik & Tata Letak

| Data Spesifik yang Ditampilkan | Sumber Data (SIMRS / e-Lat) | Grafik / Visualisasi yang Digunakan | Penempatan Tata Letak |
| :--- | :--- | :--- | :--- |
| Persentase tonton video kuliah vs. skor kuis mingguan yang sesuai | **e-Lat** (Telemetri gulungan pemutar video & skor kuis mingguan) | **Overlay Diagram Area / Diagram Sebar** | Laci Detail Taruna / Tampilan Baris yang Diperluas |
| Partisipasi forum dan dinamika interaksi taruna | **e-Lat** (Jumlah posting/balasan papan diskusi & interaksi antar penulis) | **Peta Panas** (taruna di kedua sumbu, intensitas sel = jumlah balasan antar pasangan) *(menggantikan Network Graph yang tidak didukung secara native di Superset)* | Laci Ikhtisar Analitik |
| Tren keterlibatan taruna individual 7 hari | **e-Lat** (Log unduhan file, cap waktu tampilan halaman) | **Angka Besar dengan Garis Tren** (satu panel per taruna menampilkan tren 7 hari) *(menggantikan Inline Sparklines; Superset tidak dapat menyematkan sparkline di dalam baris tabel secara native)* | Panel grid tertanam per taruna di bagian Daftar Taruna |
| Daftar taruna & ringkasan keterlibatan | **SIMRS** (Daftar resmi taruna) + **e-Lat** (Metrik keterlibatan teragregasi) | **Tabel** (tata letak berbasis daftar) | Ruang Kerja Badan Utama |

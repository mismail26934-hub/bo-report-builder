# BO Report

Aplikasi web untuk filter dan bandingkan Back Order dari data **PSC** dan **SAP ZMMM Open BO**, gabungkan & urutkan Excel **PartViz**, serta menghitung harga per Material dari **SAP ZVSD Parts Progress Order Item**.

## Alur proses — PSC × SAP

### 1. Sumber data

Pilih salah satu mode:

| Mode          | Keterangan                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Folder server | Membaca semua `.xlsx` / `.xls` di `data-psc` & `data-sap-zmmm_open_bo`                                      |
| Upload        | Upload file → file lama dipindah ke `backup/<timestamp>/`, file baru disimpan ke folder data, lalu diproses |

### 2. Filter PSC — Sales Office

- Filter kolom `Sales_Office` (default: `0G38`, bisa diubah di UI)
- Hanya diterapkan pada data PSC
- Ambil unique `SO_Number` / `SO_NUMBER`

### 3. Exclude SAP — Material No (level baris)

- Buang baris SAP yang `Material No` ada di daftar exclude
- Default: `DELIVERY_CHARGE:ZZ`
- Bisa multiple, pisah koma atau titik koma (contoh: `DELIVERY_CHARGE:ZZ,OTHER_PART`)
- Hanya baris material yang dibuang; Sales document yang masih punya item lain tetap ikut
- Field boleh dikosongkan = tidak exclude apa pun

### 4. Filter SAP — Plant

- Filter kolom `Plant` (default: `1G38`, bisa diubah di UI)
- Bisa multiple, pisah koma / spasi / titik koma (contoh: `1G38,1383`)
- Hanya diterapkan pada data SAP
- Ambil unique `Sales document`

### 5. Exclude SO_Number — master Excel `data-so-exclude`

- Baca semua `.xlsx` / `.xls` di folder `data-so-exclude`
- Kolom: `SO_Number` (wajib), `PO`, `REMARK`
- CRUD dari UI menulis ke file `so_exclude.xlsx`
- SO yang ada di daftar dibuang dari unique PSC `SO_Number` **dan** unique SAP `Sales document` sebelum compare

### 6. Gabungkan & bandingkan

1. Gabungkan unique PSC `SO_Number` + unique SAP `Sales document`
2. Remove duplicate → daftar **combined** (gabungan unik)
3. Bandingkan set:
   - **matched** — ada di PSC dan SAP
   - **only_psc** — hanya di PSC
   - **only_sap** — hanya di SAP

### 7. Download hasil

Setiap proses **menimpa** file tetap di `output/` (hasil sebelumnya diganti):

| File                             | Isi                                              |
| -------------------------------- | ------------------------------------------------ |
| `compare.xlsx`                   | Sheet: **combined**, matched, only_psc, only_sap |
| `psc_so_unique.xlsx`             | Unique SO dari PSC                               |
| `sap_sales_document_unique.xlsx` | Unique Sales document dari SAP                   |

---

## Alur proses — PartViz

### 1. Sumber data

Pilih salah satu mode:

| Mode          | Keterangan                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| Folder server | Membaca semua `.xlsx` / `.xls` di `data-partviz`                           |
| Upload        | Upload → backup file lama, simpan file baru ke `data-partviz`, lalu proses |

### 2. Gabungkan & urutkan

1. Gabungkan semua baris dari file sumber (`pd.concat`)
2. Urutkan kolom `Milestone` dengan urutan:
   1. Cancelled
   2. Griefed
   3. ESD Needed
   4. Future Dated
   5. ESD Available
   6. Sourced
   7. Shipped
3. Milestone di luar daftar di atas diletakkan di akhir (urut abjad)

### 3. Download hasil

Setiap proses **menimpa** file tetap di `output/`:

| File                  | Isi                                                       |
| --------------------- | --------------------------------------------------------- |
| `partviz_merged.xlsx` | Semua baris PartViz, sudah digabung & diurutkan milestone |

---

## Alur proses — Order Item Price

### 1. Sumber data

| Mode          | Keterangan                                                                  |
| ------------- | --------------------------------------------------------------------------- |
| Folder server | Membaca semua `.xlsx` / `.xls` di `data-sap-zvsd_parts_progress-order_item` |
| Upload        | Upload → backup file lama, simpan file baru ke folder data, lalu proses     |

### 2. Gabungkan & hitung

1. Gabungkan semua baris dari file sumber.
2. Hitung kolom `Price per Material` untuk setiap order item:

   `(Parts Selling Price - ABS(Discount Total)) / Order Quantity`

3. Baris dengan nilai bukan angka atau `Order Quantity = 0` tidak dihitung dan dicatat sebagai baris tidak valid.

### 3. Download hasil

Setiap proses menimpa file tetap berikut:

| File                                 | Isi                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `order_item_price_per_material.xlsx` | Data Order Item lengkap dengan kolom `Source File` dan `Price per Material` |

---

## Alur proses — Parts Progress Source Item

### 1. Sumber data

| Mode          | Keterangan                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Folder server | Membaca multiple Excel di `data-sap-zvsd_parts_progress-source_item` dan `data-sap-zvsd_parts_progress` |
| Upload        | Upload → backup file lama di masing-masing folder, simpan file baru, lalu proses                        |

### 2. Filter & remove duplicate

1. Gabungkan semua file Source Item.
2. Exclude baris dengan `Order Quantity = OD Quantity` (keduanya harus angka valid).
3. Ambil kolom `Purchasing Document`.
4. Buang nilai kosong dan remove duplicate.
5. Filter baris dengan `Reason for rejection` kosong.
6. Ambil kolom `Material`, buang nilai kosong, lalu remove duplicate.
7. File Parts Progress dibaca dan divalidasi sebagai dataset pasangan; kolom `Purchasing Document` hanya tersedia di Source Item.

### 3. Download hasil

| File                              | Isi                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `purchasing_document_unique.xlsx` | Sheet `Purchasing Document` unik dan sheet `Material` unik dengan `Reason for rejection` kosong |

Setiap proses menimpa file hasil sebelumnya.

---

## Stack

- **Frontend:** React + Vite + TypeScript + TanStack Query
- **Backend:** FastAPI + pandas + openpyxl

## Struktur

```
bo-report/
├── backend/
├── frontend/
├── data-psc/
├── data-sap-zmmm_open_bo/
├── data-partviz/
├── data-sap-zvsd_parts_progress-order_item/
├── data-sap-zvsd_parts_progress-source_item/
├── data-sap-zvsd_parts_progress/
├── data-so-exclude/
├── data-estimasi/
├── data-bo-last/
├── data-sap-zmim_cpavail/
├── data-sap-zmmm_stock_info/
├── data-sap-zmmm_stock_info-hub/
├── data-sap-zmpu_po_moni/
├── guide-bo-report/
├── output/
└── docker-compose.yml
```

## Jalankan lokal (development)

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows Git Bash / Linux
source .venv/Scripts/activate   # atau: source .venv/bin/activate
pip install -r requirements.txt

# dari folder backend, project root = parent
uvicorn app.main:app --reload --port 8000
```

API docs: http://127.0.0.1:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

UI: http://127.0.0.1:5173  
Vite sudah mem-proxy `/api` ke backend.

## Jalankan online (Docker)

```bash
docker compose up --build -d
```

- Web: http://server-ip:8080
- API: http://server-ip:8000

Pastikan semua folder data yang tercantum pada struktur di atas berisi file Excel di server.

### Perilaku mode Upload

Untuk semua fitur proses (PSC×SAP, PartViz, Order Item, Source Item) dan **Upload Data Excel**:

1. File Excel lama di folder data terkait dipindah ke `backup/<YYYYMMDD_HHMMSS>/` di dalam folder yang sama
2. File yang diunggah disimpan ke folder data tersebut
3. Proses filter/gabung (jika ada) berjalan memakai data baru

---

## Alur — Upload Data Excel

Upload saja (belum ada transform) ke folder:

| Dataset                 | Folder                         |
| ----------------------- | ------------------------------ |
| Estimasi                | `data-estimasi`                |
| BO Last                 | `data-bo-last`                 |
| SAP ZMIM CPAvail        | `data-sap-zmim_cpavail`        |
| SAP ZMMM Stock Info     | `data-sap-zmmm_stock_info`     |
| SAP ZMMM Stock Info Hub | `data-sap-zmmm_stock_info-hub` |
| SAP ZMPU PO Moni        | `data-sap-zmpu_po_moni`        |

API: `POST /api/data-upload/{dataset_key}` dengan form field `files`.

---

## Alur — Generate BO Report (Guide)

1. Baca template `guide-bo-report/Guide BO Report.xlsx` (sheet **Guide** + **Data Template**).
2. Base baris dari semua Excel di `data-sap-zvsd_parts_progress-source_item`.
3. **Exclude** baris dengan `Order Quantity = OD Quantity`.
4. **Exclude** baris `Material No = DELIVERY_CHARGE:ZZ`.
5. **Exclude** baris dengan `Reason for rejection` tidak kosong (hanya baris blank yang diproses).
6. Isi kolom sesuai mapping Guide (copy dari folder / VLOOKUP / rumus `RIGHT`/`LEFT`), termasuk field tambahan OD / Gate Pass / Storage Location / Reason for rejection / OD Item of Sales Order Item / `1G38` / Action.
7. Format kolom tanggal ke `dd-mmm-yyyy` (contoh `14-Aug-2026`).
8. **Remove duplicate** baris yang sama (keep first) pada field:
   - `Sales document`
   - `Sales Document Item`
   - `Material No`
   - `Order Quantity`
   - `OD of Sales Order Item`
   - `OD Item of Sales Order Item`
   - `OD Quantity`
9. **Remove / exclude** baris jika `Order Quantity = Total OD Quantity` dalam group:
   - `Sales document`
   - `Sales Document Item`
   - `Material No`
   - `Order Quantity`
   - `Total OD Quantity` = `SUM(OD Quantity)` per group (contoh: Order Qty 2 dan total OD 2 → dihapus).
10. **Isi field Action** (Else-If first-match, urutan tetap):
   1. `BORD` + PO blank → `Review & Submit BO`
   2. `Order Quantity < Total OD Quantity` → `Cek Anomali (Possible double supply)`
      (contoh: Order Qty 2, total OD 4)
   3. `Milestone = Griefed` → `Griefed. Cek Antares EZ40`
   4. `Milestone = Cancelled` → `Cancelled. Cek Antares EZ40`
   5. `Milestone = ESD Needed` → `Uplift to CPRO or Emergency`
   6. Milestone blank + `PO Created Date = Today` (date-only) → `Wait Transmit to CAT`
   7. Milestone blank + `PO Created Date < Today` → `Failed Transmit to CAT and Cek Antares EZ40`
   8. `BORD` + PO terisi + `1G38 > Order Quantity` → `BO Fill From Stock`
   9. `BORD` + PO terisi + `1G38 > 0` → `BO Fill From Stock Partial`
   10. `DMDV` + PO blank + `1G38 > 0` → `ReBO to stock`
   11. `DMDV` + PO blank + `1S67/66/76/81 > 0` → `ReBO to 1Sxx`
   12. `BORD`/`DMDV` + PO blank + `Order Quantity <= 1S67/66/76/81` → `ReBO to 1Sxx`
   13. `BORD`/`DMDV` + PO terisi + `Order Quantity <= 1S67/66/76/81` → `Request STO from 1Sxx`
   14. Storage blank → `Cek & Create OD & F/u GI`
   15. `Class = ON-ORDER` → `Cek On-Order`
   16. `Class = ON-HAND` + hub `1S66/67/76/81 = 0` → `ReBO to CAT & Cek Availability Incountry`
   17. `Deletion indicator` tidak blank → `PO Possible Delete / BO Cancelled`
   18. Vendor `1000085` / CATERPILLAR ASIA DELIVERY CENTER + Milestone Shipped → `Keep Monitor`
   19. Agreement Type CPRO + Milestone Sourced + `Shp By Dt - TODAY = 27` (hari) → `Request Early Invoice`
   20. Milestone Sourced + `SNG > Order Quantity` → `Keep Monitor (Milestone Sourced)`
   21. Milestone Sourced + `SNG < Order Quantity` → `F/u invoice (Milestone Sourced)`
   22. Milestone ESD Available + `Order Quantity <= (SNG+Mell+QNS+SAG)` → `Fu/Keep Monitor`
   23. Class TRANSFER + Shipment Number terisi → `Keep Monitor (BO Incountry)`
   24. Class TRANSFER + Shipment Number blank → `F/u BR`
   25. Milestone Shipped → `Keep Monitor (Milestone Shipped)`
   26. Milestone ESD Available → `Keep Monitor (Milestone ESD Available)`
   27. Milestone blank + PO terisi → `Possible Failed Transmit to CAT and Cek Antares EZ40`
   28. Milestone Sourced + PO terisi → `F/u invoice (Milestone Sourced)`
   29. Else → kosong
   - Field `Deletion indicator` di-copy dari Source Item ke Data Template.
11. **Convert ke number** field:
   - `Total Price`, `Order Quantity`, `PO Quantity`
   - `SNG`, `Mell`, `QNS`, `SAG`, `ETA D`
   - `1S67`, `1S66`, `1S76`, `1S81`, `OD Quantity`, `1G38`
12. Sumber pendukung: Parts Progress, PO Moni, CPAvail, Stock Info, Stock Info Hub, Estimasi, BO Last, plus `output/partviz_merged.xlsx` dan `output/order_item_price_per_material.xlsx`.
13. Output: `output/bo_report.xlsx` (sheet Data Template terisi + sheet Guide).

API: `POST /api/bo-guide/process`

## Field UI

### PSC × SAP

| Field               | Default              | Keterangan                                     |
| ------------------- | -------------------- | ---------------------------------------------- |
| Sales Office (PSC)  | `0G38`               | Filter PSC                                     |
| Plant (SAP)         | `1G38`               | Filter SAP; multi value OK                     |
| Exclude part number | `DELIVERY_CHARGE:ZZ` | Exclude `Material No` SAP; multi value OK      |
| Exclude SO_Number   | Excel folder         | CRUD di UI → `data-so-exclude/so_exclude.xlsx` |
| Sumber data         | Folder server        | Folder atau upload Excel                       |

### PartViz

| Field            | Default       | Keterangan                                                                          |
| ---------------- | ------------- | ----------------------------------------------------------------------------------- |
| Sumber data      | Folder server | `data-partviz` atau upload multiple Excel                                           |
| Urutan Milestone | tetap         | Cancelled → Griefed → ESD Needed → Future Dated → ESD Available → Sourced → Shipped |

### Order Item Price

| Field       | Default       | Keterangan                                                           |
| ----------- | ------------- | -------------------------------------------------------------------- |
| Sumber data | Folder server | `data-sap-zvsd_parts_progress-order_item` atau upload multiple Excel |
| Rumus       | tetap         | `(Parts Selling Price - ABS(Discount Total)) / Order Quantity`       |

### Parts Progress Source Item

| Field       | Default       | Keterangan                                                               |
| ----------- | ------------- | ------------------------------------------------------------------------ |
| Sumber data | Folder server | Dua folder server atau upload multiple Excel untuk masing-masing dataset |
| Output      | tetap         | Unique `Purchasing Document` dan unique `Material` (rejection blank)     |

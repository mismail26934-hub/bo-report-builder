# BO Report

Aplikasi web untuk filter dan bandingkan Back Order dari data **PSC** dan **SAP ZMMM Open BO**, gabungkan & urutkan Excel **PartViz**, serta menghitung harga per Material dari **SAP ZVSD Parts Progress Order Item**.

## Alur proses — PSC × SAP

### 1. Sumber data

Pilih salah satu mode:

| Mode | Keterangan |
|------|------------|
| Folder server | Membaca semua `.xlsx` / `.xls` di `data-psc` & `data-sap-zmmm_open_bo` |
| Upload | User mengunggah file PSC & SAP dari browser |

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

### 5. Gabungkan & bandingkan

1. Gabungkan unique PSC `SO_Number` + unique SAP `Sales document`
2. Remove duplicate → daftar **combined** (gabungan unik)
3. Bandingkan set:
   - **matched** — ada di PSC dan SAP
   - **only_psc** — hanya di PSC
   - **only_sap** — hanya di SAP

### 6. Download hasil

Setiap proses **menimpa** file tetap di `output/` (hasil sebelumnya diganti):

| File | Isi |
|------|-----|
| `compare.xlsx` | Sheet: **combined**, matched, only_psc, only_sap |
| `psc_so_unique.xlsx` | Unique SO dari PSC |
| `sap_sales_document_unique.xlsx` | Unique Sales document dari SAP |

---

## Alur proses — PartViz

### 1. Sumber data

Pilih salah satu mode:

| Mode | Keterangan |
|------|------------|
| Folder server | Membaca semua `.xlsx` / `.xls` di `data-partviz` |
| Upload | User mengunggah multiple file PartViz dari browser |

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

| File | Isi |
|------|-----|
| `partviz_merged.xlsx` | Semua baris PartViz, sudah digabung & diurutkan milestone |

---

## Alur proses — Order Item Price

### 1. Sumber data

| Mode | Keterangan |
|------|------------|
| Folder server | Membaca semua `.xlsx` / `.xls` di `data-sap-zvsd_parts_progress-order_item` |
| Upload | User mengunggah multiple file Order Item dari browser |

### 2. Gabungkan & hitung

1. Gabungkan semua baris dari file sumber.
2. Hitung kolom `Price per Material` untuk setiap order item:

   `(Parts Selling Price - ABS(Discount Total)) / Order Quantity`

3. Baris dengan nilai bukan angka atau `Order Quantity = 0` tidak dihitung dan dicatat sebagai baris tidak valid.

### 3. Download hasil

Setiap proses menimpa file tetap berikut:

| File | Isi |
|------|-----|
| `order_item_price_per_material.xlsx` | Data Order Item lengkap dengan kolom `Source File` dan `Price per Material` |

---

## Alur proses — Parts Progress Source Item

### 1. Sumber data

| Mode | Keterangan |
|------|------------|
| Folder server | Membaca multiple Excel di `data-sap-zvsd_parts_progress-source_item` dan `data-sap-zvsd_parts_progress` |
| Upload | User mengunggah multiple file Source Item dan Parts Progress dari browser |

### 2. Filter & remove duplicate

1. Gabungkan semua file Source Item.
2. Ambil kolom `Purchasing Document`.
3. Buang nilai kosong dan remove duplicate.
4. File Parts Progress dibaca dan divalidasi sebagai dataset pasangan; kolom `Purchasing Document` hanya tersedia di Source Item.

### 3. Download hasil

| File | Isi |
|------|-----|
| `purchasing_document_unique.xlsx` | Daftar `Purchasing Document` unik dari Source Item |

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

## Field UI

### PSC × SAP

| Field | Default | Keterangan |
|------|---------|------------|
| Sales Office (PSC) | `0G38` | Filter PSC |
| Plant (SAP) | `1G38` | Filter SAP; multi value OK |
| Exclude part number | `DELIVERY_CHARGE:ZZ` | Exclude `Material No` SAP; multi value OK |
| Sumber data | Folder server | Folder atau upload Excel |

### PartViz

| Field | Default | Keterangan |
|------|---------|------------|
| Sumber data | Folder server | `data-partviz` atau upload multiple Excel |
| Urutan Milestone | tetap | Cancelled → Griefed → ESD Needed → Future Dated → ESD Available → Sourced → Shipped |

### Order Item Price

| Field | Default | Keterangan |
|------|---------|------------|
| Sumber data | Folder server | `data-sap-zvsd_parts_progress-order_item` atau upload multiple Excel |
| Rumus | tetap | `(Parts Selling Price - ABS(Discount Total)) / Order Quantity` |

### Parts Progress Source Item

| Field | Default | Keterangan |
|------|---------|------------|
| Sumber data | Folder server | Dua folder server atau upload multiple Excel untuk masing-masing dataset |
| Output | tetap | Unique `Purchasing Document` dari Source Item |

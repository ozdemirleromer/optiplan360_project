# OptiPlan360 Extended Modules Annex v1

## Purpose
This annex defines extended ERP-adjacent modules that are not part of the core Phase 1-4 flow, but are still within product scope.

## Included modules
- Cari Kartı
- Stok Kartı
- Sipariş Fişi
- Teklif Fişi
- Klasör Yönetimi
- Mikro write-back related field definitions

## Rules
- These modules do not override the core Phase 1-4 flow.
- They extend the surrounding operational UI and master data support.
- If a rule conflicts with the master spec, the master spec wins unless this annex is explicitly referenced for that module.

---

## Module 1: Cari Kartı (Customer/Account Card)

### 1.1 Purpose
Cari Kartı module provides full CRUD operations for customer/account master data management with Mikro ERP integration support.

### 1.2 Core Features

| Feature | Status | Description |
|---------|--------|-------------|
| **List View** | ✅ Implemented | Sortable, filterable customer list with search |
| **Card Creation** | ✅ Implemented | Create new customer with validation |
| **Card Editing** | ✅ Implemented | Edit existing customer data |
| **Card Archiving** | ✅ Implemented | Soft-delete/archive functionality |
| **Quick Search** | ✅ Implemented | Real-time search by name/code |
| **Form Validation** | ✅ Implemented | Client-side + server-side validation |
| **Mikro Sync** | 🔄 Planned | Bidirectional sync with Mikro ERP |

### 1.3 Data Model

#### 1.3.1 Core Fields
```typescript
interface CariKart {
  // Primary Key
  id: string;                    // UUID
  kod: string;                   // Cari Kod (unique)
  
  // Identity
  unvan: string;                 // Firma Ünvanı
  unvan2?: string;               // 2. Satır Ünvan
  tip: "A" | "B" | "C";         // A:Alıcı, B:Satıcı, C:Alıcı+Satıcı
  
  // Tax Information
  vkn?: string;                  // Vergi Kimlik No (10/11 chars)
  tcKimlikNo?: string;           // TC Kimlik No (11 chars)
  vergiDairesi?: string;         // Vergi Dairesi Adı
  
  // Contact
  telefon?: string;
  telefon2?: string;
  fax?: string;
  email?: string;
  web?: string;
  
  // Address
  adres?: string;
  il?: string;
  ilce?: string;
  ulke?: string;                 // TR default
  postaKodu?: string;
  
  // Financial
  paraBirimi: "TL" | "USD" | "EUR";
  riskLimiti?: number;
  vadeGunu?: number;             // Varsayılan vade
  
  // Grouping
  grupKod?: string;              // Cari Grup
  sektorKod?: string;            // Sektör Kodu
  bolgeKod?: string;             // Bölge Kodu
  temsilciKod?: string;          // Satış Temsilcisi
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  mikroCariKod?: string;         // Mikro ERP referansı
  isActive: boolean;
}
```

#### 1.3.2 Address Sub-entity (Çoklu Adres)
```typescript
interface CariAdres {
  id: string;
  cariId: string;
  adresTip: "fatura" | "teslimat" | "merkez";
  unvan?: string;
  adres: string;
  il: string;
  ilce: string;
  ulke: string;
  postaKodu?: string;
  telefon?: string;
  varsayilan: boolean;           // Default address flag
}
```

### 1.4 UI Specifications

#### 1.4.1 List View Layout
- **Filter Bar**: Search input + Filter dropdowns (Tip, Grup, Bölge)
- **Data Grid**: 
  - Kod | Ünvan | Tip | Telefon | Email | Grup | Actions
  - Sortable columns
  - Pagination (25/50/100 per page)
- **Bulk Actions**: Select all, export, delete
- **Create Button**: FAB or top-right primary button

#### 1.4.2 Card Form Layout (2-Column)
```
┌─────────────────────────────────────────────┐
│  Genel Bilgiler        │  İletişim          │
│  ├─ Kod*               │  ├─ Telefon        │
│  ├─ Ünvan*             │  ├─ Email          │
│  ├─ Ünvan 2            │  └─ Web            │
│  └─ Tip* (A/B/C)       │                    │
├────────────────────────┼────────────────────┤
│  Vergi Bilgileri       │  Finansal          │
│  ├─ VKN/TCKN           │  ├─ Para Birimi    │
│  └─ Vergi Dairesi      │  ├─ Risk Limiti    │
│                        │  └─ Vade Günü      │
├────────────────────────┴────────────────────┤
│  Adres Bilgileri (Tabs: Fatura/Teslimat)      │
└───────────────────────────────────────────────┘
```

### 1.5 Validation Rules

| Field | Rules | Error Message |
|-------|-------|---------------|
| kod | Required, unique, 3-20 chars | "Cari kodu zorunludur" |
| unvan | Required, 2-100 chars | "Ünvan zorunludur" |
| vkn | 10 chars (firma) or 11 chars | "Geçersiz VKN formatı" |
| tcKimlikNo | 11 digits, valid checksum | "Geçersiz TCKN" |
| email | Valid email format | "Geçersiz email" |
| riskLimiti | >= 0 | "Risk limiti negatif olamaz" |

### 1.6 Mikro ERP Integration

#### 1.6.1 Write-back Fields
When syncing to Mikro ERP, the following mapping applies:

| OptiPlan360 Field | Mikro ERP Field | Notes |
|-------------------|-----------------|-------|
| kod | CARI_KOD | Primary key match |
| unvan | CARI_UNVAN | |
| unvan2 | CARI_UNVAN2 | |
| vkn | VERGI_NO | |
| tcKimlikNo | TC_KIMLIK_NO | |
| vergiDairesi | VERGI_DAIRESI | |
| adres | ADRES | |
| il | IL | |
| ilce | ILCE | |
| telefon | TEL | |
| email | E_MAIL | |
| tip | CARI_TIP | 1=Alıcı, 2=Satıcı, 3=Alıcı+Satıcı |

#### 1.6.2 Sync Rules
- **Create**: Push to Mikro on approval
- **Update**: Bidirectional sync (last-write-wins with conflict prompt)
- **Delete**: Soft-delete in OptiPlan, archive in Mikro

### 1.7 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/cari | List with pagination/filter |
| POST | /api/v1/cari | Create new card |
| GET | /api/v1/cari/:id | Get single card |
| PUT | /api/v1/cari/:id | Update card |
| DELETE | /api/v1/cari/:id | Archive card |
| GET | /api/v1/cari/:id/adres | List addresses |
| POST | /api/v1/cari/:id/adres | Add address |

### 1.8 Future Enhancements (Backlog)

| Priority | Feature | Description |
|----------|---------|-------------|
| P1 | Bakiye Görüntüleme | Real-time Mikro balance fetch |
| P2 | Hareket Listesi | Transaction history integration |
| P3 | Risk Yönetimi | Credit limit alerts |
| P4 | Çoklu Şube | Multi-branch support |
| P5 | Cari Grup Yönetimi | Group CRUD operations |

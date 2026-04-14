# OptiPlan Workflow Endpoint Parity Matrisi

Bu dokuman, workflow endpointlerinde alias policy (`snake_case` + `camelCase`) ve ornek kapsaminin endpoint bazli parity durumunu tek tabloda izler.

## Kapsam

- [API] `folder-settings`, `phase2`, `phase3`, `export/preview`, `export`, `error`
- [API] Request model alias destegi
- [API] OpenAPI request/response example parity durumu
- [EKLENMESI-GEREKLI] Yeni endpoint eklendiginde bu tablo ayni iterasyonda guncellenmelidir

## Endpoint Parity Tablosu

| Endpoint | Method | Request Model | Alias Desteği | Snake Example | Camel Example | Response Example | Durum |
|---|---|---|---|---|---|---|---|
| `/optiplan-workflow/folder-settings` | `PUT` | `FolderSettingsIn` | Evet | Evet (`WorkflowFolderSettingsSnakeCaseRequest`) | Evet (`WorkflowFolderSettingsCamelCaseRequest`) | N/A | TAM |
| `/optiplan-workflow/records/{kayit_uuid}/phase2` | `PUT` | `Phase2UpdateIn` | Evet | Evet (`WorkflowPhase2SnakeCaseRequest`) | Evet (`WorkflowPhase2CamelCaseRequest`) | `WorkflowGenericRecordResponse` | TAM |
| `/optiplan-workflow/records/{kayit_uuid}/phase3` | `PUT` | `Phase3UpdateIn` | Evet | Evet (`WorkflowPhase3SnakeCaseRequest`) | Evet (`WorkflowPhase3CamelCaseRequest`) | `WorkflowGenericRecordResponse` | TAM |
| `/optiplan-workflow/records/{kayit_uuid}/export/preview` | `POST` | `ExportRequestIn` | Evet | Evet (`WorkflowExportSnakeCaseRequest`) | Evet (`WorkflowExportCamelCaseRequest`) | `WorkflowExportPreviewResponse` | TAM |
| `/optiplan-workflow/records/{kayit_uuid}/export` | `POST` | `ExportRequestIn` | Evet | Evet (`WorkflowExportSnakeCaseRequest`) | Evet (`WorkflowExportCamelCaseRequest`) | `WorkflowExportRecordResponse` | TAM |
| `/optiplan-workflow/records/{kayit_uuid}/error` | `POST` | `ErrorRequestIn` | Evet | Evet (`WorkflowErrorSnakeCaseRequest`) | Evet (`WorkflowErrorCamelCaseRequest`) | Evet (`WorkflowPhaseErrorResponse`) | TAM |

## Kontrol Listesi

- [API] Tablodaki tum endpointler icin request model alias parse testleri mevcut.
- [API] OpenAPI tarafinda ornekler `components/examples` altinda merkezi olarak tutulur.
- [EKLENMESI-GEREKLI] Endpoint eklendiginde `TAM` olmadan release cikilmaz.

## Bagli Dokumanlar

- `docs/openapi.yaml`
- `docs/API_CONTRACT.md`
- `docs/optiplanning/OPTIPLAN_WORKFLOW_ALIAS_SOZLESMESI.md`

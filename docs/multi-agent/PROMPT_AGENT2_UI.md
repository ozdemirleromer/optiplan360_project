# Prompt Agent-2 UI

Tarih: 2026-03-03
Durum: Reconstructed working prompt

Sen Agent-2'sin. Gorev alani `frontend/*`, gerekli oldugunda `apps/admin-ui/*` ve `docs/A11Y_CHECKLIST.md`.

## Hedefler

1. Emoji kullanimini kaldir.
2. `lucide-react` + ortak icon wrapper standardini uygula.
3. WCAG 2.1 AA baseline kurallarini uygula.
4. UI business status gorunumunu canonical teknik state ile uyumlu tut.

## Zorunlu Kurallar

- Modal: `aria-modal`, ESC, focus trap
- Form: `label`/`htmlFor`, `id`, `aria-describedby`, `aria-invalid`
- Touch target: minimum 44x44
- Aksiyon ve navigasyon ikonlari emoji olmayacak
- Ortak bilesenleri tekrar kullan, yeni daginik pattern olusturma

## Tamamlanmis Cekirdek Scope

- Shared component A11Y baseline
- Lucide icon gecisi
- Form etiketleme ve touch target duzeltmeleri

## Acik Scope

- Full A11Y regression audit
- State map consistency final check
- Admin UI tarafinda kalan icon/genel dil kapanislari

## Kanit Dosyalari

- `docs/multi-agent/AGENT2_A11Y_PHASE_REPORT.md`
- `docs/multi-agent/TODO_AGENT2_UI_V1.md`
- `docs/multi-agent/agent2_status.md`

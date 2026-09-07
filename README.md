# 🛠️ FachOferta - Mobilny Generator Wycen i Kosztorysów dla Fachowców

**FachOferta** to aplikacja mobilna typu Micro-SaaS dedykowana dla wykonawców, stolarzy, instalatorów i projektantów. Pozwala na błyskawiczne tworzenie wycen na miejscu u klienta, pobranie e-podpisu i wysyłkę gotowego dokumentu PDF w kilka minut.

---

## 🚀 Główne Funkcje (MVP)

- 📋 **Szybki Cennik:** Baza własnych usług i materiałów w telefonie.
- ✍️ **E-Podpis:** Możliwość złożenia podpisu przez klienta na ekranie telefonu.
- 📄 **Generowanie PDF:** Elegancki, profesjonalny kosztorys wygenerowany w parę sekund.
- 📱 **Wysyłka WhatsApp / SMS:** Udostępnianie oferty bezpośrednio w preferowanym kanale klienta.
- 🔌 **Praca Offline:** Działanie aplikacji nawet na budowach bez zasięgu LTE.

---

## 📐 Architektura i Stack Techniczny

- **Frontend Mobilny:** React Native (Expo) / TypeScript
- **Backend & Baza Danych:** Supabase (PostgreSQL, Auth, Storage)
- **Generowanie PDF:** HTML/CSS Template -> PDF Renderer
- **Monetyzacja:** RevenueCat (Subskrypcje in-app)

---

## 📁 Struktura Projektu
├── docs/               # Dokumentacja specyfikacji i schematy bazy danych
├── mobile/             # Aplikacja mobilna (React Native Expo)
├── supabase/           # Migracje SQL i funkcje brzegowe (Edge Functions)
└── README.md
---

## 🚦 Roadmapa Rozwoju

- [x] Etap 1: Dokumentacja i architektura projektu
- [ ] Etap 2: Schemat bazy danych SQL w Supabase
- [ ] Etap 3: Szablon HTML/CSS kosztorysu PDF
- [ ] Etap 4: Aplikacja mobilna (Ekran wyceny i Podpis)
- [ ] Etap 5: Eksport PDF i integracja WhatsApp
- [ ] Etap 6: Subskrypcje B2B i publikacja w App Store / Google Play

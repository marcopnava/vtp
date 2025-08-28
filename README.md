# VTP — Copy Trading Platform (MVP)

Tema: **shadcn/ui** (palette grigi/blu).  
Obiettivo: apertura ordini **proporzionata** su ~45 conti (Key to Markets), con logica simile a Social Trader Tools.  
Stack: **Next.js (app dir) + shadcn/ui** (frontend) • **FastAPI** (backend) • (in roadmap) **EA MT4** su Windows (Hetzner) per esecuzione LIVE.

---

## Indice

- Architettura
- Struttura del repository
- Setup locale
- Avvio servizi
- Pagine UI & flusso
- API (FastAPI)
  - /health
  - /sizing/calc
  - /copy/preview
- Algoritmi & regole
- COT Data & Output AI
- Ambiente/porte
- Sicurezza
- Troubleshooting
- Roadmap verso LIVE su MT4
- Comandi Git rapidi
- Licenza

---

## Architettura

**Frontend (apps/web)**  
- Next.js (app dir) con shadcn/ui.  
- Top bar: badge porta API, toggle **Tool ON/OFF** (persistito in `localStorage`).  
- Pagine operative: **Output AI → Calculator / Orders → Live Session**.  
- Pagine dati: **Data → COT** (schede Disaggregated/Financial), **COT Filter** (parser semplice).

**Backend (apps/api)**  
- FastAPI con endpoint:
  - `GET /health` → check
  - `POST /sizing/calc` → calcolo lottaggio
  - `POST /copy/preview` → calcolo lotti follower (proporzione, fixed, lot/10k), rounding/limiti  
- In roadmap: `POST /copy/execute` (**DRY_RUN** e poi **LIVE**) + audit log.

**Execution Layer (roadmap)**  
- EA MQL4 per MT4 (Windows Hetzner). Bridge REST/WebSocket per ricevere comandi ed eseguire `OrderSend/Modify/Close`.  
- **Safety Guard**: ON (solo DRY RUN) / OFF (LIVE).

---

## Struttura del repository

    vtp/
    ├─ apps/
    │  ├─ api/
    │  │  └─ vtp_api/
    │  │     ├─ __init__.py
    │  │     ├─ main.py           # crea app FastAPI, include router, (CORS opz.)
    │  │     ├─ routers.py        # /health, /sizing/calc, /copy/preview
    │  │     ├─ schemas.py        # Pydantic models (Instrument, Orders, Followers...)
    │  │     ├─ models.py         # (placeholder, eventuale db in futuro)
    │  │     ├─ sizing.py         # (eventuali funzioni ausiliarie)
    │  │     └─ utils/            # (placeholder)
    │  └─ web/
    │     ├─ src/
    │     │  ├─ app/
    │     │  │  ├─ output-ai/page.tsx
    │     │  │  ├─ sizing-calculator/page.tsx
    │     │  │  ├─ orders/page.tsx
    │     │  │  ├─ live-session/page.tsx
    │     │  │  ├─ cot-filter/page.tsx
    │     │  │  └─ data/cot/page.tsx   # Tabs: Disaggregated / Financial
    │     │  ├─ components/top-bar.tsx
    │     │  └─ lib/
    │     │     ├─ tool.ts        # hook client per Tool ON/OFF (localStorage)
    │     │     ├─ symbols.ts     # elenco strumenti (35)
    │     │     ├─ aliases.ts     # alias → simbolo canonico
    │     │     └─ cot.ts         # parser COT (stance + evidenze)
    │     ├─ public/ ...
    │     ├─ package.json
    │     └─ .env.local (non in git)
    ├─ docker-compose.yml          # (placeholder)
    ├─ requirements.txt            # FastAPI, uvicorn, pydantic
    └─ README.md                   # questo file

---

## Setup locale

**Requisiti**
- Node.js (>= 18) + npm
- Python 3.11+ (consigliato) + venv

**Frontend**

    cd apps/web
    npm install
    # se mancano componenti shadcn:
    npx shadcn@latest init -y
    npx shadcn@latest add switch select button card input label radio-group tabs textarea badge

**Backend**

    cd apps/api
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r ../../requirements.txt

`requirements.txt` deve includere: `fastapi`, `uvicorn[standard]`, `pydantic`.

---

## Avvio servizi

**Backend** (default 8000)

    cd /Users/marconava/Desktop/vtp
    uvicorn vtp_api.main:app --reload --app-dir apps/api
    # Se 8000 occupata:
    # uvicorn vtp_api.main:app --reload --app-dir apps/api --port 8100

**Frontend** (Next dev su 3000)

    cd /Users/marconava/Desktop/vtp/apps/web
    # Imposta la porta API corretta:
    printf "NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000\n" > .env.local
    npm run dev

**Check rapido porte**

    curl -s http://127.0.0.1:8000/health || echo "NO API on 8000"
    curl -s http://127.0.0.1:8100/health || echo "NO API on 8100"

---

## Pagine UI & flusso

- **Top bar**
  - API badge: URL dell’API in uso (da `.env.local`).
  - Tool ON/OFF: switch globale (persistito). Alcune azioni disabilitate se OFF.

- **Data → COT** (`/data/cot`)
  - Schede: **Disaggregated** e **Financial**.
  - Incolla testo COT grezzo → parser filtra i 35 strumenti → mostra **stance** (bullish/bearish/neutral) + **evidence lines**.
  - Export JSON per scheda ed **export combinato** (salvato in `localStorage` come `vtp_cot_parsed`).

- **Output AI** (`/output-ai`)
  - Incolla 10 trade (formato rigido).
  - Parser: side (Long/Short), symbol (dalle parentesi), Entry/SL/TP1.
  - Badge **COT stance** per simbolo (se presente `vtp_cot_parsed`).
  - “Usa questo” → salva in `localStorage` `vtp_parsed_order`.

- **Sizing Calculator** (`/sizing-calculator`)
  - Select simboli + parametri (tick size/value, lot step/min/max).
  - Stop distance calcolata da Entry/SL (se presenti da Output AI).
  - Chiama `POST /sizing/calc`.

- **Orders** (`/orders`)
  - Precompila symbol/side/SL/TP da `vtp_parsed_order`.
  - Editor Followers JSON con regole:
    - `proportional` (base: balance/equity, multiplier)
    - `fixed` (lots)
    - `lot_per_10k` (base, lots_per_unit, unit)
  - **Preview Copy** → `POST /copy/preview` → tabella raw/rounded + warnings.

- **Live Session** (`/live-session`)
  - Ping API, toggle Tool, **Safety Guard** (ON = DRY RUN).
  - (Roadmap) Execute DRY_RUN e poi LIVE.

---

## API (FastAPI)

**GET /health**

    {"ok": true}

**POST /sizing/calc (body esempio)**

    {
      "risk_mode": "fixed",
      "risk_value": 200,
      "balance": 10000,
      "equity": 10000,
      "stop_distance": 0.0020,
      "slippage": 0.0002,
      "instrument": {
        "symbol": "EURUSD",
        "tick_size": 0.0001,
        "tick_value": 10,
        "min_lot": 0.01,
        "lot_step": 0.01,
        "max_lot": 50
      }
    }

**Response (esempio)**

    {
      "suggested_lots": 0.90909091,
      "rounded_to_step": 0.9,
      "per_lot_risk": 220.0,
      "risk_at_suggested": 198.0,
      "warnings": []
    }

**POST /copy/preview (body esempio)**

    {
      "instrument": {
        "symbol":"EURUSD","tick_size":0.0001,"tick_value":10,
        "min_lot":0.01,"lot_step":0.01,"max_lot":50
      },
      "master_info": { "balance":10000, "equity":10000 },
      "master_order": { "symbol":"EURUSD","side":"buy","lot":1.0 },
      "followers": [
        {
          "id":"acc-10k","name":"A","balance":10000,"equity":10000,"enabled":true,
          "rule":{"type":"proportional","base":"equity","multiplier":1.0}
        },
        {
          "id":"acc-20k","name":"B","balance":20000,"equity":20000,"enabled":true,
          "rule":{"type":"proportional","base":"equity","multiplier":1.0}
        },
        {
          "id":"acc-fixed","name":"C","balance":5000,"equity":5000,"enabled":true,
          "rule":{"type":"fixed","lots":0.10}
        }
      ]
    }

**Response (esempio)**

    {
      "symbol": "EURUSD",
      "side": "buy",
      "master_lot": 1.0,
      "total_followers": 3,
      "total_lots_raw": 3.1,
      "total_lots_rounded": 3.1,
      "previews": [
        {"follower_id":"acc-10k","follower_name":"A","raw_lot":1.0,"rounded_lot":1.0,"warnings":[]},
        {"follower_id":"acc-20k","follower_name":"B","raw_lot":2.0,"rounded_lot":2.0,"warnings":[]},
        {"follower_id":"acc-fixed","follower_name":"C","raw_lot":0.1,"rounded_lot":0.1,"warnings":[]}
      ]
    }

---

## Algoritmi & regole

**Sizing**
- `budget_risk`:
  - `fixed`: `risk_value` in €
  - `percent_balance`: `balance * (risk_value/100)`
  - `percent_equity`: `equity * (risk_value/100)`
- `per_lot_risk = ((stop_distance + slippage) / tick_size) * tick_value`
- `suggested_lots = budget_risk / per_lot_risk`
- `rounded_to_step = floor(suggested_lots / lot_step) * lot_step`
- Limiti: `min_lot`, `max_lot` (warning se applicati)

**Copy preview**
- Regole follower:
  - `proportional`: `master_lot * (follower_base / master_base) * multiplier`
  - `fixed`: `lots`
  - `lot_per_10k`: `(base_value / unit) * lots_per_unit` (default unit = 10k)
- Rounding: `floor(raw / lot_step) * lot_step` (clamp tra min/max)
- Output: raw/rounded per follower + sommarî.

---

## COT Data & Output AI

- **Data → COT**: incolla testo “Disaggregated”/“Financial”. Parser assegna **stance** e “evidence lines” per i simboli del tuo universo (35).  
  Export:
  - `cot_disaggregated.json`, `cot_financial.json`
  - `cot_combined.json` (salvato anche localmente in `localStorage` come `vtp_cot_parsed`)

- **Output AI**: incolla i 10 trade → parser estrae campi → badge **COT** se presente `vtp_cot_parsed`.  
  “Usa questo” salva in `localStorage` `vtp_parsed_order` per prefill Calculator/Orders.

**LocalStorage keys**
- `vtp_cot_disagg_raw`, `vtp_cot_fin_raw`
- `vtp_cot_disagg_parsed`, `vtp_cot_fin_parsed`, `vtp_cot_parsed`
- `vtp_output_ai`, `vtp_parsed_order`, `vtp_tool_enabled`

---

## Ambiente/porte

- **API**: 8000 (o 8100)
- **Frontend**: 3000

**.env.local (frontend)**

    NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000

**Cambio porta API**

    uvicorn vtp_api.main:app --reload --app-dir apps/api --port 8100
    # poi aggiorna apps/web/.env.local e riavvia npm run dev

**CORS (se necessario in main.py)**

    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000","http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

---

## Sicurezza

- LIVE trading solo quando:
  - Token/firma tra Backend ↔ EA MQL4, IP whitelisting, rate limit.
  - Safety Guard chiaro in UI.
  - Audit log dettagliato.
- Mai committare credenziali reali dei conti.

---

## Troubleshooting

- **Orders timeout / Load Failed** → API off o porta errata. Verifica `GET /health` e `.env.local`.
- **Next “useEffect only in Client”** → aggiungi `"use client"` nei file con hook o usa component client.
- **Port already in use** → `lsof -i :8000` e kill del processo.
- **COT non appare in Output AI** → fai Export combinato in **Data → COT** (salva anche `vtp_cot_parsed`).

---

## Roadmap verso LIVE su MT4

1. `/copy/execute` (DRY_RUN) → genera `execution_plan` identico al LIVE, senza invio a MT4.  
2. EA MQL4 (Windows Hetzner): MT4 portable mode (una istanza per account), mapping simboli, ECN (SL/TP post-fill), retry/freeze/slippage/logging.  
3. LIVE: rollout graduale (1–2 conti micro → 45 conti → fino a 100 clienti), monitoring & alert.

---

## Comandi Git rapidi

    git status
    git add .
    git commit -m "docs: update README and sync project state"
    git push

---

## Licenza

MVP interno per V.I.T.A. world. Tutti i diritti riservati.

# Deploy do PIJA na VM do HC — banco por transferência direta

> **Contexto:** o banco (`pija_demo.db`) tem jornada real de pacientes e o repositório GitHub é **público**,
> então o `.db` **não** vai pro GitHub. Ele é entregue por **transferência direta** para a VM do HC (que está
> dentro da rede do HC). Decisão registrada em [superpowers/plans/2026-07-24-entrega-banco-hc.md](superpowers/plans/2026-07-24-entrega-banco-hc.md).

---

## 1. Arquivo entregue

| Item | Valor |
|---|---|
| Arquivo (comprimido, recomendado) | `pija_demo.db.gz` — **~67 MB** |
| SHA256 (`.gz`) | `50190f08ab29ba5e0dd55a0bb2133f7dfbbba95ec392527d391cc531dea3e991` |
| Arquivo descomprimido | `pija_demo.db` — ~517 MB (SQLite) |
| SHA256 (descomprimido) | `20fd48da4eff3bdc3b6f8acde43fc8db04170cf586507803db2ffa98362573c2` |

> O `.gz` (67 MB) é o que transferir — cabe em qualquer canal. Note que 67 MB ficaria até abaixo do limite de
> 100 MB do GitHub, mas **mesmo assim não vai pro repo**: contém dado real de paciente e o repositório é público.

**Como entregar** (qualquer canal privado — nunca GitHub público):
- `scp ./pija_demo.db.gz usuario@<vm>:/opt/pija/data/` (ou `rsync -avz`), **ou**
- drive/compartilhamento interno do HC, **ou**
- pendrive/cópia local na própria VM.

**Conferir integridade na VM** (após descomprimir):
```bash
gunzip pija_demo.db.gz          # se recebeu comprimido
sha256sum pija_demo.db          # deve bater com o SHA256 acima
```

---

## 2. Onde o backend espera o banco

O backend lê o caminho do banco da variável de ambiente **`SQLITE_PATH`**. Coloque o `.db` num diretório da VM
(ex.: `/opt/pija/data/pija_demo.db`) e aponte `SQLITE_PATH` pra ele.

## 3. Variáveis de ambiente do backend

| Variável | Exemplo / valor | Observação |
|---|---|---|
| `SQLITE_PATH` | `/opt/pija/data/pija_demo.db` | caminho do banco entregue |
| `JWT_SECRET` | *(gerar; ≥ 32 chars)* | **segredo — não versionar**; ex.: `openssl rand -hex 32` |
| `CORS_ORIGINS` | `https://<frontend-do-hc>` | origem(ns) do frontend, separadas por vírgula |
| `RESOURCE_MODE` | `csv` | padrão (lê o SQLite local). `aghu` só na Fase 5 |

## 4. Subir o backend

Python 3.11+. Da pasta `backend/`:
```bash
python -m venv venv && . venv/bin/activate      # (Linux)
pip install -r requirements.txt                 # ou o gerenciador do projeto
SQLITE_PATH=/opt/pija/data/pija_demo.db \
JWT_SECRET=<segredo> \
CORS_ORIGINS=https://<frontend-do-hc> \
uvicorn pija.main:app --app-dir src --host 0.0.0.0 --port 8000
```
Healthcheck: `GET /health` → `{"status":"ok",...}`. A API é **somente leitura** (não escreve no AGHU).

> Os arquivos de containerização (Dockerfile/compose) ficam a cargo do HC, conforme combinado — este guia
> descreve o contrato (banco + env vars) que esses arquivos precisam satisfazer.

## 5. Frontend

O frontend (Vue/Vite) é estático e hoje roda no Vercel (`pija-alpha.vercel.app`). Se o HC for hospedar internamente,
basta buildar (`npm run build` em `frontend/`) e servir o `dist/`, com as envs de build:
- `VITE_API_BASE_URL=https://<backend-do-hc>`
- `VITE_USE_MOCK=false`

## 6. Alternativa: gerar o banco na própria VM (sem transferir o `.db`)

Como a VM alcança o AGHU e roda o ETL, o HC pode **regenerar** o banco a partir dos CSVs (entregues por canal
privado) rodando, em `backend/`:
```bash
python -m pija.etl.runner        # lê CSV_DIR -> grava em SQLITE_PATH
```
Esse é também o caminho natural pra **Fase 5** (ETL direto do PostgreSQL do AGHU) — ver
[superpowers/plans/2026-07-24-aghu-integracao-referencia.md](superpowers/plans/2026-07-24-aghu-integracao-referencia.md).

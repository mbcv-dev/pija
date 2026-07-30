# Decisão — como entregar o banco pro HC no deploy

> **Data:** 2026-07-24. Resolve a pendência aberta no handoff pós-reunião
> ([2026-07-24-handoff-pos-reuniao-hc.md](2026-07-24-handoff-pos-reuniao-hc.md) §2 e §6).
> **Contexto:** o HC provisiona uma VM na rede deles e faz o deploy da versão que estiver no nosso GitHub.
> O nosso SQLite é **gitignored** — então o banco (ou o insumo pra gerá-lo) precisa chegar à VM **fora do git**.

---

> **ATUALIZAÇÃO (2026-07-28) — decisão final: transferência direta pra VM.** Confirmou-se que o repositório
> `mbcv-dev/pija` é **PÚBLICO**; portanto o banco (jornada real de pacientes) **não** vai pro GitHub (nem como
> release/LFS — seria exposição pública de dado de saúde, risco LGPD, irreversível). O `.db` é entregue por
> **canal privado direto pra VM** (que está dentro da rede do HC). Comprimido: **67 MB** (`.gz`). Instruções
> completas de deploy em **[../../DEPLOY-HC.md](../../DEPLOY-HC.md)**.

## 0. Restrição que enquadra tudo

Qualquer que seja o caminho, **algo grande viaja fora do git**:

| Artefato | Tamanho | Versionado? |
|---|---|---|
| `backend/data/pija_demo.db` (usado no demo/deploy atual) | ~516 MB | Não (gitignored) |
| `backend/data/pija.db` (full) | ~1,4 GB | Não (gitignored) |
| CSVs em `CSV-aghu/` (5 arquivos) | ~685 MB | Não (gitignored) |

Git puro não comporta esses tamanhos (limite prático ~100 MB/arquivo sem LFS). Logo a discussão **não é "git vs. fora do git"** — é **qual artefato** mandamos fora do git.

---

## 1. Opções

### Opção A — mandar o `.db` pronto (RECOMENDADA)
Entregar o `pija_demo.db` (~516 MB) já gerado, para o HC colocar na VM (o backend aponta pra ele via `SQLITE_PATH`).

- ✅ **Idêntico ao que está no ar** — zero surpresa no dia da apresentação.
- ✅ **Sem dependência de runtime de ETL na VM** (não precisa Python/deps/CSV lá pra subir o sistema).
- ✅ Caminho mais curto e com menor superfície de falha para o **requisito do dia** (banca usar o sistema ao vivo).
- ⚠️ Não é reproduzível pelo HC sozinho; se os dados mudarem, re-geramos e reenviamos.
- ⚠️ Blob binário de 516 MB — transferir por canal fora do git (drive interno do HC, `scp`/rsync na VM, etc.).

### Opção B — mandar CSVs + rodar o ETL na VM
Entregar os 5 CSVs (~685 MB) + instruções; o HC roda `python -m pija.etl.runner` na VM pra gerar o SQLite.

- ✅ **Reproduzível** e alinhado com o caminho futuro (o ETL contra o AGHU vai rodar na VM de qualquer jeito — Fase 5).
- ⚠️ Exige ambiente Python + deps na VM **antes** de o sistema subir → mais passos, mais superfície de falha.
- ⚠️ CSVs (685 MB) são **maiores** que o `.db` demo (516 MB) — não economiza transferência.
- ⚠️ Se o ETL falhar na VM no dia, trava a demo.

---

## 2. Decisão

**Primário: Opção A** — entregar o `pija_demo.db` pronto. É o menor artefato que **garante** a paridade com o
sistema já validado no ar e não acopla a apresentação ao sucesso do ETL na VM.

**Documentar como fallback/reprodução: Opção B** — deixar registrado o comando de ETL
(`cd backend && python -m pija.etl.runner`, com `CSV_DIR` apontando pros CSVs e `SQLITE_PATH` pro destino) para
que o HC consiga **regenerar** o banco a partir dos CSVs quando quiser (e como ponte natural pro ETL da Fase 5).

> Racional: o requisito do dia (§5 do handoff) é a banca **usar o sistema ao vivo**. A Opção A minimiza o que
> pode dar errado nesse momento. A Opção B é valiosa como reprodutibilidade e como ensaio do fluxo de ETL que
> a Fase 5 vai usar na própria VM — por isso fica documentada, não descartada.

## 3. Ações concretas

- [ ] Combinar com o HC o **canal de transferência** do arquivo grande (drive interno / `scp` na VM). — depende do HC
- [ ] Enviar `pija_demo.db` (~516 MB) e registrar onde ficou / como referenciá-lo (`SQLITE_PATH`).
- [ ] Incluir no README de deploy pro HC o **passo de ETL** (Opção B) como caminho de regeneração.
- [ ] (Fase 5) Substituir esse fluxo pelo ETL `AghuResource` (PostgreSQL) rodando na própria VM — ver
      [2026-07-24-aghu-integracao-referencia.md](2026-07-24-aghu-integracao-referencia.md).

> **Nota:** decisão tomada com base no que minimiza risco no dia. Se o HC preferir só CSVs (ex.: por política
> de não receber binários), viramos pra Opção B — a troca é barata e já está documentada acima.

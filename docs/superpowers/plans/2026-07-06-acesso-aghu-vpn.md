# Acesso ao AGHU via VPN do HC — o que a VPN resolve (e o que não)

> **Data:** 2026-07-06. Origem: dois POPs de VPN do HC-UFPE/EBSERH em `docs/`
> (`Procedimento MFA - VPN .pdf` e `POP - Configuração Client Fortigate - MFA 3_0.pdf`).
> **Contexto:** destrava a Fase 5 (integração AGHU real). Registrado por ser decisão/achado de arquitetura.

---

## 1. O que os POPs estabelecem

Conexão à rede interna via **FortiClient VPN + MFA** (Microsoft Authenticator, push/SMS/ligação).

| Alvo | Gateway | Porta | SSO/SAML |
|---|---|---|---|
| **HC-UFPE** (é este que alcança o AGHU) | `vpn-hcufpe.ebserh.gov.br` | **4343** | SSO + navegador externo (SAML) |
| EBSERH genérico | `vpn.ebserh.gov.br` | 443 | SSO |

Setup: instalar FortiClient VPN → configurar conexão (gateway/porta acima, marcar *Enable SSO for VPN Tunnel*)
→ instalar/registrar Microsoft Authenticator com a conta `@ebserh.gov.br` → conectar e aprovar o MFA.

## 2. O que isso REALMENTE desbloqueia

- ✅ **Desenvolvimento:** de uma **máquina de dev** conectada à VPN, é possível alcançar a rede onde
  vive o AGHU (Oracle) e construir/validar o `AghuResource` contra o banco **real**.

## 3. O que a VPN NÃO resolve (gap em aberto)

- ❌ **Runtime em produção.** A VPN é um **cliente de desktop com MFA interativo por usuário**.
  O backend deployado (Railway) **não** roda FortiClient nem aprova push de MFA. Portanto, o
  "AGHU em produção" **não** é resolvido por esse procedimento.
- **Decisão pendente com o HC** (novo item de caminho crítico) — opções:
  1. Runner/serviço **on-premise** dentro da rede do HC;
  2. **VPN site-to-site** + **service account** (sem MFA interativo);
  3. Manter **extração read-only** periódica (o modelo atual do MVP, com `CsvResource`).

## 4. Credenciais e acesso ao banco

- ✅ **Credencial de banco read-only do AGHU — JÁ TEMOS** (confirmado pelo usuário em 2026-07-06).
- Confirmar/registrar o **host / porta / service-name** do Oracle para o DSN do `python-oracledb`
  (guardar em `.env`, nunca no código — ver guardrails do SPEC).
- Confirmar que as `vw_*` estão acessíveis a esse usuário.
- **Guardar as credenciais só em `.env`** (fora do git).

## 5. Próximas etapas

1. **Spike de conexão (~1 dia):** de máquina na VPN, `SELECT` trivial nas `vw_*` reais com
   `python-oracledb` (read-only). Credencial já disponível (§4); falta só host/porta/service-name.
2. **Validar schema:** nomes/tipos reais das views × mapeamento em [DADOS-ESTADO.md](../../DADOS-ESTADO.md).
3. **Construir `AghuResource`** (dev) atrás de `RESOURCE_MODE=aghu`, com paridade de contrato com `CsvResource`.
4. **Fechar o runtime de produção com o HC** (§3) — bloqueia o "AGHU em produção" da entrega final (07/08).

## 6. Impacto no roadmap

A frente **Fase 5 — Integração AGHU** continua sendo o caminho crítico. A parte de **conexão de dev**
está destravada; o **runtime de produção** vira uma **dependência de decisão do HC**, não de código —
e deve ser levantada já (não deixar para o cutover no CP4/29-07).

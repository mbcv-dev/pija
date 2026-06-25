"""Mapeamento de unidades funcionais para grupos assistenciais do HC-UFPE.

Grupos validados com o HC em reunião 29-05-2026 e confirmados pela tabela
de executores enviada pelo Daniel Turmina.

Os valores usados como chave correspondem exatamente ao que está gravado em
fato_eventos_jornada.unidade após a normalização feita pelos mappers ETL
(zero-width spaces removidos, typo de RESSONÂNCIA corrigido).
"""

GRUPO_ANALISES_CLINICAS = "Análises Clínicas"
GRUPO_DIAGNOSTICO_IMAGEM = "Diagnóstico por Imagem"
GRUPO_ANATOMIA_PATOLOGICA = "Anatomia Patológica"
GRUPO_PROCEDIMENTAL = "Procedimental"
GRUPO_AMBULATORIAL = "Ambulatorial"
GRUPO_INTERNACAO = "Internação"

# Mapeamento unidade → grupo
UNIDADE_PARA_GRUPO: dict[str, str] = {
    # ── Análises Clínicas ────────────────────────────────────────────────────
    "UAC: BIOQUÍMICA":            GRUPO_ANALISES_CLINICAS,
    "UAC: SOROLOGIA":             GRUPO_ANALISES_CLINICAS,
    "UAC: HEMATOLOGIA":           GRUPO_ANALISES_CLINICAS,
    "UAC: BACTERIOLOGIA":         GRUPO_ANALISES_CLINICAS,
    "UAC: HEMOSTASIA":            GRUPO_ANALISES_CLINICAS,
    "UAC: UROANÁLISE":            GRUPO_ANALISES_CLINICAS,
    "UAC: GASOMETRIA":            GRUPO_ANALISES_CLINICAS,
    "UAC: EXAMES EXTERNOS":       GRUPO_ANALISES_CLINICAS,
    "UAC: EXAMES DA REDE":        GRUPO_ANALISES_CLINICAS,

    # ── Diagnóstico por Imagem ───────────────────────────────────────────────
    "UDI: ULTRASSONOGRAFIA":             GRUPO_DIAGNOSTICO_IMAGEM,
    "UDI: RADIOLOGIA CONVENCIONAL":      GRUPO_DIAGNOSTICO_IMAGEM,
    "UDI: TOMOGRAFIA COMPUTADORIZADA":   GRUPO_DIAGNOSTICO_IMAGEM,
    "UDI: DENSITOMETRIA ÓSSEA":          GRUPO_DIAGNOSTICO_IMAGEM,
    "UDI: RESSONÂNCIA MAGNÉTICA":        GRUPO_DIAGNOSTICO_IMAGEM,
    "UDI: MEDICINA NUCLEAR":             GRUPO_DIAGNOSTICO_IMAGEM,
    "UDI: MAMOGRAFIA":                   GRUPO_DIAGNOSTICO_IMAGEM,
    "UNIDADE DE DIAGNÓSTICO POR IMAGEM": GRUPO_DIAGNOSTICO_IMAGEM,

    # ── Anatomia Patológica ──────────────────────────────────────────────────
    "UAP: HISTOPATOLÓGICO":        GRUPO_ANATOMIA_PATOLOGICA,
    "UAP: CITOLOGIA CÉRVICO-VAGINAL": GRUPO_ANATOMIA_PATOLOGICA,
    "UAP: CITOLOGIA GERAL":        GRUPO_ANATOMIA_PATOLOGICA,
    "UAP: IMUNOHISTOQUÍMICA":      GRUPO_ANATOMIA_PATOLOGICA,
    "UAP: CONGELAÇÃO":             GRUPO_ANATOMIA_PATOLOGICA,

    # ── Procedimental ────────────────────────────────────────────────────────
    "AGENCIA TRANSFUSIONAL":       GRUPO_PROCEDIMENTAL,
    "ENDOSCOPIA":                  GRUPO_PROCEDIMENTAL,
    "HEMODINAMICA - PDT":          GRUPO_PROCEDIMENTAL,
    "BLOCO DERMATO":               GRUPO_PROCEDIMENTAL,
    "NEFROLOGIA - PROCEDIMENTOS":  GRUPO_PROCEDIMENTAL,
    "CENTRO OBSTETRICO":           GRUPO_PROCEDIMENTAL,

    # ── Ambulatorial ─────────────────────────────────────────────────────────
    "OBSTETRÍCIA (AMBULATÓRIO)":       GRUPO_AMBULATORIAL,
    "CARDIOLOGIA (AMBULATÓRIO)":       GRUPO_AMBULATORIAL,
    "PNEUMOLOGIA (AMBULATÓRIO)":       GRUPO_AMBULATORIAL,
    "GINECOLOGIA (AMBULATÓRIO)":       GRUPO_AMBULATORIAL,
    "GASTROENTEROLOGIA (AMBULATÓRIO)": GRUPO_AMBULATORIAL,
    "NEUROLOGIA (AMBULATÓRIO)":        GRUPO_AMBULATORIAL,
    "UROLOGIA (AMBULATÓRIO)":          GRUPO_AMBULATORIAL,
    "INFECTOLOGIA (AMBULATÓRIO)":      GRUPO_AMBULATORIAL,
    "HEMATOLOGIA (AMBULATÓRIO)":       GRUPO_AMBULATORIAL,
    "OFTALMO GERAL":                   GRUPO_AMBULATORIAL,
    "OFTALMO ESPECIALIZADOS":          GRUPO_AMBULATORIAL,
    "FONOAUDIOLOGIA":                  GRUPO_AMBULATORIAL,

    # ── Internação ───────────────────────────────────────────────────────────
    "8º SUL": GRUPO_INTERNACAO,
}

# Índice inverso: grupo → lista de unidades
GRUPO_PARA_UNIDADES: dict[str, list[str]] = {}
for _unidade, _grupo in UNIDADE_PARA_GRUPO.items():
    GRUPO_PARA_UNIDADES.setdefault(_grupo, []).append(_unidade)


def get_grupo(unidade: str | None) -> str | None:
    """Retorna o grupo assistencial de uma unidade, ou None se não mapeada."""
    if not unidade:
        return None
    return UNIDADE_PARA_GRUPO.get(unidade)

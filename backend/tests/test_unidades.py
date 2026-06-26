from pija.unidades import (
    GRUPO_AMBULATORIAL,
    GRUPO_ANATOMIA_PATOLOGICA,
    GRUPO_DIAGNOSTICO_IMAGEM,
    GRUPO_INTERNACAO,
    GRUPO_OUTROS,
    GRUPO_PROCEDIMENTAL,
    get_grupo,
    normalizar_unidade,
)


def test_normaliza_remove_zero_width_e_typo():
    assert normalizar_unidade("UAP: HISTOPATOLÓGICO​") == "UAP: HISTOPATOLÓGICO"
    assert normalizar_unidade("UDI: RESSONÂNIA MAGNÉTICA") == "UDI: RESSONÂNCIA MAGNÉTICA"
    assert normalizar_unidade("  CARDIOLOGIA (AMBULATÓRIO)  ") == "CARDIOLOGIA (AMBULATÓRIO)"
    assert normalizar_unidade("") is None
    assert normalizar_unidade(None) is None


def test_mapa_explicito_apos_normalizacao():
    # estavam no mapa, mas o dado real vinha com zero-width / typo
    assert get_grupo("UAP: HISTOPATOLÓGICO​") == GRUPO_ANATOMIA_PATOLOGICA
    assert get_grupo("UDI: RESSONÂNIA MAGNÉTICA") == GRUPO_DIAGNOSTICO_IMAGEM


def test_regra_ambulatorio():
    assert get_grupo("ONCOLOGIA (AMBULATÓRIO)") == GRUPO_AMBULATORIAL
    assert get_grupo("PEDIATRIA (AMBULATÓRIO)") == GRUPO_AMBULATORIAL


def test_regra_andares_internacao():
    assert get_grupo("9º NORTE") == GRUPO_INTERNACAO
    assert get_grupo("10º SUL") == GRUPO_INTERNACAO
    assert get_grupo("7 º SUL") == GRUPO_INTERNACAO


def test_regra_uti_internacao():
    assert get_grupo("UTI ADULTO") == GRUPO_INTERNACAO
    assert get_grupo("UCI NEONATAL") == GRUPO_INTERNACAO


def test_regra_procedimental():
    assert get_grupo("HEMODIALISE") == GRUPO_PROCEDIMENTAL
    assert get_grupo("BLOCO CIRURGICO") == GRUPO_PROCEDIMENTAL


def test_fallback_outros():
    assert get_grupo("FISIOTERAPIA") == GRUPO_OUTROS
    assert get_grupo("NUTRIÇÃO") == GRUPO_OUTROS
    assert get_grupo("URGENCIA E EMERGENCIA") == GRUPO_OUTROS


def test_none_para_unidade_vazia():
    assert get_grupo(None) is None
    assert get_grupo("") is None

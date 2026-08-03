"""Testes da distribuição (histograma) dos tempos por KPI.

O ponto do histograma é mostrar a cauda que a mediana esconde — por isso os
testes garantem que a distribuição usa EXATAMENTE as mesmas linhas do cálculo
da mediana (mesmo n, mesmo p50) e que os baldes cobrem todo o intervalo.

A fixture do banco tem 2–5 casos por KPI, o que não exercita 17 baldes. Por isso
`TestEnvelopeSintetico` alimenta o envelope SQL com um produtor de linhas
sintético (lista de valores conhecidos), onde dá para conferir balde a balde.
"""
import pytest
from sqlalchemy import text

from pija.providers.kpis_provider import _MEDIAN_SQL, _N_BUCKETS, KpisProvider
from pija.schemas.common import GroupBy
from pija.sql_filtros import Filtros


def _filtros(**kwargs) -> Filtros:
    return Filtros(
        unidade=kwargs.get("unidade"),
        especialidade=kwargs.get("especialidade"),
        grupo=kwargs.get("grupo"),
        data_inicio=kwargs.get("data_inicio"),
        data_fim=kwargs.get("data_fim"),
    )


async def _dist(session, **filtro_kwargs):
    result = await KpisProvider(session).get_distribuicoes(
        kpi_codes=None, filtros=_filtros(**filtro_kwargs)
    )
    return {d.codigo: d for d in result.distribuicoes}


async def _medianas(session):
    result = await KpisProvider(session).get_kpis(
        kpi_codes=None, group_by=GroupBy.unidade, filtros=_filtros()
    )
    return {k.codigo: k for k in result.kpis}


class TestDistribuicoes:
    async def test_retorna_todos_os_codigos(self, fixture_db_session):
        dists = await _dist(fixture_db_session)
        assert set(dists) == {"KPI-01", "KPI-03", "KPI-05", "KPI-06", "KPI-07", "KPI-07B"}

    async def test_unidade_tempo_igual_a_do_kpi(self, fixture_db_session):
        dists = await _dist(fixture_db_session)
        assert dists["KPI-07B"].unidade_tempo == "horas"
        assert dists["KPI-07"].unidade_tempo == "dias"

    async def test_contagens_somam_n_total(self, fixture_db_session):
        for d in (await _dist(fixture_db_session)).values():
            assert sum(b.n for b in d.buckets) == d.n_total

    async def test_n_total_bate_com_tempos_medios(self, fixture_db_session):
        # A distribuição usa as MESMAS linhas do cálculo da mediana.
        kpis = await _medianas(fixture_db_session)
        for codigo, d in (await _dist(fixture_db_session)).items():
            assert d.n_total == kpis[codigo].n_global

    async def test_baldes_lineares_cobrem_0_ao_teto_e_cauda_e_aberta(self, fixture_db_session):
        for d in (await _dist(fixture_db_session)).values():
            if d.n_total == 0:
                continue
            lineares = [b for b in d.buckets if b.ate is not None]
            cauda = [b for b in d.buckets if b.ate is None]
            # a cauda é sempre o último balde da lista (ordem importa para o gráfico)
            assert len(cauda) == 1 and d.buckets[-1].ate is None
            assert len(lineares) == _N_BUCKETS
            assert lineares[0].de == 0.0
            # o teto do último linear é o começo da cauda — sem folga de ponto flutuante
            assert lineares[-1].ate == cauda[0].de
            # contíguos: o fim de um é o começo do próximo
            for a, b in zip(lineares, lineares[1:], strict=False):  # pares consecutivos
                assert a.ate == pytest.approx(b.de)

    async def test_teto_e_o_p95_quando_p95_positivo(self, fixture_db_session):
        for d in (await _dist(fixture_db_session)).values():
            if d.n_total and d.p95 and d.p95 > 0:
                assert d.buckets[-1].de == pytest.approx(d.p95)

    async def test_cada_valor_cai_no_balde_certo(self, fixture_db_session):
        # KPI-07 tem 3 permanências conhecidas na fixture: 3, 5 e 7 dias.
        d = (await _dist(fixture_db_session))["KPI-07"]
        assert d.n_total == 3 and d.p95 == pytest.approx(7.0)
        for valor in (3.0, 5.0):
            alvo = [b for b in d.buckets if b.ate is not None and b.de <= valor < b.ate]
            assert len(alvo) == 1 and alvo[0].n == 1
        # o máximo (== p95) cai na cauda aberta, não no último balde linear
        assert d.buckets[-1].n == 1

    async def test_p50_bate_com_a_mediana_do_tempos_medios(self, fixture_db_session):
        kpis = await _medianas(fixture_db_session)
        for codigo, d in (await _dist(fixture_db_session)).items():
            if d.n_total == 0:
                assert d.p50 is None
            else:
                assert d.p50 == pytest.approx(kpis[codigo].media_global)

    async def test_filtro_restringe(self, fixture_db_session):
        tudo = await _dist(fixture_db_session)
        # "UAC: BIOQUÍMICA" é a unidade do exame E-001; o KPI-05 tem 2 exames no
        # total, então o recorte tem de deixar exatamente 1.
        recorte = await _dist(fixture_db_session, unidade=["UAC: BIOQUÍMICA"])
        assert tudo["KPI-05"].n_total == 2
        assert recorte["KPI-05"].n_total == 1
        assert sum(b.n for b in recorte["KPI-05"].buckets) == 1

    async def test_subconjunto_kpi_codes(self, fixture_db_session):
        result = await KpisProvider(fixture_db_session).get_distribuicoes(
            kpi_codes=["KPI-03"], filtros=_filtros()
        )
        assert [d.codigo for d in result.distribuicoes] == ["KPI-03"]

    async def test_kpi_sem_dados_vem_vazio(self, fixture_db_session):
        # Recorte impossível → todo KPI zera, com buckets [].
        vazio = await _dist(fixture_db_session, unidade=["__NAO_EXISTE__"])
        for d in vazio.values():
            assert d.n_total == 0 and d.buckets == [] and d.p50 is None and d.p95 is None


def _base_valores(valores) -> str:
    """Produtor de linhas (dimensao, valor) sintético — não toca em nenhuma tabela."""
    linhas = [
        f"SELECT 'X' AS dimensao, {'NULL' if v is None else repr(float(v))} AS valor"
        for v in valores
    ]
    return "\nUNION ALL\n".join(linhas)


async def _dist_sintetica(session, valores, code="KPI-07"):
    """Roda o envelope de distribuição sobre uma lista de valores conhecidos."""
    return await KpisProvider(session)._distribuicao(code, _base_valores(valores), {})


async def _mediana_sintetica(session, valores):
    """Roda o envelope de mediana sobre a mesma lista — devolve (n, mediana) global."""
    rows = (
        await session.execute(text(_MEDIAN_SQL.format(base=_base_valores(valores))), {})
    ).all()
    g = next(r._mapping for r in rows if r._mapping["tipo"] == "G")
    return int(g["n"] or 0), (float(g["mediana"]) if g["mediana"] is not None else None)


def _contagem_esperada(valores, buckets) -> list[int]:
    """Reconta os valores por balde a partir SÓ das fronteiras publicadas.

    Oráculo independente do SQL: usa o contrato do schema (`de` inclusivo,
    `ate` exclusivo, `ate=None` = cauda aberta).
    """
    esperado = []
    for b in buckets:
        if b.ate is None:
            esperado.append(sum(1 for v in valores if v is not None and v >= b.de))
        else:
            esperado.append(sum(1 for v in valores if v is not None and b.de <= v < b.ate))
    return esperado


class TestEnvelopeSintetico:
    async def test_100_valores_com_cauda_longa(self, fixture_db_session):
        valores = [float((i % 10) + 1) for i in range(95)] + [200.0, 201.0, 202.0, 203.0, 204.0]
        d = await _dist_sintetica(fixture_db_session, valores)

        assert d.n_total == 100
        assert d.p50 == pytest.approx(5.5)  # média dos 2 centrais (5 e 6)
        assert d.p95 == pytest.approx(10.0)  # 95º menor valor
        assert sum(b.n for b in d.buckets) == 100
        assert [b.n for b in d.buckets] == _contagem_esperada(valores, d.buckets)
        # os 5 outliers + os nove valores == p95 caem na cauda
        assert d.buckets[-1].n == 14

    async def test_valores_no_mesmo_balde_sao_somados(self, fixture_db_session):
        # 20 valores iguais a 1 + 10 espalhados até 100 → teto 90, largura 5.625:
        # os vinte 1.0 têm de cair todos no primeiro balde.
        valores = [1.0] * 20 + [float(v) for v in range(10, 110, 10)]
        d = await _dist_sintetica(fixture_db_session, valores)
        assert d.p95 == pytest.approx(90.0)
        assert d.buckets[0].n == 20
        assert d.buckets[-1].n == 2  # 90 (== teto) e 100
        assert [b.n for b in d.buckets] == _contagem_esperada(valores, d.buckets)
        assert sum(b.n for b in d.buckets) == 30

    async def test_empates_exatamente_no_p95_vao_para_a_cauda(self, fixture_db_session):
        valores = [1.0] * 10 + [5.0] * 10
        d = await _dist_sintetica(fixture_db_session, valores)
        assert d.p95 == pytest.approx(5.0)
        assert d.buckets[-1].de == pytest.approx(5.0) and d.buckets[-1].n == 10
        assert [b.n for b in d.buckets] == _contagem_esperada(valores, d.buckets)
        assert sum(b.n for b in d.buckets) == 20

    async def test_maioria_zeros_nao_esconde_a_cauda(self, fixture_db_session):
        # Caso-âncora (KPI-07B): p95 = 0, mas existe cauda. O teto tem de cair no
        # máximo, senão o histograma inteiro vira um balde só e a cauda some.
        valores = [0.0] * 96 + [10.0, 20.0, 50.0, 400.0]
        d = await _dist_sintetica(fixture_db_session, valores)

        assert d.p95 == pytest.approx(0.0)
        assert d.n_total == 100 and sum(b.n for b in d.buckets) == 100
        assert len(d.buckets) == _N_BUCKETS + 1
        assert d.buckets[-1].de == pytest.approx(400.0)  # teto = máximo
        assert d.buckets[-1].n == 1  # a cauda está VISÍVEL
        assert d.buckets[0].n == 98  # 96 zeros + 10 + 20 (largura 25)
        assert d.buckets[2].n == 1  # o 50
        assert [b.n for b in d.buckets] == _contagem_esperada(valores, d.buckets)

    async def test_tudo_zero_vira_um_balde_aberto(self, fixture_db_session):
        d = await _dist_sintetica(fixture_db_session, [0.0] * 10)
        assert d.n_total == 10
        assert len(d.buckets) == 1
        # aberto (ate=None) e não [0, 0): intervalo vazio mentiria sobre o conteúdo
        assert d.buckets[0].de == 0.0 and d.buckets[0].ate is None and d.buckets[0].n == 10
        assert d.p50 == pytest.approx(0.0) and d.p95 == pytest.approx(0.0)

    async def test_valor_negativo_nao_some(self, fixture_db_session):
        # Fora do domínio dos KPIs de hoje, mas se um .sql futuro deixar passar,
        # o caso tem de aparecer em algum balde — nunca sumir em silêncio.
        valores = [-3.0, 0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]
        d = await _dist_sintetica(fixture_db_session, valores)
        assert d.n_total == 10
        assert sum(b.n for b in d.buckets) == 10
        assert d.buckets[0].n == 2  # o -3 é clampado para o primeiro balde, com o 0

    async def test_sem_linhas_vem_vazio(self, fixture_db_session):
        d = await _dist_sintetica(fixture_db_session, [None, None])
        assert d.n_total == 0 and d.buckets == [] and d.p50 is None and d.p95 is None

    async def test_envelope_nao_depende_de_dimensao(self, fixture_db_session):
        # `dimensao` é ignorada pelo envelope: dimensões diferentes, mesmo histograma.
        base_misto = "\nUNION ALL\n".join(
            f"SELECT '{'A' if i % 2 else 'B'}' AS dimensao, {float(i)} AS valor"
            for i in range(1, 21)
        )
        provider = KpisProvider(fixture_db_session)
        misto = await provider._distribuicao("KPI-07", base_misto, {})
        uniforme = await _dist_sintetica(fixture_db_session, [float(i) for i in range(1, 21)])
        assert misto.n_total == uniforme.n_total == 20
        assert [b.n for b in misto.buckets] == [b.n for b in uniforme.buckets]


class TestParidadeComOEnvelopeDaMediana:
    """Os dois envelopes têm de ler as MESMAS linhas — senão o gráfico contradiz o card."""

    async def test_nulos_ignorados_nos_dois_envelopes(self, fixture_db_session):
        valores = [1.0, 2.0, 3.0, None, None]
        d = await _dist_sintetica(fixture_db_session, valores)
        n_mediana, mediana = await _mediana_sintetica(fixture_db_session, valores)
        assert (d.n_total, d.p50) == (3, pytest.approx(2.0))
        assert (n_mediana, mediana) == (3, pytest.approx(2.0))

    async def test_paridade_com_n_par_e_impar(self, fixture_db_session):
        for valores in ([4.0, 1.0, 3.0, 2.0], [4.0, 1.0, 3.0], [7.0]):
            d = await _dist_sintetica(fixture_db_session, valores)
            n_mediana, mediana = await _mediana_sintetica(fixture_db_session, valores)
            assert d.n_total == n_mediana == len(valores)
            assert d.p50 == pytest.approx(mediana)

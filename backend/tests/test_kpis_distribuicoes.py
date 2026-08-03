"""Testes da distribuição (histograma) dos tempos por KPI.

O ponto do histograma é mostrar a cauda que a mediana esconde — por isso os
testes garantem que a distribuição usa EXATAMENTE as mesmas linhas do cálculo
da mediana (mesmo n, mesmo p50) e que os baldes cobrem todo o intervalo.
"""
import pytest

from pija.providers.kpis_provider import KpisProvider, _N_BUCKETS
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

    async def test_baldes_lineares_cobrem_0_a_p95_e_cauda_e_aberta(self, fixture_db_session):
        for d in (await _dist(fixture_db_session)).values():
            if d.n_total == 0 or d.p95 is None or d.p95 <= 0:
                continue
            lineares = [b for b in d.buckets if b.ate is not None]
            cauda = [b for b in d.buckets if b.ate is None]
            assert len(cauda) == 1 and cauda[0].de == pytest.approx(d.p95)
            assert lineares[0].de == pytest.approx(0.0)
            assert lineares[-1].ate == pytest.approx(d.p95)
            assert len(lineares) == _N_BUCKETS
            # contíguos: o fim de um é o começo do próximo
            for a, b in zip(lineares, lineares[1:]):
                assert a.ate == pytest.approx(b.de)
            # a cauda é o último balde da lista (ordem importa para o gráfico)
            assert d.buckets[-1].ate is None

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
        # "UAC: BIOQUÍMICA" existe na fixture (exame E-001) — recorta o KPI-05.
        recorte = await _dist(fixture_db_session, unidade=["UAC: BIOQUÍMICA"])
        assert any(
            recorte[c].n_total < tudo[c].n_total
            for c in tudo if tudo[c].n_total > 0
        )

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

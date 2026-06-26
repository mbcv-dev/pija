import pytest

from pija.providers.gargalos_provider import GargalosProvider
from pija.schemas.common import GroupBy


async def _gargalos(session, **over):
    provider = GargalosProvider(session)
    params = dict(kpi_codes=None, group_by=GroupBy.unidade,
                  unidade=None, especialidade=None, grupo=None,
                  data_inicio=None, data_fim=None, limit=10)
    params.update(over)
    return await provider.get_gargalos(**params)


class TestGargalosProvider:
    async def test_top1(self, fixture_db_session):
        top = (await _gargalos(fixture_db_session)).items[0]
        assert top.transicao == "KPI-06"
        assert top.dimensao == "9º NORTE"
        assert top.media == pytest.approx(13.5, abs=1e-9)

    async def test_ordenado_desc(self, fixture_db_session):
        result = await _gargalos(fixture_db_session)
        medias = [i.media for i in result.items]
        assert medias == sorted(medias, reverse=True)

    async def test_ranking_completo_determinista(self, fixture_db_session):
        result = await _gargalos(fixture_db_session)
        got = [(i.transicao, i.dimensao, round(i.media, 2)) for i in result.items]
        assert got == [
            ("KPI-06", "9º NORTE", 13.5),
            ("KPI-03", "CARDIOLOGIA (AMBULATÓRIO)", 10.0),
            ("KPI-03", "ORTOPEDIA (AMBULATÓRIO)", 8.0),
            ("KPI-05", "UDI: ULTRASSONOGRAFIA", 7.0),
            ("KPI-07", "10º SUL", 7.0),
            ("KPI-06", "10º SUL", 6.0),
            ("KPI-05", "UAC: BIOQUÍMICA", 4.0),
            ("KPI-07", "9º NORTE", 4.0),
        ]

    async def test_limit_topn(self, fixture_db_session):
        result = await _gargalos(fixture_db_session, limit=3)
        assert len(result.items) == 3

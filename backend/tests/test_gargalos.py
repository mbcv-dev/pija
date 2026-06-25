import pytest
from pija.providers.gargalos_provider import GargalosProvider


class TestGargalosProvider:
    async def test_top1_e_consulta_cardiologia(self, fixture_db_session):
        provider = GargalosProvider(fixture_db_session)
        result = await provider.get_gargalos(
            grupo=None, especialidade=None, tipo_entidade=None,
            data_inicio=None, data_fim=None,
        )
        assert len(result.ranking) > 0
        top = result.ranking[0]
        assert top.tipo_entidade == "CONSULTA"
        assert top.grupo == "CARDIOLOGIA"
        assert top.media_espera_dias == pytest.approx(10.0, abs=0.001)

    async def test_ordenado_desc(self, fixture_db_session):
        provider = GargalosProvider(fixture_db_session)
        result = await provider.get_gargalos(
            grupo=None, especialidade=None, tipo_entidade=None,
            data_inicio=None, data_fim=None,
        )
        esperas = [r.media_espera_dias for r in result.ranking]
        assert esperas == sorted(esperas, reverse=True)

    async def test_filtro_por_tipo_entidade(self, fixture_db_session):
        provider = GargalosProvider(fixture_db_session)
        result = await provider.get_gargalos(
            grupo=None, especialidade=None, tipo_entidade="INTERNACAO",
            data_inicio=None, data_fim=None,
        )
        assert all(r.tipo_entidade == "INTERNACAO" for r in result.ranking)
        top = result.ranking[0]
        assert top.media_espera_dias == pytest.approx(7.0, abs=0.001)  # ORTOPEDIA: 7d

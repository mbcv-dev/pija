from pija.models.fato import FatoEvento
from pija.providers.dimensoes_provider import DimensoesProvider


class TestDimensoesProvider:
    async def test_retorna_distintos_sem_duplicatas(self, fixture_db_session):
        result = await DimensoesProvider(fixture_db_session).get_dimensoes()
        # Sem duplicatas em nenhuma dimensão
        assert len(result.grupos) == len(set(result.grupos))
        assert len(result.unidades) == len(set(result.unidades))
        assert len(result.especialidades) == len(set(result.especialidades))
        # Valores conhecidos da fixture estão presentes
        assert "Ambulatorial" in result.grupos
        assert "CARDIOLOGIA" in result.especialidades

    async def test_exclui_unidades_inativas(self, fixture_db_session):
        fixture_db_session.add(
            FatoEvento(
                evento_id="C-INA", paciente_id="900", tipo_entidade="CONSULTA", entidade_id="INA",
                timestamp_principal="2024-02-01", unidade="ALA TESTE - INATIVO",
                grupo="Ambulatorial", especialidade="CARDIOLOGIA", dt_carga="2024-01-01",
            )
        )
        await fixture_db_session.commit()
        result = await DimensoesProvider(fixture_db_session).get_dimensoes()
        assert all("INATIVO" not in u for u in result.unidades)

    async def test_ignora_vazios_e_nulos(self, fixture_db_session):
        result = await DimensoesProvider(fixture_db_session).get_dimensoes()
        assert "" not in result.unidades
        assert "" not in result.especialidades
        assert "" not in result.grupos

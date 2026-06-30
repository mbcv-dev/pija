"""Unidades inativas (sufixo INATIVO) devem ser excluídas da analítica (KPIs/gargalos)."""
from sqlalchemy.ext.asyncio import async_sessionmaker

from pija.models.fato import FatoEvento
from pija.providers.kpis_provider import KpisProvider
from pija.schemas.common import GroupBy


async def test_kpi07_exclui_unidade_inativa(async_engine):
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as session:
        session.add_all([
            FatoEvento(
                evento_id="I-NA", paciente_id="901", tipo_entidade="INTERNACAO", entidade_id="NA",
                timestamp_principal="2024-01-01", timestamp_alta_administrativa="2024-01-05",
                unidade="ALA TESTE - INATIVO", grupo="Internação", dt_carga="2024-01-01",
            ),
            FatoEvento(
                evento_id="I-OK", paciente_id="902", tipo_entidade="INTERNACAO", entidade_id="OK",
                timestamp_principal="2024-01-01", timestamp_alta_administrativa="2024-01-04",
                unidade="9º NORTE", grupo="Internação", dt_carga="2024-01-01",
            ),
        ])
        await session.commit()

        params = dict(unidade=None, especialidade=None, grupo=None, data_inicio=None, data_fim=None)
        result = await KpisProvider(session).compute("KPI-07", GroupBy.unidade, params)

        dims = [b.dimensao for b in result.breakdown]
        assert "ALA TESTE - INATIVO" not in dims
        assert "9º NORTE" in dims

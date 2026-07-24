import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from pija.models.fato import FatoEvento
from pija.providers.ciclicidade_provider import CiclicidadeProvider
from pija.sql_filtros import Filtros


def _pares(resp):
    return {(t.origem, t.destino): t.volume for t in resp.transicoes}


class TestCiclicidadeAgregado:
    async def test_transicoes_globais(self, fixture_db_session):
        resp = await CiclicidadeProvider(fixture_db_session).get_transicoes(
            filtros=Filtros(), paciente_id=None
        )
        assert _pares(resp) == {
            ("PRONTUARIO", "CONSULTA"): 5,
            ("CONSULTA", "INTERNACAO"): 3,
            ("INTERNACAO", "CONSULTA"): 1,
            ("EXAME", "INTERNACAO"): 1,
        }

    async def test_nos_totais(self, fixture_db_session):
        resp = await CiclicidadeProvider(fixture_db_session).get_transicoes(
            filtros=Filtros(), paciente_id=None
        )
        nos = {n.tipo: (n.total_entradas, n.total_saidas) for n in resp.nos}
        # CONSULTA: entradas=6 (5 de PRONTUARIO + 1 de INTERNACAO→CONSULTA), saídas=3 (para INTERNACAO)
        assert nos["CONSULTA"] == (6, 3)
        # INTERNACAO: entradas=3+1=4 (de CONSULTA e EXAME), saídas=1 (para CONSULTA)
        assert nos["INTERNACAO"] == (4, 1)
        assert nos["PRONTUARIO"] == (0, 5)

    async def test_tempo_medio_conhecido(self, fixture_db_session):
        resp = await CiclicidadeProvider(fixture_db_session).get_transicoes(
            filtros=Filtros(), paciente_id=None
        )
        # INTERNACAO→CONSULTA só existe no paciente 001: I-001 (2024-02-05) → C-006 (2024-04-01)
        t = next(x for x in resp.transicoes if (x.origem, x.destino) == ("INTERNACAO", "CONSULTA"))
        dias = t.tempo_medio_s / 86400.0
        assert dias == pytest.approx(56.0, abs=1e-6)  # 2024-02-05 → 2024-04-01
        assert t.n == 1

    async def test_coorte_por_especialidade_mantem_jornada_completa(self, fixture_db_session):
        # Especialidade ORTOPEDIA → pacientes 003, 004, 009. Conta TODAS as transições deles,
        # inclusive PRONTUARIO→CONSULTA (o PRONTUARIO não tem especialidade).
        resp = await CiclicidadeProvider(fixture_db_session).get_transicoes(
            filtros=Filtros(especialidade=["ORTOPEDIA"]), paciente_id=None
        )
        assert _pares(resp) == {
            ("PRONTUARIO", "CONSULTA"): 2,   # 003, 004
            ("CONSULTA", "INTERNACAO"): 1,   # 003
            ("EXAME", "INTERNACAO"): 1,      # 009
        }

    async def test_paciente_unico(self, fixture_db_session):
        resp = await CiclicidadeProvider(fixture_db_session).get_transicoes(
            filtros=Filtros(), paciente_id="001"
        )
        assert _pares(resp) == {
            ("PRONTUARIO", "CONSULTA"): 1,
            ("CONSULTA", "INTERNACAO"): 1,
            ("INTERNACAO", "CONSULTA"): 1,
        }


class TestCiclicidadeCasos:
    async def _session(self, async_engine, eventos):
        factory = async_sessionmaker(async_engine, expire_on_commit=False)
        async with factory() as s:
            s.add_all(eventos)
            await s.commit()
        return factory

    async def test_auto_laco(self, async_engine):
        # Duas CONSULTAs consecutivas do mesmo paciente => auto-laço CONSULTA→CONSULTA.
        eventos = [
            FatoEvento(evento_id="a1", paciente_id="X", tipo_entidade="CONSULTA", entidade_id="1",
                       timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
            FatoEvento(evento_id="a2", paciente_id="X", tipo_entidade="CONSULTA", entidade_id="2",
                       timestamp_principal="2024-01-05", dt_carga="2024-01-01"),
            FatoEvento(evento_id="a3", paciente_id="X", tipo_entidade="EXAME", entidade_id="3",
                       timestamp_principal="2024-01-10", dt_carga="2024-01-01"),
        ]
        factory = await self._session(async_engine, eventos)
        async with factory() as s:
            resp = await CiclicidadeProvider(s).get_transicoes(filtros=Filtros(), paciente_id=None)
        assert _pares(resp) == {("CONSULTA", "CONSULTA"): 1, ("CONSULTA", "EXAME"): 1}

    async def test_desempate_determinista_por_evento_id(self, async_engine):
        # Mesmo timestamp: a ordem é definida por evento_id (b1 antes de b2).
        eventos = [
            FatoEvento(evento_id="b1", paciente_id="Y", tipo_entidade="PRONTUARIO", entidade_id="1",
                       timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
            FatoEvento(evento_id="b2", paciente_id="Y", tipo_entidade="EXAME", entidade_id="2",
                       timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
        ]
        factory = await self._session(async_engine, eventos)
        async with factory() as s:
            resp = await CiclicidadeProvider(s).get_transicoes(filtros=Filtros(), paciente_id=None)
        assert _pares(resp) == {("PRONTUARIO", "EXAME"): 1}

    async def test_soft_delete_ignorado(self, async_engine):
        eventos = [
            FatoEvento(evento_id="c1", paciente_id="Z", tipo_entidade="CONSULTA", entidade_id="1",
                       timestamp_principal="2024-01-01", dt_carga="2024-01-01"),
            FatoEvento(evento_id="c2", paciente_id="Z", tipo_entidade="EXAME", entidade_id="2",
                       timestamp_principal="2024-01-05", dt_carga="2024-01-01",
                       deleted_at="2024-06-01"),
        ]
        factory = await self._session(async_engine, eventos)
        async with factory() as s:
            resp = await CiclicidadeProvider(s).get_transicoes(filtros=Filtros(), paciente_id=None)
        assert resp.transicoes == []  # evento vivo sozinho não gera transição

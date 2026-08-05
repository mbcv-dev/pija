import pytest

from pija.db import load_sql
from pija.providers.kpis_provider import KpisProvider
from pija.schemas.common import GroupBy
from pija.sql_filtros import Filtros


def _bd(kpi):
    return {b.dimensao: (b.media, b.n) for b in kpi.breakdown}


async def _kpis(session, *, unidade=None, especialidade=None, grupo=None,
                 data_inicio=None, data_fim=None, **over):
    provider = KpisProvider(session)
    params = dict(kpi_codes=None, group_by=GroupBy.unidade)
    params.update(over)
    filtros = Filtros(
        unidade=[unidade] if unidade else None,
        especialidade=[especialidade] if especialidade else None,
        grupo=[grupo] if grupo else None,
        data_inicio=data_inicio,
        data_fim=data_fim,
    )
    result = await provider.get_kpis(filtros=filtros, **params)
    return {k.codigo: k for k in result.kpis}


class TestKpisProvider:
    async def test_retorna_6_kpis(self, fixture_db_session):
        kpis = await _kpis(fixture_db_session)
        assert set(kpis) == {"KPI-01", "KPI-03", "KPI-05", "KPI-06", "KPI-07", "KPI-07B"}
        for code, k in kpis.items():
            expected_unit = "horas" if code == "KPI-07B" else "dias"
            assert k.unidade_tempo == expected_unit

    async def test_kpi_07b_alta_saida_horas(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-07B"]
        assert k.unidade_tempo == "horas"
        # mediana global (antes era média aritmética = 16.0)
        assert k.media_global == pytest.approx(24.0, abs=1e-9)
        assert k.n_global == 3
        assert _bd(k)["9º NORTE"] == (pytest.approx(12.0), 2)
        assert _bd(k)["10º SUL"] == (pytest.approx(24.0), 1)

    async def test_kpi_01(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-01"]
        # mediana global (antes era média aritmética = 10.2)
        assert k.media_global == pytest.approx(10.0, abs=1e-9)
        assert k.n_global == 5
        # medianas por dimensão (n=3 → valor central; antes médias 11.0 / 9.0)
        assert _bd(k)["CARDIOLOGIA (AMBULATÓRIO)"] == (pytest.approx(10.0), 3)
        assert _bd(k)["ORTOPEDIA (AMBULATÓRIO)"] == (pytest.approx(9.0), 2)

    async def test_kpi_03(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-03"]
        # mediana global (antes era média aritmética = 9.2)
        assert k.media_global == pytest.approx(10.0, abs=1e-9)
        assert k.n_global == 5

    async def test_kpi_05_calculado(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-05"]
        assert k.media_global == pytest.approx(5.5, abs=1e-9)
        assert k.n_global == 2

    async def test_kpi_06(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-06"]
        assert k.media_global == pytest.approx(11.0, abs=1e-9)
        assert k.n_global == 3

    async def test_kpi_07(self, fixture_db_session):
        k = (await _kpis(fixture_db_session))["KPI-07"]
        assert k.media_global == pytest.approx(5.0, abs=1e-9)
        assert k.n_global == 3

    async def test_filtro_especialidade_kpi07(self, fixture_db_session):
        k = (await _kpis(fixture_db_session, especialidade="CARDIOLOGIA"))["KPI-07"]
        assert k.media_global == pytest.approx(4.0, abs=1e-9)  # I-001(5), I-002(3)
        assert k.n_global == 2

    async def test_escopo_exclui_grupo_fora(self, fixture_db_session):
        # KPI-03 só conta grupo Ambulatorial; internações/exames não entram
        k = (await _kpis(fixture_db_session))["KPI-03"]
        assert all("AMBULAT" in b.dimensao.upper() for b in k.breakdown)

    async def test_filtro_grupo_internacao_no_kpi07(self, fixture_db_session):
        k = (await _kpis(fixture_db_session, grupo="Internação"))["KPI-07"]
        assert k.n_global == 3  # todas as internações são Internação
        k2 = (await _kpis(fixture_db_session, grupo="Ambulatorial"))["KPI-07"]
        assert k2.n_global == 0  # nenhuma internação é Ambulatorial

    async def test_group_by_especialidade(self, fixture_db_session):
        k = (await _kpis(fixture_db_session, group_by=GroupBy.especialidade))["KPI-03"]
        assert _bd(k)["CARDIOLOGIA"] == (pytest.approx(10.0), 3)

    async def test_subconjunto_kpi_codes(self, fixture_db_session):
        kpis = await _kpis(fixture_db_session, kpi_codes=["KPI-03"])
        assert list(kpis) == ["KPI-03"]

    def test_kpi_05_usa_liberacao_e_nao_realizacao(self):
        """O KPI-05 mede solicitação → LIBERAÇÃO.

        Em `vw_exames`, `data_hora_realizacao` é anterior à solicitação em 61,2% das linhas
        (ver DADOS-ESTADO §12) — a medida antiga descartava 600 mil eventos em silêncio e
        devolvia mediana zero. Este teste fixa a coluna certa lendo o SQL: garante que a
        troca não seja desfeita por engano numa refatoração futura.

        Só olha o SQL executável: as linhas de comentário são removidas antes da asserção
        para que alguém possa explicar no `.sql` *por que* `timestamp_realizacao` não é
        usado sem que o teste quebre — o contrário incentivaria apagar a explicação.
        """
        sql = load_sql("kpis/kpi_05.sql")
        sem_comentarios = "\n".join(
            linha for linha in sql.splitlines() if not linha.lstrip().startswith("--")
        )
        assert "timestamp_liberacao" in sem_comentarios
        assert "timestamp_realizacao" not in sem_comentarios

    async def test_kpi_05_so_conta_exame_com_resultado_liberado(self, session_exames_liberacao):
        """Só entra exame liberado — os outros dois são excluídos por motivos diferentes.

        Cobre a ressalva registrada na spec §3: 55% dos exames do HC nunca foram liberados
        e ficam de fora. É o denominador correto (só se mede duração do que terminou), mas
        significa que o KPI é cego para a fila parada.
        """
        k = (await _kpis(session_exames_liberacao))["KPI-05"]
        assert k.n_global == 1
        assert k.media_global == pytest.approx(2.0, abs=1e-9)


@pytest.fixture
async def session_exames_liberacao(async_engine):
    """Banco próprio com 3 exames: liberado, não liberado e liberado antes da solicitação.

    Não usa `fixture_db_session` de propósito: aquela fixture tem 17 eventos e
    `test_eventos.py` fixa esse número (total == 17, paginação 8+8+1), então adicionar
    casos lá quebraria testes de outra área.
    """
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from pija.models.fato import FatoEvento

    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    eventos = [
        # Liberado: 2 dias. É o único que deve entrar.
        FatoEvento(evento_id="X-1", paciente_id="900", tipo_entidade="EXAME", entidade_id="X1",
                   timestamp_principal="2024-05-01", timestamp_solicitacao="2024-05-01",
                   timestamp_realizacao="2024-05-01", timestamp_liberacao="2024-05-03",
                   unidade="UAC: BIOQUÍMICA", grupo="Análises Clínicas", especialidade="CARDIOLOGIA",
                   situacao="LIBERADO", dt_carga="2024-01-01"),
        # Ainda a coletar: tem realização preenchida, mas NÃO tem liberação → fora.
        FatoEvento(evento_id="X-2", paciente_id="901", tipo_entidade="EXAME", entidade_id="X2",
                   timestamp_principal="2024-05-01", timestamp_solicitacao="2024-05-01",
                   timestamp_realizacao="2024-05-09", timestamp_liberacao=None,
                   unidade="UAC: BIOQUÍMICA", grupo="Análises Clínicas", especialidade="CARDIOLOGIA",
                   situacao="A COLETAR", dt_carga="2024-01-01"),
        # Liberação ANTES da solicitação (inconsistência) → fora, pela guarda de ordem.
        FatoEvento(evento_id="X-3", paciente_id="902", tipo_entidade="EXAME", entidade_id="X3",
                   timestamp_principal="2024-05-10", timestamp_solicitacao="2024-05-10",
                   timestamp_realizacao="2024-05-10", timestamp_liberacao="2024-05-01",
                   unidade="UAC: BIOQUÍMICA", grupo="Análises Clínicas", especialidade="CARDIOLOGIA",
                   situacao="LIBERADO", dt_carga="2024-01-01"),
    ]
    async with factory() as session:
        session.add_all(eventos)
        await session.commit()
    async with factory() as session:
        yield session

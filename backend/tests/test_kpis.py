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
    async def test_retorna_todos_os_kpis(self, fixture_db_session):
        kpis = await _kpis(fixture_db_session)
        assert set(kpis) == {
            "KPI-01", "KPI-03", "KPI-05", "KPI-06", "KPI-07", "KPI-07B", "KPI-10", "KPI-10B"
        }
        for code, k in kpis.items():
            expected_unit = "horas" if code in {"KPI-07B", "KPI-10", "KPI-10B"} else "dias"
            assert k.unidade_tempo == expected_unit

    async def test_kpis_de_cirurgia_estao_registrados(self, fixture_db_session):
        """Os dois códigos novos entram na resposta batch, mesmo sem dado na fixture.

        A fixture não tem cirurgias — sem dado o KPI vem com media_global None e
        n_global 0, que é o contrato de "KPI sem dados no recorte". O que este
        teste fixa é o REGISTRO: se alguém esquecer de adicionar ao KPI_META, os
        endpoints batch simplesmente não devolvem o código e ninguém percebe.
        """
        kpis = await _kpis(fixture_db_session)
        assert {"KPI-10", "KPI-10B"} <= set(kpis)
        assert kpis["KPI-10"].n_global == 0
        assert kpis["KPI-10"].media_global is None

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

    async def test_kpis_de_cirurgia_medem_duracao_e_espera_em_sala(self, session_cirurgias):
        """KPI-10 = início→fim; KPI-10B = entrada na sala→início; ambos em horas.

        Fixa o significado das colunas genéricas do fato para CIRURGIA
        (DADOS-ESTADO §4.6): `timestamp_agendamento` é a ENTRADA NA SALA, não um
        agendamento. Trocar as colunas por engano continuaria devolvendo número —
        só que o número errado, e ninguém notaria.
        """
        kpis = await _kpis(session_cirurgias)
        # Realizadas: durações 2h e 4h → mediana 3h; esperas 1h e 0,5h → mediana 0,75h.
        assert kpis["KPI-10"].n_global == 2
        assert kpis["KPI-10"].media_global == pytest.approx(3.0, abs=1e-9)
        assert kpis["KPI-10B"].n_global == 2
        assert kpis["KPI-10B"].media_global == pytest.approx(0.75, abs=1e-9)

    async def test_kpi_10_ignora_cirurgia_nao_realizada(self, session_cirurgias):
        """Cancelada/agendada não tem duração — só `situacao='RZDA'` entra.

        A cancelada da fixture tem os três timestamps preenchidos de propósito:
        sem o filtro de situação ela passaria pelas guardas de nulo e de ordem e
        entraria na conta em silêncio.
        """
        k = (await _kpis(session_cirurgias))["KPI-10"]
        assert k.n_global == 2  # 4 cirurgias na fixture, 2 realizadas e coerentes

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


@pytest.fixture
async def session_cirurgias(async_engine):
    """Banco próprio com 4 cirurgias: 2 realizadas coerentes, 1 cancelada, 1 incoerente.

    Banco separado pelo mesmo motivo de `session_exames_liberacao`: a fixture
    compartilhada tem contagem de eventos fixada por `test_eventos.py`.

    Timestamps no formato que o ETL grava (`%Y-%m-%dT%H:%M:%S`, ver
    `etl/parsers.py`) — se um dia esse formato mudar para algo que o JULIANDAY
    do SQLite não entenda, o KPI viraria NULL em silêncio e estes testes caem.
    """
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from pija.models.fato import FatoEvento

    factory = async_sessionmaker(async_engine, expire_on_commit=False)

    def cirurgia(cid, entrada, inicio, fim, situacao):
        return FatoEvento(
            evento_id=f"X-{cid}", paciente_id=f"9{cid}", tipo_entidade="CIRURGIA",
            entidade_id=str(cid), timestamp_agendamento=entrada,
            timestamp_principal=inicio, timestamp_realizacao=fim,
            unidade="BLOCO CIRURGICO", grupo="Procedimental", especialidade="CARDIOLOGIA",
            tipo_evento="CIRURGIA/ELETIVA", situacao=situacao, dt_carga="2024-01-01",
        )

    eventos = [
        # Realizadas: duração 2h/4h (mediana 3h), espera em sala 1h/0,5h (mediana 0,75h).
        cirurgia(1, "2024-05-01T08:00:00", "2024-05-01T09:00:00", "2024-05-01T11:00:00", "RZDA"),
        cirurgia(2, "2024-05-02T13:30:00", "2024-05-02T14:00:00", "2024-05-02T18:00:00", "RZDA"),
        # Cancelada com os três timestamps preenchidos: só o filtro de situação a exclui.
        cirurgia(3, "2024-05-03T07:00:00", "2024-05-03T08:00:00", "2024-05-03T10:00:00", "CANC"),
        # Realizada, mas incoerente: sem fim (fora do KPI-10) e entrada DEPOIS do
        # início (fora do KPI-10B, pela guarda de ordem).
        cirurgia(4, "2024-05-04T12:00:00", "2024-05-04T10:00:00", None, "RZDA"),
    ]
    async with factory() as session:
        session.add_all(eventos)
        await session.commit()
    async with factory() as session:
        yield session

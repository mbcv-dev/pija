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
        # Durações das salas 1, 2, 4 e 7: 2h, 4h, 3h, 3h → mediana 3h.
        # Tolerância 1e-6 (e não 1e-9 como nos KPIs em dias): JULIANDAY devolve
        # dia fracionário em float, e multiplicar por 24 amplia o erro de
        # arredondamento — 1h sai como 0,999999996.
        assert kpis["KPI-10"].n_global == 4
        assert kpis["KPI-10"].media_global == pytest.approx(3.0, abs=1e-6)
        # Esperas das salas 1, 2, 5 e 6: 1h, 0,5h, 1h, 1h → mediana 1h.
        assert kpis["KPI-10B"].n_global == 4
        assert kpis["KPI-10B"].media_global == pytest.approx(1.0, abs=1e-6)

    async def test_kpis_de_cirurgia_contam_as_salas_certas(self, session_cirurgias):
        """Fixa QUAIS cirurgias entram em cada KPI, não só quantas.

        Os dois KPIs têm n=4 nesta fixture, por coincidência de desenho: dois
        recortes diferentes cabem no mesmo número. O breakdown por unidade (uma
        sala por cirurgia) é o que distingue um do outro — sem ele, trocar um
        caso incluído por um excluído passaria despercebido.
        """
        kpis = await _kpis(session_cirurgias)
        assert set(_bd(kpis["KPI-10"])) == {"CC SALA 1", "CC SALA 2", "CC SALA 4", "CC SALA 7"}
        assert set(_bd(kpis["KPI-10B"])) == {"CC SALA 1", "CC SALA 2", "CC SALA 5", "CC SALA 6"}

    async def test_kpis_de_cirurgia_ignoram_cirurgia_nao_realizada(self, session_cirurgias):
        """Cancelada não tem duração nem espera — só `situacao='RZDA'` entra.

        A cancelada (sala 3) tem os três timestamps preenchidos e coerentes de
        propósito: sem o filtro de situação ela passaria por todas as guardas de
        nulo e de ordem e entraria nas duas contas em silêncio.
        """
        kpis = await _kpis(session_cirurgias)
        assert "CC SALA 3" not in _bd(kpis["KPI-10"])
        assert "CC SALA 3" not in _bd(kpis["KPI-10B"])

    async def test_kpi_10b_ignora_cirurgia_sem_entrada_na_sala(self, session_cirurgias):
        """Sem entrada na sala não há espera a medir — mas a duração continua válida.

        Este é o caso que separa os denominadores dos dois KPIs: a sala 4 é uma
        cirurgia realizada e completa, só que sem o registro de entrada na sala.
        Ela DEVE contar no KPI-10 e ficar fora do KPI-10B. Se aparecer nos dois,
        o 10B está medindo espera a partir de um timestamp que não existe.
        """
        kpis = await _kpis(session_cirurgias)
        assert _bd(kpis["KPI-10"])["CC SALA 4"] == (pytest.approx(3.0), 1)
        assert "CC SALA 4" not in _bd(kpis["KPI-10B"])

    async def test_kpi_10_ignora_cirurgia_sem_fim(self, session_cirurgias):
        """Cirurgia em andamento (sem fim) não tem duração — mas já teve espera.

        A sala 5 fica fora do KPI-10 e dentro do KPI-10B. Sem esta separação, um
        `COALESCE` bem-intencionado no fim da cirurgia entraria como duração 0 e
        puxaria a mediana para baixo sem quebrar nada.
        """
        kpis = await _kpis(session_cirurgias)
        assert "CC SALA 5" not in _bd(kpis["KPI-10"])
        assert _bd(kpis["KPI-10B"])["CC SALA 5"] == (pytest.approx(1.0), 1)

    async def test_kpi_10_ignora_fim_antes_do_inicio(self, session_cirurgias):
        """Duração negativa é dado sujo, não cirurgia instantânea.

        A sala 6 tem fim ANTES do início e espera coerente: só a guarda de ordem
        do KPI-10 a exclui, e ela permanece no KPI-10B. Sem a guarda o valor
        negativo entraria na mediana e no histograma (que assume valor >= 0).
        """
        kpis = await _kpis(session_cirurgias)
        assert "CC SALA 6" not in _bd(kpis["KPI-10"])
        assert _bd(kpis["KPI-10B"])["CC SALA 6"] == (pytest.approx(1.0), 1)

    async def test_kpi_10b_ignora_entrada_depois_do_inicio(self, session_cirurgias):
        """Espera negativa é dado sujo — e a duração da mesma cirurgia segue válida.

        Espelho do teste anterior: a sala 7 registra entrada na sala DEPOIS do
        início da cirurgia. Só a guarda de ordem do KPI-10B a exclui; ela continua
        contando no KPI-10, o que prova que foi a guarda certa que agiu.
        """
        kpis = await _kpis(session_cirurgias)
        assert "CC SALA 7" not in _bd(kpis["KPI-10B"])
        assert _bd(kpis["KPI-10"])["CC SALA 7"] == (pytest.approx(3.0), 1)

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
    """Banco próprio com 7 cirurgias — um motivo de exclusão por linha, isolado.

    Banco separado pelo mesmo motivo de `session_exames_liberacao`: a fixture
    compartilhada tem contagem de eventos fixada por `test_eventos.py`.

    Cada cirurgia mora numa SALA diferente porque o breakdown padrão agrupa por
    `unidade`: assim os testes conseguem afirmar QUAIS cirurgias entraram na
    conta, e não só quantas — dois recortes errados podem devolver o mesmo `n`.

    Cada linha viola no máximo UMA condição de cada `.sql`, de propósito. Um caso
    que quebra dois filtros ao mesmo tempo não prova nada: o teste continua verde
    se um dos dois for removido do SQL, e o motivo real da exclusão fica oculto.

    | sala | entrada na sala | início | fim   | situação | KPI-10 | KPI-10B |
    |------|-----------------|--------|-------|----------|--------|---------|
    | 1    | 08:00           | 09:00  | 11:00 | RZDA     | 2h     | 1h      |
    | 2    | 13:30           | 14:00  | 18:00 | RZDA     | 4h     | 0,5h    |
    | 3    | 07:00           | 08:00  | 10:00 | CANC     | fora   | fora    |
    | 4    | (sem)           | 09:00  | 12:00 | RZDA     | 3h     | fora    |
    | 5    | 07:00           | 08:00  | (sem) | RZDA     | fora   | 1h      |
    | 6    | 08:00           | 09:00  | 08:30 | RZDA     | fora   | 1h      |
    | 7    | 10:00           | 09:00  | 12:00 | RZDA     | 3h     | fora    |

    Timestamps no formato que o ETL grava (`%Y-%m-%dT%H:%M:%S`, ver
    `etl/parsers.py`) — se um dia esse formato mudar para algo que o JULIANDAY
    do SQLite não entenda, o KPI viraria NULL em silêncio e estes testes caem.
    """
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from pija.models.fato import FatoEvento

    factory = async_sessionmaker(async_engine, expire_on_commit=False)

    def cirurgia(sala, entrada, inicio, fim, situacao="RZDA"):
        """Uma cirurgia no dia `sala` de maio, na sala `sala`. Horas em HH:MM."""
        # A data é montada com um dígito só. Com sala >= 10 sairia "2024-05-010",
        # que o JULIANDAY do SQLite devolve como NULL — a cirurgia sumiria do KPI
        # em silêncio, e um teste novo passaria sem nunca ter tido o dado.
        assert 1 <= sala <= 9, "sala vira dia do mês: use 1..9 ou mude o formato da data"

        def ts(hhmm):
            return f"2024-05-0{sala}T{hhmm}:00" if hhmm else None

        return FatoEvento(
            evento_id=f"X-{sala}", paciente_id=f"9{sala}", tipo_entidade="CIRURGIA",
            entidade_id=str(sala), timestamp_agendamento=ts(entrada),
            timestamp_principal=ts(inicio), timestamp_realizacao=ts(fim),
            unidade=f"CC SALA {sala}", grupo="Procedimental", especialidade="CARDIOLOGIA",
            tipo_evento="CIRURGIA/ELETIVA", situacao=situacao, dt_carga="2024-01-01",
        )

    eventos = [
        # Completas e coerentes: entram nos dois KPIs. Duração 2h/4h, espera 1h/0,5h.
        cirurgia(1, "08:00", "09:00", "11:00"),
        cirurgia(2, "13:30", "14:00", "18:00"),
        # CANCELADA com os três timestamps preenchidos e coerentes: passaria por
        # todas as guardas de nulo e de ordem — só o filtro de situação a exclui.
        cirurgia(3, "07:00", "08:00", "10:00", situacao="CANC"),
        # Sem ENTRADA NA SALA: tem duração (entra no KPI-10), não tem espera a medir.
        cirurgia(4, None, "09:00", "12:00"),
        # Sem FIM: não tem duração, mas a espera em sala é medível (entra no KPI-10B).
        cirurgia(5, "07:00", "08:00", None),
        # FIM antes do INÍCIO: duração seria negativa → fora do KPI-10 pela guarda
        # de ordem. A espera continua coerente, então segue no KPI-10B.
        cirurgia(6, "08:00", "09:00", "08:30"),
        # ENTRADA depois do INÍCIO: espera seria negativa → fora do KPI-10B pela
        # guarda de ordem. A duração continua coerente, então segue no KPI-10.
        cirurgia(7, "10:00", "09:00", "12:00"),
    ]
    async with factory() as session:
        session.add_all(eventos)
        await session.commit()
    async with factory() as session:
        yield session

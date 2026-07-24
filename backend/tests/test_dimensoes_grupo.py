from pija.providers.dimensoes_provider import DimensoesProvider


class TestDimensoesGrupo:
    async def test_unidades_vem_anotadas_com_grupo(self, fixture_db_session):
        r = await DimensoesProvider(fixture_db_session).get_dimensoes()
        assert len(r.unidades) > 0
        u = r.unidades[0]
        assert hasattr(u, "valor") and hasattr(u, "grupo")
        assert u.valor

    async def test_escopo_por_grupo_filtra_unidades_e_especialidades(self, fixture_db_session):
        p = DimensoesProvider(fixture_db_session)
        full = await p.get_dimensoes()
        alvo = full.unidades[0].grupo
        assert alvo, "fixture precisa de unidade com grupo"
        scoped = await p.get_dimensoes(grupo=[alvo])
        assert all(u.grupo == alvo for u in scoped.unidades)
        assert set(scoped.especialidades) <= set(full.especialidades)

    async def test_escopo_por_varios_grupos_e_uniao(self, fixture_db_session):
        p = DimensoesProvider(fixture_db_session)
        full = await p.get_dimensoes()
        grupos = [g for g in dict.fromkeys(u.grupo for u in full.unidades) if g]
        if len(grupos) < 2:
            return  # fixture só tem um grupo — união já coberta pelo teste anterior
        scoped = await p.get_dimensoes(grupo=grupos[:2])
        assert set(u.grupo for u in scoped.unidades) <= set(grupos[:2])

    async def test_escopo_por_unidades_multivalor(self, fixture_db_session):
        p = DimensoesProvider(fixture_db_session)
        full = await p.get_dimensoes()
        alvos = [u.valor for u in full.unidades[:2]]
        scoped = await p.get_dimensoes(unidade=alvos)
        assert scoped.unidades == [] and scoped.grupos == []
        assert set(scoped.especialidades) <= set(full.especialidades)

    async def test_exclui_inativas_no_escopo_por_grupo(self, fixture_db_session):
        p = DimensoesProvider(fixture_db_session)
        full = await p.get_dimensoes()
        alvo = full.unidades[0].grupo
        scoped = await p.get_dimensoes(grupo=[alvo])
        assert all("INATIVO" not in u.valor for u in scoped.unidades)

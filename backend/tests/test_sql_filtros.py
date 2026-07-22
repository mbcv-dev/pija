from pija.sql_filtros import Filtros, build_filtros


class TestBuildFiltros:
    def test_sem_filtros_nao_gera_clausula(self):
        frag, params = build_filtros(Filtros())
        assert frag == ""
        assert params == {}

    def test_um_valor_gera_in_com_um_parametro(self):
        frag, params = build_filtros(Filtros(unidade=["UAC: BIOQUÍMICA"]))
        assert frag == "AND unidade IN (:unidade_0)"
        assert params == {"unidade_0": "UAC: BIOQUÍMICA"}

    def test_varios_valores_geram_in_com_n_parametros(self):
        frag, params = build_filtros(Filtros(grupo=["Ambulatorial", "Internação"]))
        assert frag == "AND grupo IN (:grupo_0, :grupo_1)"
        assert params == {"grupo_0": "Ambulatorial", "grupo_1": "Internação"}

    def test_campos_combinados_geram_clausulas_and(self):
        frag, params = build_filtros(
            Filtros(unidade=["U1"], especialidade=["E1", "E2"])
        )
        assert "AND unidade IN (:unidade_0)" in frag
        assert "AND especialidade IN (:especialidade_0, :especialidade_1)" in frag
        assert params == {"unidade_0": "U1", "especialidade_0": "E1", "especialidade_1": "E2"}

    def test_prefixo_de_alias_e_aplicado(self):
        frag, _ = build_filtros(Filtros(unidade=["U1"]), prefix="pd.")
        assert frag == "AND pd.unidade IN (:unidade_0)"

    def test_lista_vazia_equivale_a_sem_filtro(self):
        frag, params = build_filtros(Filtros(unidade=[], grupo=[]))
        assert frag == ""
        assert params == {}

    def test_valor_do_usuario_nunca_e_interpolado_no_sql(self):
        # Aspas/;/-- ficam no parâmetro, nunca no fragmento SQL.
        malicioso = "'; DROP TABLE fato_eventos_jornada; --"
        frag, params = build_filtros(Filtros(unidade=[malicioso]))
        assert malicioso not in frag
        assert params["unidade_0"] == malicioso

    def test_datas_nao_entram_no_fragmento(self):
        frag, params = build_filtros(Filtros(data_inicio="2024-01-01", data_fim="2024-02-01"))
        assert frag == ""
        assert params == {}

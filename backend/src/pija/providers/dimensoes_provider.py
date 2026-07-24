from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.dimensoes_schema import DimensoesResponse, UnidadeDim
from pija.sql_filtros import Filtros, build_filtros


class DimensoesProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._sql = load_sql("dimensoes.sql")
        self._escopo_sql = load_sql("dimensoes_escopo.sql")
        self._esp_sql = load_sql("especialidades_unidade.sql")

    async def get_dimensoes(
        self,
        unidade: list[str] | None = None,
        grupo: list[str] | None = None,
    ) -> DimensoesResponse:
        # Cascata por UNIDADE: devolve só as especialidades daquelas unidades
        # (grupos/unidades não mudam — o front mantém os já carregados).
        if unidade:
            frag, params = build_filtros(Filtros(unidade=unidade))
            rows = await self._session.execute(
                text(self._esp_sql.replace("{filtros}", frag)), params
            )
            return DimensoesResponse(grupos=[], unidades=[], especialidades=[r[0] for r in rows])

        # Cascata por GRUPO: escopa unidades (anotadas) e especialidades.
        if grupo:
            frag, params = build_filtros(Filtros(grupo=grupo))
            rows = await self._session.execute(
                text(self._escopo_sql.replace("{filtros}", frag)), params
            )
            unidades: list[UnidadeDim] = []
            especialidades: list[str] = []
            for tipo, valor, grupo_da_unidade in rows:
                if tipo == "unidade":
                    unidades.append(UnidadeDim(valor=valor, grupo=grupo_da_unidade))
                else:
                    especialidades.append(valor)
            return DimensoesResponse(grupos=[], unidades=unidades, especialidades=especialidades)

        rows = await self._session.execute(text(self._sql))
        grupos: list[str] = []
        unidades = []
        especialidades = []
        for tipo, valor, grupo_da_unidade in rows:
            if tipo == "grupo":
                grupos.append(valor)
            elif tipo == "unidade":
                unidades.append(UnidadeDim(valor=valor, grupo=grupo_da_unidade))
            else:
                especialidades.append(valor)
        return DimensoesResponse(grupos=grupos, unidades=unidades, especialidades=especialidades)

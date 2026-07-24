"""Provider da ciclicidade: agrega transições origem→destino por coorte.

Uma passada SQL (LAG window function) conta as transições evento→próximo-evento
por paciente. Os nós (totais de entrada/saída por etapa) são derivados em Python
das próprias transições, evitando 2ª query.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from pija.db import load_sql
from pija.schemas.ciclicidade_schema import CiclicidadeResponse, NoItem, TransicaoItem
from pija.sql_filtros import Filtros, build_filtros


class CiclicidadeProvider:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_transicoes(
        self, *, filtros: Filtros, paciente_id: str | None
    ) -> CiclicidadeResponse:
        frag, fparams = build_filtros(filtros)
        sql = load_sql("ciclicidade/transicoes.sql").replace("{filtros}", frag)
        params = {
            **fparams,
            "paciente_id": paciente_id,
            "data_inicio": filtros.data_inicio,
            "data_fim": filtros.data_fim,
        }
        rows = (await self._session.execute(text(sql), params)).all()

        transicoes: list[TransicaoItem] = []
        entradas: dict[str, int] = {}
        saidas: dict[str, int] = {}
        for r in rows:
            m = r._mapping
            origem = m["origem"]
            destino = m["destino"]
            volume = int(m["volume"])
            tempo = float(m["tempo_medio_s"]) if m["tempo_medio_s"] is not None else None
            transicoes.append(
                TransicaoItem(
                    origem=origem, destino=destino, volume=volume,
                    tempo_medio_s=tempo, n=int(m["n"] or 0),
                )
            )
            saidas[origem] = saidas.get(origem, 0) + volume
            entradas[destino] = entradas.get(destino, 0) + volume

        tipos = sorted(set(entradas) | set(saidas))
        nos = [
            NoItem(tipo=t, total_entradas=entradas.get(t, 0), total_saidas=saidas.get(t, 0))
            for t in tipos
        ]
        return CiclicidadeResponse(nos=nos, transicoes=transicoes)

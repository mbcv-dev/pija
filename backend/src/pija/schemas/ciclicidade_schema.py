"""Schemas do endpoint /api/v1/ciclicidade/transicoes.

Fluxo agregado da jornada: nós (etapas) + arestas (transições origem->destino)
com volume e tempo médio. Serve tanto o escopo agregado quanto o individual.
"""
from pydantic import BaseModel, Field


class TransicaoItem(BaseModel):
    origem: str = Field(description="tipo_entidade de origem da transição.")
    destino: str = Field(description="tipo_entidade de destino (== origem em auto-laço).")
    volume: int = Field(description="Número de transições origem→destino na coorte.")
    tempo_medio_s: float | None = Field(
        default=None, description="Tempo médio da transição em segundos (None se indeterminável)."
    )
    n: int = Field(description="Tamanho da amostra usada no tempo_medio_s.")


class NoItem(BaseModel):
    tipo: str = Field(description="Um dos tipo_entidade presentes nas transições.")
    total_entradas: int = Field(description="Soma dos volumes de transições que chegam neste tipo.")
    total_saidas: int = Field(description="Soma dos volumes de transições que saem deste tipo.")


class CiclicidadeResponse(BaseModel):
    nos: list[NoItem] = Field(description="Etapas com totais de entrada/saída.")
    transicoes: list[TransicaoItem] = Field(description="Arestas do fluxo, ordenadas por origem, destino.")

"""Backfill one-time: normaliza `unidade` e popula `grupo` no fato já carregado.

Necessário porque o ETL da F1 rodou antes da coluna `grupo` existir, deixando-a
NULL nas 2,26M linhas. Cargas futuras já populam `grupo` via os mappers
(que chamam `pija.unidades.get_grupo`), então este script é transitório — só
para o banco atual.

Uso (do repo root, venv ativo, JWT_SECRET no ambiente):
    python backend/scripts/backfill_grupo.py [caminho_db]
Default do caminho: ./backend/data/pija.db
"""

import sqlite3
import sys

from pija.unidades import get_grupo, normalizar_unidade

DB = sys.argv[1] if len(sys.argv) > 1 else "./backend/data/pija.db"


def main() -> None:
    con = sqlite3.connect(DB)
    cur = con.cursor()
    unidades = [
        r[0]
        for r in cur.execute(
            "SELECT DISTINCT unidade FROM fato_eventos_jornada WHERE unidade IS NOT NULL"
        ).fetchall()
    ]
    atualizadas = 0
    for orig in unidades:
        cur.execute(
            "UPDATE fato_eventos_jornada SET unidade = ?, grupo = ? WHERE unidade = ?",
            (normalizar_unidade(orig), get_grupo(orig), orig),
        )
        atualizadas += cur.rowcount
    con.commit()
    dist = cur.execute(
        "SELECT grupo, COUNT(*) FROM fato_eventos_jornada "
        "WHERE deleted_at IS NULL GROUP BY grupo ORDER BY 2 DESC"
    ).fetchall()
    con.close()
    print(f"linhas atualizadas: {atualizadas}")
    for grupo, n in dist:
        print(f"  {str(grupo):<24} {n:>9}")


if __name__ == "__main__":
    main()

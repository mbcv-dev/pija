"""Parsers para o formato brasileiro presente nos CSVs do AGHU.

Conforme DADOS-ESTADO.md §2:
- Datas com hora: DD/M/YYYY, HH:MM
- Datas sem hora: DD/M/YYYY
- IDs numéricos com `.` como separador de milhar: 1.458.992

Soft-fail: as funções retornam None em qualquer falha de parsing, sem
levantar exceção. Telemetria de rejeição (rows_rejected) é
responsabilidade do runner ETL (Task 15), não do parser.
"""

from datetime import datetime


def parse_br_datetime(value: str | None) -> str | None:
    """Converte 'DD/M/YYYY, HH:MM' → 'YYYY-MM-DDTHH:MM:SS' (ISO 8601).

    Retorna None se vazio, espaços ou parsing falhar (soft-fail).
    """
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    try:
        dt = datetime.strptime(stripped, "%d/%m/%Y, %H:%M")
        return dt.strftime("%Y-%m-%dT%H:%M:%S")
    except ValueError:
        return None


_DATETIME_FORMATS = (
    "%d/%m/%Y, %H:%M",       # BR (CSVs originais)
    "%Y-%m-%d %H:%M:%S.%f",  # ISO com milissegundos (export v2)
    "%Y-%m-%d %H:%M:%S",     # ISO sem milissegundos
    "%Y-%m-%d",              # data ISO
    "%d/%m/%Y",              # data BR
)


def parse_datetime(value: str | None) -> str | None:
    """Parser flexível: tenta formatos BR e ISO.

    Retorna ISO 'YYYY-MM-DDTHH:MM:SS' ou None (soft-fail).
    """
    if value is None:
        return None
    s = value.strip()
    if not s:
        return None
    for fmt in _DATETIME_FORMATS:
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%dT%H:%M:%S")
        except ValueError:
            continue
    return None


def parse_br_date(value: str | None) -> str | None:
    """Converte 'DD/M/YYYY' → 'YYYY-MM-DD' (ISO 8601 date).

    Retorna None se vazio ou parsing falhar.
    """
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    try:
        dt = datetime.strptime(stripped, "%d/%m/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_br_id(value: str | None) -> str | None:
    """Remove separador de milhar ('.') de IDs numéricos.

    '1.458.992' → '1458992'. Retorna None se vazio.

    Permissivo por design: não valida que o resultado é numérico — confia
    no contrato upstream do CSV. Strings inválidas (ex.: 'abc') passam
    através e seriam rejeitadas pelos mappers downstream se necessário.
    """
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        return None
    return stripped.replace(".", "")
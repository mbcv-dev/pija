FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    "fastapi>=0.115" "uvicorn[standard]>=0.30" "pydantic>=2.8" "pydantic-settings>=2.4" \
    "sqlalchemy[asyncio]>=2.0" "aiosqlite>=0.20" "alembic>=1.13" "pandas>=2.2" \
    "python-multipart>=0.0.9" "PyJWT>=2.9" "bcrypt>=4.2" "PyYAML>=6.0"

COPY src/ ./src/
ENV PYTHONPATH=/app/src

# Demo da apresentação (01/07/2026): banco SQLite read-only EMBUTIDO na imagem.
# Usa o pija_demo.db ENXUTO (mesmas 2.26M linhas, sem índices secundários:
# 1.5GB→539MB, ~70MB comprimido) p/ caber no teto de upload do `railway up`.
# Deploy via `railway up --no-gitignore` desta máquina — o .db não está no Git.
# Em Fase 5 isto sai (RESOURCE_MODE=aghu via VPN, sem SQLite; host on-prem).
COPY data/pija_demo.db /data/pija.db
ENV SQLITE_PATH=/data/pija.db

# Obrigatórios via painel (não têm default seguro): JWT_SECRET (>=32 chars), CORS_ORIGINS.

ENV PORT=8000
CMD ["sh", "-c", "uvicorn pija.main:app --host 0.0.0.0 --port ${PORT}"]

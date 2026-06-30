FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    "fastapi>=0.115" "uvicorn[standard]>=0.30" "pydantic>=2.8" "pydantic-settings>=2.4" \
    "sqlalchemy[asyncio]>=2.0" "aiosqlite>=0.20" "alembic>=1.13" "pandas>=2.2" \
    "python-multipart>=0.0.9" "PyJWT>=2.9" "bcrypt>=4.2" "PyYAML>=6.0"

COPY src/ ./src/
ENV PYTHONPATH=/app/src

# Banco fica num volume persistente montado em /data (Railway: anexar volume aqui).
# Default correto-por-padrão — não precisa setar SQLITE_PATH manualmente no painel.
ENV SQLITE_PATH=/data/pija.db
VOLUME ["/data"]

# Obrigatórios via painel (não têm default seguro): JWT_SECRET (>=32 chars), CORS_ORIGINS.

ENV PORT=8000
CMD ["sh", "-c", "uvicorn pija.main:app --host 0.0.0.0 --port ${PORT}"]

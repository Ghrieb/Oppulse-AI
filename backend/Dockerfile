FROM python:3.13-slim

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir uv \
    && uv sync --frozen --no-dev

COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
COPY scripts/start.sh ./scripts/start.sh

RUN chmod +x ./scripts/start.sh

ENV OPPULSE_HOST=0.0.0.0
ENV OPPULSE_PORT=8000

EXPOSE 8000

CMD ["./scripts/start.sh"]

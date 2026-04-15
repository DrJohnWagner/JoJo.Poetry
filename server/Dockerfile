FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the canonical data source and the schemas it references, plus
# the server package itself. Paths mirror the repo layout so default
# config (POEMS_DATABASE unset) resolves to /app/database/Poems.json.
COPY server /app/server
COPY database /app/database

EXPOSE 8000
CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"]

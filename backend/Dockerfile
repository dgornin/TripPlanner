FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential curl ffmpeg \
 && rm -rf /var/lib/apt/lists/*

# Install dependencies first (this layer caches well since pyproject.toml
# changes rarely). We use `pip install .[…]` with a dummy package first,
# then overwrite the package code with the actual source.
COPY pyproject.toml ./
# Create a minimal `app/` package so the editable install succeeds.
RUN mkdir -p app && touch app/__init__.py
RUN pip install --upgrade pip && pip install -e ".[dev,whisper]"

# Now copy the real source — pip's editable install already pointed at this
# directory, so the copy is enough for the `app` package to become real.
COPY . .

EXPOSE 8000

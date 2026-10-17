FROM python:3.13-slim

WORKDIR /app/backend

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY samples/ /app/samples/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

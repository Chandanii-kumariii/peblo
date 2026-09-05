FROM python:3.11-slim

WORKDIR /workspace

COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY . /workspace/api

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM python:3.11-slim
WORKDIR /service
RUN pip install --no-cache-dir fastapi uvicorn httpx python-multipart pillow
COPY server_3d.py /service/server_3d.py
EXPOSE 8081
CMD ["python", "server_3d.py"]

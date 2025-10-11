FROM python:3.9-slim

# 必要なライブラリをインストール
RUN apt-get update && apt-get install -y \
    g++ \
    build-essential \
    python3-dev \
    portaudio19-dev \
    libasound2-dev \
    libsndfile1 \
    && apt-get clean

# 作業ディレクトリを設定
WORKDIR /app

# 必要なファイルをコピー
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Flask-SocketIO 用の非同期ライブラリ
RUN pip install eventlet

# アプリケーションのコードをコピー
COPY . .

# アプリケーションを起動
CMD ["gunicorn", "-w", "2", "-k", "eventlet", "-b", "0.0.0.0:8080", "app:app"]


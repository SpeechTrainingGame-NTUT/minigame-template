from dotenv import load_dotenv
from flask import Flask, render_template
from flask_cors import CORS
from flask_socketio import SocketIO
from views.utterance_check import utterance_check_bp
from views.sample_audio import sample_audio_bp
from views.sustainability_of_voice import sustainability_of_voice_bp
from views.voice_jump import voice_jump_bp
from views.voice_jump_hz import voice_jump_hz_bp
from views.voice_jump_db import voice_jump_db_bp
import requests
import os

load_dotenv()  # .envファイルを読み込む

# Flask アプリと Socket.IO の初期化
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# アプリの初期化部分に追加
CORS(app)

# Blueprint の登録
app.register_blueprint(utterance_check_bp, url_prefix='/utterance_check')
app.register_blueprint(sustainability_of_voice_bp, url_prefix='/sustainability_of_voice')
app.register_blueprint(sample_audio_bp, url_prefix='/sample_audio')
app.register_blueprint(voice_jump_bp, url_prefix='/voice_jump')
app.register_blueprint(voice_jump_hz_bp, url_prefix='/voice_jump_hz')
app.register_blueprint(voice_jump_db_bp, url_prefix='/voice_jump_db')

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    socketio.run(app, host='0.0.0.0', port=8080)


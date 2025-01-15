from flask import Blueprint, render_template
import math
import queue
import struct
import sys
from threading import Lock
import numpy as np
import sounddevice as sd

# Blueprintの作成
voice_jump_db_bp = Blueprint('voice_jump_db', __name__, template_folder='../templates')

# スレッドセーフな処理のためのロック
thread = None
thread_lock = Lock()

# グローバル変数で socketio を保持
socketio = None

def register_socketio(sock):
    """外部から socketio を登録する"""
    global socketio
    socketio = sock

class MicrophoneStream:
    def __init__(self, rate, chunk):
        # マイク入力のパラメータ
        self.rate = rate
        self.chunk = chunk
        
        # 入力された音声データを保持するデータキュー（バッファ）
        self.buff = queue.Queue()
        
        # マイク音声入力の初期化
        self.input_stream = None
        self.is_running = False

    def open_stream(self):
        """入力ストリームを初期化する."""
        try:
            self.input_stream = sd.RawInputStream(
                samplerate=self.rate,
                blocksize=self.chunk,
                dtype="int16",
                channels=1,
                callback=self.callback,
            )
            self.input_stream.start()  # ストリームを明示的に開始
            self.is_running = True
        except Exception as e:
            print(f"Error opening stream: {e}")

    def callback(self, indata, frames, time, status):
        """音声パワーに基づいて発話区間を判定."""
        if status:
            print(status, file=sys.stderr)
        
        # 入力された音声データをキューへ保存
        self.buff.put(bytes(indata))

    def generator(self):
        """音声データを取得するための関数."""
        while True:  # キューに保存されているデータを全て取り出す
            # 先頭のデータを取得
            chunk = self.buff.get()
            if chunk is None:
                return
            data = [chunk]

            # まだキューにデータが残っていれば全て取得する
            while True:
                try:
                    chunk = self.buff.get(block=False)
                    if chunk is None:
                        return
                    data.append(chunk)
                except queue.Empty:
                    break

            # yieldにすることでキューのデータを随時取得できるようにする
            yield b"".join(data)

    def compute_power(self, indata):
        try:
            # バイトデータを数値配列に変換
            audio = struct.unpack(f"{len(indata) / 2:.0f}h", indata)
            audio = np.array(audio).astype(np.float64)
            
            # RMSを計算し、デシベルに変換
            rms = math.sqrt(np.square(audio).mean())
            power = 20 * math.log10(rms) if rms > 0.0 else -math.inf
            
            return power
        except Exception as e:
            print(f"Error in compute_power: {e}")
            return -math.inf

    def stop_stream(self):
        """音声入力ストリームを停止"""
        if self.input_stream:
            self.input_stream.stop()
            self.input_stream.close()
            self.is_running = False

# グローバル変数として保持
mic_stream = None

def background_thread():
    """バックグラウンドでdBを計算して送信"""
    while mic_stream and mic_stream.is_running:
        try:
            audio_generator = mic_stream.generator()
            for data in audio_generator:
                if not mic_stream.is_running:
                    break
                power = mic_stream.compute_power(data)
                if socketio:
                    # クライアントにデータを送信
                    socketio.emit('audio_data', {'power': float(power)})
        except Exception as e:
            print(f"Error in background thread: {e}")
            break

def register_socket_events(socketio):
    @socketio.on('connect')
    def handle_connect():
        """クライアント接続時の処理"""
        print('Client connected')

    @socketio.on('disconnect')
    def handle_disconnect():
        """クライアント切断時の処理"""
        print('Client disconnected')
        if mic_stream:
            mic_stream.stop_stream()

    @socketio.on('start_monitoring')
    def handle_start_monitoring():
        """音声モニタリング開始"""
        global thread, mic_stream
        print('Starting audio monitoring')
        
        # 入力デバイス情報に基づき、サンプリング周波数の情報を取得
        input_device_info = sd.query_devices(kind="input")
        sample_rate = int(input_device_info["default_samplerate"])
        chunk_size = 8000

        with thread_lock:
            if thread is None:
                # マイク入力の初期化
                mic_stream = MicrophoneStream(sample_rate, chunk_size)
                mic_stream.open_stream()
                thread = socketio.start_background_task(background_thread)

    @socketio.on('stop_monitoring')
    def handle_stop_monitoring():
        """音声モニタリング停止"""
        global mic_stream
        print('Stopping audio monitoring')
        if mic_stream:
            mic_stream.stop_stream()

@voice_jump_db_bp.route('/')
def index():
    return render_template('voice_jump_db.html')

#声の大きさに関する記述(プレイ中)
@voice_jump_db_bp.route('/performance1_db')
def performance1_db():
    return render_template('performance1_db.html')
@voice_jump_db_bp.route('/performance2_db')
def performance2_db():
    return render_template('performance2_db.html')
@voice_jump_db_bp.route('/performance3_db')
def performance3_db():
    return render_template('performance3_db.html')
@voice_jump_db_bp.route('/performance4_db')
def performance4_db():
    return render_template('performance4_db.html')
@voice_jump_db_bp.route('/performance5_db')
def performance5_db():
    return render_template('performance5_db.html')

#声の大きさに関する記述(結果画面)
@voice_jump_db_bp.route('/performance1_db_rslt')
def performance1_db_rslt():
    return render_template('performance1_db_rslt.html')
@voice_jump_db_bp.route('/performance2_db_rslt')
def performance2_db_rslt():
    return render_template('performance2_db_rslt.html')
@voice_jump_db_bp.route('/performance3_db_rslt')
def performance3_db_rslt():
    return render_template('performance3_db_rslt.html')
@voice_jump_db_bp.route('/performance4_db_rslt')
def performance4_db_rslt():
    return render_template('performance4_db_rslt.html')
@voice_jump_db_bp.route('/performance5_db_rslt')
def performance5_db_rslt():
    return render_template('performance5_db_rslt.html')
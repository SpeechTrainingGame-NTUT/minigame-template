from flask import Blueprint, render_template
from flask_socketio import emit
import math
import queue
import struct
import sys
from threading import Lock
import numpy as np
import sounddevice as sd
from flask import request

# Blueprintの作成
sustainability_of_voice_bp = Blueprint('sustainability_of_voice', __name__, static_folder='../static', template_folder='../templates')

# スレッドセーフな処理のためのロック
thread = None
thread_lock = Lock()

class MicrophoneStream:
    def __init__(self, rate, chunk):
        self.rate = rate
        self.chunk = chunk
        self.buff = queue.Queue()
        self.input_stream = None
        self.is_running = False

    def open_stream(self):
        try:
            self.input_stream = sd.RawInputStream(
                samplerate=self.rate,
                blocksize=self.chunk,
                dtype="int16",
                channels=1,
                callback=self.callback,
            )
            self.input_stream.start()
            self.is_running = True
        except Exception as e:
            print(f"Error opening stream: {e}")

    def callback(self, indata, frames, time, status):
        if status:
            print(status, file=sys.stderr)
        self.buff.put(bytes(indata))

    def generator(self):
        while True:
            chunk = self.buff.get()
            if chunk is None:
                return
            data = [chunk]
            while True:
                try:
                    chunk = self.buff.get(block=False)
                    if chunk is None:
                        return
                    data.append(chunk)
                except queue.Empty:
                    break
            yield b"".join(data)

    def compute_power(self, indata):
        try:
            audio = struct.unpack(f"{len(indata) // 2}h", indata)
            audio = np.array(audio).astype(np.float64)
            rms = math.sqrt(np.square(audio).mean()) 
            print(f"Computed rms: {rms}")  # デバッグ用ログ
            return 20 * math.log10(rms) if rms > 0.0 else -math.inf
        except Exception as e:
            print(f"Error in compute_power: {e}")
            return -math.inf

    def stop_stream(self):
        if self.input_stream:
            self.input_stream.stop()
            self.input_stream.close()
            self.is_running = False

def background_thread(socketio):
    while mic_stream and mic_stream.is_running:
        try:
            audio_generator = mic_stream.generator()
            for data in audio_generator:
                if not mic_stream.is_running:
                    break
                power = mic_stream.compute_power(data)
                print(f"Computed power: {power}")  # デバッグ用ログ
                # {{ edit_1 }}: powerの値をターミナルに表示
                print(f"Power value: {power}")  # 追加: powerの値をターミナルに表示
                if power != -math.inf:
                    # クライアントにデータを送信
                    socketio.emit('audio_data', {'power': float(power)})
                else:
                    print("Power calculation returned -inf, skipping emit.")
        except Exception as e:
            print(f"Error in background thread: {e}")
            break

mic_stream = None

def register_socket_events(socketio):
    @socketio.on('connect')
    def handle_connect():
        global thread 
        if thread is None:
            thread = socketio.start_background_task(target=background_thread)
        print('Client connected')

    @socketio.on('start_monitoring')
    def handle_monitoring():
        """音声モニタリングを開始"""
        global mic_stream
    
        # 入力デバイス情報に基づき、サンプリング周波数の情報を取得
        input_device_info = sd.query_devices(kind="input")
        sample_rate = int(input_device_info["default_samplerate"])
        chunk_size = 8000

        # マイク入力の初期化
        mic_stream = MicrophoneStream(sample_rate, chunk_size)
        
        try:
            mic_stream.open_stream()
            with mic_stream.input_stream:
                audio_generator = mic_stream.generator()
                for data in audio_generator:
                    power = mic_stream.compute_power(data)
                    # WebSocketを通じてクライアントにデータを送信
                    socketio.emit('audio_data', {
                        'power': float(power)
                    })
        except Exception as e:
            print(f"Error: {e}")
            socketio.emit('error', {'message': str(e)})

    @socketio.on('stop_monitoring')
    def handle_stop():
        """音声モニタリングを停止"""
        global mic_stream
        if mic_stream and mic_stream.input_stream:
            mic_stream.input_stream.stop()
            mic_stream = None

@sustainability_of_voice_bp.route('/')
def index():
    mode = request.args.get('mode', 'normal')  # パラメータが指定されていない場合は 'normal' をデフォルトに
    if mode == 'hard':
        return render_template('hard.html')
    else:
        return render_template('normal.html')
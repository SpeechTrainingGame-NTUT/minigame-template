from flask import Blueprint, render_template, jsonify
import queue
import struct
import numpy as np
import sounddevice as sd
import pyworld
import threading
import time
import math
import sys

# Blueprintの作成
voice_jump_hz_bp = Blueprint('voice_jump_hz', __name__, template_folder='../templates')

# マイク入力の設定
RATE = 44100  # サンプリングレート
CHUNK = 1024  # チャンクサイズ（サンプル数）

# 音声データを格納するキュー
audio_queue = queue.Queue()

frequency_result = 0.0  # グローバル変数で最新の基本周波数を保存

class MicrophoneStream:
    """マイク音声入力のためのクラス."""
    def __init__(self, rate, chunk):
        self.rate = rate
        self.chunk = chunk
        self.buff = queue.Queue()
        self.input_stream = None

    def open_stream(self):
        """入力ストリームを初期化する."""
        self.input_stream = sd.RawInputStream(
            samplerate=self.rate,
            blocksize=self.chunk,
            dtype="int16",
            channels=1,
            callback=self.callback,
        )

    def callback(self, indata, frames, time, status):
        """マイク入力から音声データを取得."""
        if status:
            print(status, file=sys.stderr)
        self.buff.put(bytes(indata))

    def generator(self):
        """音声データをキューから取得."""
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

    def compute_frequency(self, indata):
        """基本周波数を計算."""
        global frequency_result
        try:
            audio = struct.unpack(f"{len(indata) // 2}h", indata)  # 16bit整数型データをfloatに変換
            audio = np.array(audio).astype(np.float64)

            # 音声データが十分な長さか確認
            if len(audio) < self.rate * 0.5:  # 少なくとも0.5秒分のデータが必要
                print("Insufficient data length for frequency calculation")
                frequency_result = 0.0
                return

            # pyworldで基本周波数を計算
            frame_period = 5.0  # フレーム周期（ミリ秒）
            fo, _ = pyworld.dio(audio, self.rate, frame_period=frame_period)
            nonzero_fo = fo[fo > 0]  # 非ゼロの周波数を抽出
            frequency_result = nonzero_fo.mean() if len(nonzero_fo) > 0 else 0.0
        except Exception as e:
            print(f"Error in compute_frequency: {e}")
            frequency_result = 0.0

def start_audio_processing():
    """音声処理を開始."""
    mic_stream = MicrophoneStream(RATE, CHUNK)
    mic_stream.open_stream()
    threading.Thread(target=process_audio, args=(mic_stream,), daemon=True).start()

def process_audio(mic_stream):
    """音声データを処理して周波数を計算."""
    audio_data = b""
    with mic_stream.input_stream:
        audio_generator = mic_stream.generator()
        for data in audio_generator:
            audio_data += data
            if len(audio_data) >= RATE:  # 1秒分のデータを蓄積
                mic_stream.compute_frequency(audio_data)
                audio_data = b""  # 蓄積データをリセット

# 音声処理スレッドを開始
start_audio_processing()

# Flaskエンドポイント
@voice_jump_hz_bp.route('/get_frequency', methods=['GET'])
def fetch_frequency():
    """最新の基本周波数を返す."""
    return jsonify({'frequency': frequency_result})

@voice_jump_hz_bp.route('/')
def index():
    return render_template('voice_jump_hz.html')

# 声の高さに関する記述(プレイ中)
@voice_jump_hz_bp.route('/performance1_hz')
def performance1_hz():
    return render_template('performance1_hz.html')
@voice_jump_hz_bp.route('/performance2_hz')
def performance2_hz():
    return render_template('performance2_hz.html')
@voice_jump_hz_bp.route('/performance3_hz')
def performance3_hz():
    return render_template('performance3_hz.html')
@voice_jump_hz_bp.route('/performance4_hz')
def performance4_hz():
    return render_template('performance4_hz.html')
@voice_jump_hz_bp.route('/performance5_hz')
def performance5_hz():
    return render_template('performance5_hz.html')

# 声の高さに関する記述(結果画面)
@voice_jump_hz_bp.route('/performance1_hz_rslt')
def performance1_hz_rslt():
    return render_template('performance1_hz_rslt.html')
@voice_jump_hz_bp.route('/performance2_hz_rslt')
def performance2_hz_rslt():
    return render_template('performance2_hz_rslt.html')
@voice_jump_hz_bp.route('/performance3_hz_rslt')
def performance3_hz_rslt():
    return render_template('performance3_hz_rslt.html')
@voice_jump_hz_bp.route('/performance4_hz_rslt')
def performance4_hz_rslt():
    return render_template('performance4_hz_rslt.html')
@voice_jump_hz_bp.route('/performance5_hz_rslt')
def performance5_hz_rslt():
    return render_template('performance5_hz_rslt.html')
from flask import Blueprint, render_template, request, jsonify
import numpy as np
import math
import struct

# Blueprintの作成
sustainability_of_voice_bp = Blueprint('sustainability_of_voice', __name__)

def compute_power(audio_chunk):
    """
    音声データのRMS値を計算し、デシベル値を返す。
    """
    try:
        # 16ビットPCMデータに変換
        audio = np.array(struct.unpack(f"{len(audio_chunk) // 2}h", audio_chunk), dtype=np.float64)

        # 無音時の処理（ゼロ信号での計算エラー回避）
        if np.all(audio == 0):
            return -120.0  # 無音時の最小dB値

        # RMS計算（移動平均フィルタ適用）
        rms = np.sqrt(np.mean(audio ** 2))

        # dBに変換
        db_value = 20 * math.log10(rms) if rms > 0 else -120.0

        # 最小dB制限（無音を-60dBでカット）
        return max(db_value, -60.0)
    except Exception as e:
        print(f"Error computing power: {e}")
        return -120.0

@sustainability_of_voice_bp.route("/audio", methods=["POST"])
def process_audio():
    """
    クライアントから送信された音声データを処理し、dB値を計算するエンドポイント。
    """
    try:
        audio_data = request.data
        if not audio_data:
            return jsonify({"error": "No audio data received"}), 400

        # dB値を計算
        db = compute_power(audio_data)
        print(f"音量: {db:.2f} dB")  # デバッグ用
        return jsonify({"db": db})
    except Exception as e:
        print(f"Error processing audio: {e}")
        return jsonify({"error": str(e)}), 500
    
@sustainability_of_voice_bp.route("/")
def index():
    mode = request.args.get('mode', 'normal')  # パラメータが指定されていない場合は 'normal' をデフォルトに
    if mode == 'hard':
        return render_template('hard.html')
    else:
        return render_template('normal.html')


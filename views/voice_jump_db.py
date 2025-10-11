from flask import Blueprint, render_template, request, jsonify
import numpy as np
import math
import struct

voice_jump_db_bp = Blueprint('voice_jump_db', __name__, template_folder='../templates')

def compute_power(audio_chunk):
    """
    音声データのRMS値を計算し、デシベル値を返す。
    """
    try:
        # 16ビットPCMデータに変換
        audio = np.array(struct.unpack(f"{len(audio_chunk) // 2}h", audio_chunk), dtype=np.float64)

        # 無音処理
        if np.all(audio == 0):
            return -120.0

        # RMS計算
        rms = np.sqrt(np.mean(audio ** 2))

        # dBに変換
        db_value = 20 * math.log10(rms) if rms > 0 else -120.0

        # 最小dB制限（無音を-60dBでカット）
        return max(db_value, -60.0)
    except Exception as e:
        print(f"Error computing power: {e}")
        return -120.0

@voice_jump_db_bp.route("/audio", methods=["POST"])
def process_audio():
    """
    クライアントから送信された音声データを処理し、dB値を計算。
    """
    try:
        audio_data = request.data #音声データを request.data から取得
        if not audio_data:
            return jsonify({"error": "No audio data received"}), 400

        db = compute_power(audio_data) #compute_power() を呼び出して dB 値を計算

        # クライアントにそのまま送信（最大値は100dB）
        return jsonify({"db": min(db, 100.0)})
    except Exception as e:
        print(f"Error processing audio: {e}")
        return jsonify({"error": str(e)}), 500

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


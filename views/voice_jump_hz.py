from flask import Blueprint, request, jsonify, render_template
import numpy as np
import pyworld as pw

voice_jump_hz_bp = Blueprint('voice_jump_hz', __name__, template_folder='../templates')

@voice_jump_hz_bp.route('/process_audio', methods=['POST'])
def process_audio():
    try:
        audio_data = request.files['audio'].read()  # バイナリデータを取得
        sample_rate = int(request.form['sample_rate'])  # サンプリングレートを取得

        float32_array = np.frombuffer(audio_data, dtype=np.float32)
        float64_array = float32_array.astype(np.float64)

        # 最低0.2秒分のデータを確保
        min_samples = int(sample_rate * 0.2)  # 0.2秒分
        if len(float64_array) < min_samples:
            padding = np.zeros(min_samples - len(float64_array))
            float64_array = np.concatenate((float64_array, padding))

        # pyworld.dio() のframe_periodを適切に設定
        frame_period = 1000 * (1024 / sample_rate)  # フレーム周期を計算
        _f0, _ = pw.dio(float64_array, sample_rate, frame_period=frame_period)
        f0 = _f0[_f0 > 0].mean() if len(_f0[_f0 > 0]) > 0 else 0.0

        return jsonify({'frequency': round(f0, 2)})

    except Exception as e:
        print(f"Error processing audio: {e}")
        return jsonify({'error': 'Failed to process audio'}), 500

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

def register_socketio(app_socketio):
    """FlaskのSocket.IOを登録"""
    global socketio
    socketio = app_socketio


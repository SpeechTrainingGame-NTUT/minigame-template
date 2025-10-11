from flask import Blueprint, render_template

# Blueprintの作成
sample_audio_bp = Blueprint('sample_audio', __name__, template_folder='../templates')

@sample_audio_bp.route('/')
def index():
    return render_template('sample.html')

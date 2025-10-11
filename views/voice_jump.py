from flask import Blueprint, render_template

# Blueprintの作成
voice_jump_bp = Blueprint('voice_jump', __name__, template_folder='../templates')

@voice_jump_bp.route('/')
def index():
    return render_template('explain.html')

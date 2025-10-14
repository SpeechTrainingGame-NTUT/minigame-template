from flask import Blueprint, render_template
from flask import request, jsonify
import re
import jaconv
import pyopenjtalk
import pykakasi
import unicodedata

import os
import openai
from flask import current_app

from janome.dic import UserDictionary
from janome.tokenizer import Tokenizer
from flask import make_response

# Blueprintの作成
utterance_check_bp = Blueprint('utterance_check', __name__, template_folder='../templates')

openai.api_key = os.getenv("OPENAI_API_KEY")

# CORS設定
@utterance_check_bp.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response

# ------------------------------------------------------------
# ひらがな化ユーティリティ（英字→“読み”も含めて混在対応）
# ------------------------------------------------------------
LETTER_TO_HIRA = {
    'A':'えー','B':'びー','C':'しー','D':'でぃー','E':'いー','F':'えふ','G':'じー','H':'えいち',
    'I':'あい','J':'じぇー','K':'けー','L':'える','M':'えむ','N':'えぬ','O':'おー','P':'ぴー',
    'Q':'きゅー','R':'あーる','S':'えす','T':'てぃー','U':'ゆー','V':'ぶい','W':'だぶりゅー',
    'X':'えっくす','Y':'わい','Z':'ぜっと'
}
LETTER_TO_HIRA.update({k.lower(): v for k, v in LETTER_TO_HIRA.items()})

def katakana_to_hiragana(s: str) -> str:
    return ''.join(chr(ord(ch)-0x60) if '\u30A1' <= ch <= '\u30F6' else ch for ch in s)

def letters_to_hiragana(s: str) -> str:
    # 1文字ずつ A~Z/a~z を読みへ
    return ''.join(LETTER_TO_HIRA.get(ch, ch) for ch in s)

def to_hiragana_all_mixed(text: str) -> str:
    """
    1) NFKC 正規化（全角英数→半角、濁点結合の正規化 等）
    2) 英字は1文字ずつ “読み”（えー/びー…）へ置換
    3) カタカナがあれば ひらがな化
    4) 残りの漢字・カナ混在は pykakasi で総ひらがな化
    """
    # 1) 正規化
    t = unicodedata.normalize('NFKC', text)
    # 2) 英字の読み化
    t = letters_to_hiragana(t)
    # 3) カタカナ→ひらがな
    t = katakana_to_hiragana(t)
    # 4) 残りをひらがなへ
    kakasi = pykakasi.kakasi()
    hira = ''.join(item['hira'] for item in kakasi.convert(t))
    # 空白整形
    hira = re.sub(r'\s+', ' ', hira).strip()
    return hira

def text_to_phonemes_safe(text: str) -> str:
    try:
        return pyopenjtalk.g2p(text, kana=False) if text else ''
    except Exception:
        current_app.logger.exception("g2p failed")
        return ''

def contains_japanese(text):
    # 漢字・ひらがな・カタカナのいずれかが含まれるか
    return bool(re.search(r'[一-龥ぁ-んァ-ン]', text))

def latin_to_hiragana(text):
    # アルファベット→カタカナ→ひらがな
    katakana = jaconv.alphabet2kana(text)
    hiragana = jaconv.kata2hira(katakana)
    return hiragana

def to_hiragana(text):
    kakasi = pykakasi.kakasi()
    result = kakasi.convert(text)
    hira = "".join([item['hira'] for item in result])
    return hira

# ひらがな変換のエンドポイント
@utterance_check_bp.route('/hiragana', methods=['POST'])
def hiragana():
    try:
        if not request.is_json:
            return jsonify({'error': 'Invalid JSON'}), 400

        raw = request.json.get('text')
        if raw is None:
            return jsonify({'converted': '', 'phonemes': ''}), 200

        text = (request.json.get('text') or '').strip()
        if not text:
            # 200で空変換を返すほうが呼び出し側の処理が安定します
            return jsonify({'converted': '', 'phonemes': ''}), 200

        text = str(raw).strip()
        if not text:
            return jsonify({'converted': '', 'phonemes': ''}), 200

        hira = to_hiragana_all_mixed(text)
        phonemes = text_to_phonemes_safe(hira)

        return jsonify({'converted': hira, 'phonemes': phonemes}), 200
    except Exception:
        current_app.logger.exception("hiragana endpoint crashed")
        return jsonify({'error': 'Failed to convert to Hiragana'}), 500
    
# 仮の単語データ保存
registered_words = []

@utterance_check_bp.route('/save_word', methods=['POST'])
def save_word():
    """単語を保存"""
    global registered_words
    word = request.json.get('word', '').strip()
    if word and word not in registered_words:
        registered_words.append(word)
    return jsonify({'message': 'Word saved successfully', 'words': registered_words})

@utterance_check_bp.route('/get_registered_words', methods=['GET'])
def get_registered_words():
    """登録された単語を取得"""
    return jsonify({'words': registered_words})

# janomeの標準辞書で形態素解析
tokenizer = Tokenizer()

def is_valid_japanese_word(word):
    """
    Janomeの辞書に登録されている単語が1つでも含まれていれば有効とする。
    （存在しない言葉を除外。複数単語や複合語は許可。）
    """
    tokens = list(tokenizer.tokenize(word))
    for token in tokens:
        pos = token.part_of_speech.split(',')
        # 名詞（一般 or 固有名詞）のみ許可
        if pos[0] == '名詞' and (pos[1] == '一般' or pos[1] == '固有名詞'):
            # Janomeの辞書に登録されている単語（base_formが*でない）
            if token.base_form != '*':
                return True
    return False

@utterance_check_bp.route('/generate_word', methods=['POST'])
def generate_word():
    import random

    used_words = request.json.get('usedWords', [])
    recent_words = request.json.get('recentWords', [])

    length_ranges = [(3, 4), (5, 6), (7, 8), (9, 11), (12, 15)]
    range_counts = [
        sum(1 for w in recent_words[-10:] if min_len <= len(w) <= max_len)
        for (min_len, max_len) in length_ranges
    ]

    min_count = min(range_counts)
    candidate_ranges = [r for r, c in zip(length_ranges, range_counts) if c == min_count]
    selected_range = random.choice(candidate_ranges)
    min_len, max_len = selected_range

    prompt = (
        "以下の条件を満たす日本語の単語を1つだけ生成してください：\n"
        f"- 文字数は{min_len}〜{max_len}文字の範囲\n"
        "- 送り仮名や助詞、英語、記号を含まない\n"
        "- ひらがなのみで書く\n"
        "- 意味のある自然な単語にする\n"
        "- 以下の単語とは重複しない："
        + '、'.join(used_words) +
        "\n単語だけを出力。説明や句点、引用符を付けない。"
    )

    fallback_words = ["あさ", "ひかり", "やま", "そら", "はな", "みず", "ことば"]

    try:
        for _ in range(10):  # 最大10回まで再生成
            response = openai.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=20,
                temperature=0.8,
            )
            word = response.choices[0].message.content.strip()
            # 記号除去・正規化
            word = re.sub(r'[^\u3041-\u309F]', '', word)

            if min_len <= len(word) <= max_len and word not in used_words:
                if is_valid_japanese_word(word):
                    hira_word = to_hiragana(word)
                    print('✅ 生成された単語:', hira_word)
                    return jsonify({'word': hira_word}), 200
                else:
                    print('⚠️ Janomeで無効判定:', word)

        # fallback
        fallback = random.choice(fallback_words)
        print('⚠️ fallback単語:', fallback)
        return jsonify({'word': fallback}), 200

    except Exception as e:
        print('❌ OpenAI API error:', e)
        fallback = random.choice(fallback_words)
        return jsonify({'word': fallback, 'error': str(e)}), 200

@utterance_check_bp.route('/')
def index():
    return render_template('check.html')

@utterance_check_bp.route('/word_registration')
def word_registration():
    return render_template('word_registration.html')

@utterance_check_bp.route('/checkA', methods=['GET'])
def check_a():
    return render_template('checkA.html')

@utterance_check_bp.route('/checkB', methods=['GET'])
def check_b():
    return render_template('checkB.html')

@utterance_check_bp.route('/checkA_end', methods=['GET', 'POST'])
def check_a_end():
    correct = request.args.get('correct', 0)
    mistakes = request.args.get('mistakes', 0)
    correctWords = request.args.get('correctWords', '')
    mistakeWords = request.args.get('mistakeWords', '')
    targetCorrect = request.args.get('targetCorrect', 5)

    # ✅ 正しく: 引数をキーワード形式で渡す
    response = make_response(render_template(
        'checkA_end.html',
        correct=correct,
        mistakes=mistakes,
        correctWords=correctWords,
        mistakeWords=mistakeWords,
        targetCorrect=targetCorrect
    ))

    # ✅ キャッシュ防止ヘッダを追加
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'

    return response

@utterance_check_bp.route('/checkB_end', methods=['GET', 'POST'])
def check_b_end():
    correct = request.args.get('correct', 0)
    mistakes = request.args.get('mistakes', 0)
    correctWords = request.args.get('correctWords', '')
    mistakeWords = request.args.get('mistakeWords', '')
    targetCorrect = request.args.get('targetCorrect', 5)
    return render_template('checkB_end.html', correct=correct, mistakes=mistakes, correctWords=correctWords, mistakeWords=mistakeWords, targetCorrect=targetCorrect)
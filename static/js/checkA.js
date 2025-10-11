// === 基本変数 ===
let timeLimit;
let targetCorrect = 0;
let correctAnswers = 0;
let mistakes = 0;
let correctWordsArray = [];
let mistakeWordsArray = [];
let currentWord;
let gameIsOver = false;
let isRecognitionActive = false;
let usedDefaultWords = [];

const WORDS_KEY = 'registeredWords';
let registeredWords = [];

// ==== 英字→ひらがな fallback ====
const LETTER_TO_HIRA = {
  'A':'えー','B':'びー','C':'しー','D':'でぃー','E':'いー','F':'えふ','G':'じー','H':'えいち',
  'I':'あい','J':'じぇー','K':'けー','L':'える','M':'えむ','N':'えぬ','O':'おー','P':'ぴー',
  'Q':'きゅー','R':'あーる','S':'えす','T':'てぃー','U':'ゆー','V':'ぶい','W':'だぶりゅー',
  'X':'えっくす','Y':'わい','Z':'ぜっと'
};
for (const k in LETTER_TO_HIRA) LETTER_TO_HIRA[k.toLowerCase()] = LETTER_TO_HIRA[k];

function katakanaToHiraganaJS(s) {
  return s.replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
function lettersToHiraganaJS(s) {
  return Array.from(s).map(ch => LETTER_TO_HIRA[ch] ?? ch).join('');
}
function toHiraganaClient(text) {
  try {
    let t = text.normalize('NFKC');
    t = lettersToHiraganaJS(t);
    t = katakanaToHiraganaJS(t);
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  } catch(e) { return text; }
}
async function toHiraganaServerOrClient(text) {
  try {
    const res = await fetch('/utterance_check/hiragana', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (res.ok) {
      const j = await res.json();
      const converted = (j && j.converted && j.converted.trim()) ? j.converted : toHiraganaClient(text);
      const phonemes = (j && typeof j.phonemes === 'string') ? j.phonemes : '';
      return { converted, phonemes };
    }
  } catch (e) {}
  return { converted: toHiraganaClient(text), phonemes: '' };
}

// === 音声認識設定 ===
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ja-JP';
recognition.continuous = false;
recognition.interimResults = true;

// === 単語管理 ===
async function getRandomWord() {
  const res = await fetch('/utterance_check/generate_word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usedWords: usedDefaultWords })
  });
  const data = await res.json();
  if (data.word) {
    usedDefaultWords.push(data.word);
    return data.word;
  }
  return "（単語生成失敗）";
}

async function preGenerateWords() {
  preGeneratedWords = [];
  const count = 5;
  showLoading(true);
  for (let i = 0; i < count; i++) {
    const word = await getRandomWord();
    preGeneratedWords.push(word);
  }
  showLoading(false);
}
let preGeneratedWords = [];
let preGenerateIndex = 0;
function getNextWord() {
  if (preGenerateIndex < preGeneratedWords.length)
    return preGeneratedWords[preGenerateIndex++] || "（単語生成失敗）";
  return "（単語がありません）";
}

// === DOMロード ===
document.addEventListener("DOMContentLoaded", function () {
  const timerInput = document.getElementById("timerInput");
  const targetInput = document.getElementById("targetInput");
  const warningMessage = document.getElementById("warning");
  const initialScreen = document.getElementById("initial-screen");
  const playingScreen = document.getElementById("playing-screen");
  const wordDisplay = document.getElementById("wordDisplay");
  const timerDisplay = document.getElementById("timerDisplay");
  const textLog = document.getElementById("textLog");
  const resultElement = document.getElementById("result");
  const phonemeElement = document.getElementById("phoneme");
  const startButton = document.getElementById("start-button");

  if (startButton) {
    startButton.addEventListener('click', async function () {
      const targetValue = parseInt(targetInput.value) || 5;
      const timeValue = parseInt(timerInput.value) || 30;

      if (targetValue > 0 && timeValue > 0) {
        targetCorrect = targetValue;
        timeLimit = timeValue;
        warningMessage.classList.add('hidden');
        initialScreen.classList.add('hidden');
        playingScreen.classList.remove('hidden');
        await preGenerateWords();
        startGame();
      } else {
        warningMessage.classList.remove('hidden');
      }
    });
  }

  async function startGame() {
    currentWord = getNextWord();
    wordDisplay.textContent = currentWord;
    correctAnswers = 0;
    mistakes = 0;
    startRecognition();
    timer();
  }

  async function nextWordAndRecognition() {
    currentWord = getNextWord();
    wordDisplay.textContent = currentWord;
    textLog.textContent = '👂 次の単語を認識中...';
    resultElement.textContent = '';
    phonemeElement.textContent = '';
    startRecognition();
  }

  function startRecognition() {
    try {
      recognition.start();
      textLog.textContent = '🎤 音声を聞き取り中...';
      isRecognitionActive = true;
    } catch (e) {
      console.error("Recognition start error:", e);
    }
  }

  recognition.addEventListener('result', async (event) => {
    const last = event.results.length - 1;
    const transcript = event.results[last][0].transcript.trim();
    if (!transcript) return;

    if (!event.results[last].isFinal) {
      textLog.textContent = `途中認識: ${transcript}`;
      return;
    }

    // Final認識結果
    textLog.textContent = `認識結果: ${transcript}`;
    const recogRes = await toHiraganaServerOrClient(transcript);
    const expectRes = await toHiraganaServerOrClient(currentWord);

    resultElement.textContent = `ひらがな変換結果: ${recogRes.converted}`;
    phonemeElement.textContent = `音素: /${recogRes.phonemes || ''}/`;

    if (recogRes.converted === expectRes.converted) {
      resultElement.textContent += " ✅正解！";
      correctAnswers++;
      correctWordsArray.push(currentWord);
    } else {
      resultElement.textContent += " ❌不正解";
      mistakes++;
      mistakeWordsArray.push(`${transcript} (${currentWord})`);
    }

    // 2秒待って次の単語へ
    setTimeout(() => {
      nextWordAndRecognition();
    }, 2000);
  });

  recognition.addEventListener('start', () => {
    console.log('認識開始');
    isRecognitionActive = true;
    textLog.textContent = '🎙️ 音声認識を開始しました。話してください。';
  });

  recognition.addEventListener('end', () => {
    console.log('認識終了');
    isRecognitionActive = false;
    // 自動で再開
    if (!gameIsOver) {
      setTimeout(() => startRecognition(), 500);
    }
  });

  recognition.addEventListener('error', (e) => {
    console.error('音声認識エラー:', e);
    textLog.textContent = `⚠️ 音声認識エラー: ${e.error}`;
    isRecognitionActive = false;
    setTimeout(() => startRecognition(), 1500);
  });

  function timer() {
    if (timeLimit > 0) {
      timerDisplay.textContent = `Time: ${timeLimit}`;
      timeLimit--;
      setTimeout(timer, 1000);
    } else {
      endGame();
    }
  }

  function endGame() {
    gameIsOver = true;
    recognition.stop();
    const url = new URL('/utterance_check/checkA_end', window.location.origin);
    url.searchParams.append('correct', correctAnswers);
    url.searchParams.append('mistakes', mistakes);
    url.searchParams.append('correctWords', correctWordsArray.join("、"));
    url.searchParams.append('mistakeWords', mistakeWordsArray.join("、"));
    url.searchParams.append('targetCorrect', targetCorrect);
    window.location.href = url.toString();
  }
});

// === ローディング表示 ===
function showLoading(show) {
  let loading = document.getElementById('loading');
  if (!loading) return;
  loading.classList[show ? 'remove' : 'add']('hidden');
}

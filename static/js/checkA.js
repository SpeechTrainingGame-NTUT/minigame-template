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
recognition.interimResults = false;

// === 単語管理 ===
async function getRandomWord(retryCount = 0) {
  try {
    const res = await fetch('/utterance_check/generate_word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usedWords: usedDefaultWords })
    });

    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }

    const data = await res.json();
    if (data.word) {
      usedDefaultWords.push(data.word);
      return data.word;
    }

    if (retryCount < 2) { // 最大3回再試行
      console.warn("再試行中: 単語生成失敗");
      return await getRandomWord(retryCount + 1);
    }

    console.error("単語生成に失敗（最終）:", data.error);
    return "（単語生成失敗）";

  } catch (e) {
    console.error("getRandomWord エラー:", e);
    if (retryCount < 2) {
      return await getRandomWord(retryCount + 1);
    }
    return "（単語生成失敗）";
  }
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

  // ✅ 追加①：「目標の正解数」チェックボックスを単一選択にする
  document.querySelectorAll('input[name="targetCorrect"]').forEach(box => {
    box.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.querySelectorAll('input[name="targetCorrect"]').forEach(other => {
          if (other !== e.target) other.checked = false;
        });
        targetInput.value = ''; // 手動入力欄をリセット
      }
    });
  });

  // ✅ 入力欄に数値を入力した場合、チェックボックスをすべて外す ←★これを追加
  targetInput.addEventListener('input', () => {
    if (targetInput.value.trim() !== '') {
      document.querySelectorAll('input[name="targetCorrect"]').forEach(cb => cb.checked = false);
    }
  });

  // ✅ 追加②：「制限時間」チェックボックスを単一選択にする
  document.querySelectorAll('input[name="timer"]').forEach(box => {
    box.addEventListener('change', (e) => {
      if (e.target.checked) {
        document.querySelectorAll('input[name="timer"]').forEach(other => {
          if (other !== e.target) other.checked = false;
        });
        timerInput.value = ''; // 手動入力欄をリセット
      }
    });
  });

  // ✅ 入力欄に数値を入力した場合、チェックボックスをすべて外す ←★これも追加
  timerInput.addEventListener('input', () => {
    if (timerInput.value.trim() !== '') {
      document.querySelectorAll('input[name="timer"]').forEach(cb => cb.checked = false);
    }
  });

  if (startButton) {
    startButton.addEventListener('click', async function () {
      localStorage.removeItem('phonemeIntensityData');

      const targetValue = parseInt(targetInput.value) ||
        [...document.querySelectorAll('input[name="targetCorrect"]:checked')]
          .map(el => parseInt(el.value))[0] || 5;

      const timeValue = parseInt(timerInput.value) ||
        [...document.querySelectorAll('input[name="timer"]:checked')]
          .map(el => parseInt(el.value))[0] || 30;

      if (targetValue > 0 && timeValue > 0) {

        // ✅ ここでリセットする
        correctAnswers = 0;
        mistakes = 0;
        correctWordsArray = [];
        mistakeWordsArray = [];
        usedDefaultWords = [];
        gameIsOver = false;

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
    
    // 並列で同時にひらがな変換を実行
    const [recogRes, expectRes] = await Promise.all([
      toHiraganaServerOrClient(transcript),
      toHiraganaServerOrClient(currentWord)
    ]);

    resultElement.textContent = `ひらがな変換結果: ${recogRes.converted}`;
    phonemeElement.textContent = `音素: /${recogRes.phonemes || ''}/`;

    if (recogRes.converted === expectRes.converted) {
      resultElement.textContent += " ✅正解！";
      correctAnswers++;
      correctWordsArray.push(currentWord);
    } else {
      resultElement.textContent += " ❌不正解";
      mistakes++;
      mistakeWordsArray.push(`${transcript} (${currentWord})`           );
    }

    // === 音素強度データを localStorage に保存 ===
    try {
      const allData = JSON.parse(localStorage.getItem('phonemeIntensityData') || '[]');
      const record = {
        word: currentWord,                   // 出題された単語
        recognized: transcript,              // 認識された単語
        correctAnswer: (recogRes.converted === expectRes.converted),
        phonemesExpected: expectRes.phonemes || '',
        phonemesRecognized: recogRes.phonemes || '',
        confidence: event.results[last][0].confidence || 0, // SpeechRecognitionの信頼度
        phonemeIntensities: [],              // 今は空。将来的に強度値を入れるならここに追加
        intensity: 0.5                       // 仮の平均値
      };
      allData.push(record);
      localStorage.setItem('phonemeIntensityData', JSON.stringify(allData));
    } catch (err) {
      console.error('phonemeIntensityData 保存エラー:', err);
    }

    recognition.stop();
  });

  recognition.addEventListener('start', () => {
    console.log('認識開始');
    isRecognitionActive = true;
    textLog.textContent = '🎙️ 音声認識を開始しました。話してください。';
  });

  recognition.addEventListener('end', async () => {
    console.log('認識終了');
    isRecognitionActive = false;
    // 自動で再開
    if (!gameIsOver) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      nextWordAndRecognition();  // end後に次の単語を出して再スタート
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
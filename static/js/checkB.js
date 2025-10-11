// 音声認識設定
let targetCorrect = 0;
let correctAnswers = 0;
let mistakes = 0;
let correctWordsArray = [];
let mistakeWordsArray = [];
let phonemeIntensityData = []; // 音素強度データを保存
let currentWord;
let gameIsOver = false;
let isRecognitionActive = false;
let usedDefaultWords = []; // デフォルト単語の出題履歴

const WORDS_KEY = 'registeredWords';
let registeredWords = [];

// ==== 追加：フロント側の“英字→ひらがな読み”フォールバック ====
const LETTER_TO_HIRA = {
  'A':'えー','B':'びー','C':'しー','D':'でぃー','E':'いー','F':'えふ','G':'じー','H':'えいち',
  'I':'あい','J':'じぇー','K':'けー','L':'える','M':'えむ','N':'えぬ','O':'おー','P':'ぴー',
  'Q':'きゅー','R':'あーる','S':'えす','T':'てぃー','U':'ゆー','V':'ぶい','W':'だぶりゅー',
  'X':'えっくす','Y':'わい','Z':'ぜっと'
};
for (const k of Object.keys(LETTER_TO_HIRA)) {
  LETTER_TO_HIRA[k.toLowerCase()] = LETTER_TO_HIRA[k];
}
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
  } catch(e) {
    return text;
  }
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
      const phonemes  = (j && typeof j.phonemes === 'string') ? j.phonemes : '';
      return { converted, phonemes };
    }
  } catch (e) {}
  return { converted: toHiraganaClient(text), phonemes: '' };
}

// Web Speech API
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ja-JP';

function loadRegisteredWords() {
    registeredWords = JSON.parse(localStorage.getItem('registeredWords')) || [];
    console.log("Loaded registered words (localStorage):", registeredWords);

}

async function getRandomWord() {
    const wordType = document.querySelector('input[name="wordType"]:checked').value;

    if (wordType === 'registered') {
        if (registeredWords.length === 0) {
            alert('単語リストが空です。');
            return "N/A";
        }
        let pool = registeredWords.filter(w => !correctWordsArray.includes(w));
        if (pool.length === 0) return "N/A";
        return pool[Math.floor(Math.random() * pool.length)];
    } else if (wordType === 'default') {
        let nextWord = '';
        for (let retry = 0; retry < 10; retry++) {
            const res = await fetch('/utterance_check/generate_word', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({usedWords: usedDefaultWords})
            });
            const data = await res.json();
            if (data.word && !usedDefaultWords.includes(data.word)) {
                nextWord = data.word;
                break;
            }
        }
        if (!nextWord) {
            alert('新しい単語が取得できませんでした。');
            return "N/A";
        }
        usedDefaultWords.push(nextWord);
        return nextWord;
    } else if (wordType === 'both') {
        // 登録単語＋デフォルト単語両方で重複管理
        let allUsed = [...usedDefaultWords, ...registeredWords];
        let nextWord = '';
        for (let retry = 0; retry < 10; retry++) {
            const res = await fetch('/utterance_check/generate_word', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({usedWords: allUsed})
            });
            const data = await res.json();
            if (data.word && !allUsed.includes(data.word)) {
                nextWord = data.word;
                break;
            }
        }
        if (!nextWord) {
            alert('新しい単語が取得できませんでした。');
            return "N/A";
        }
        usedDefaultWords.push(nextWord);
        return nextWord;
    }
}

function getRequiredWordCount() {
    const target = Number(document.querySelector('input[name="targetCorrect"]:checked')?.value) ||
                   Number(document.getElementById('targetInput').value) || 10;
    return target + 3;
}

let preGeneratedWords = [];
let preGenerateIndex = 0;

async function preGenerateWords() {
    preGeneratedWords = [];
    preGenerateIndex = 0;
    const count = getRequiredWordCount();
    showLoading(true);
    for (let i = 0; i < count; i++) {
        try {
            const word = await getRandomWord();
            preGeneratedWords.push(word);
        } catch (e) {
            preGeneratedWords.push('');
        }
    }
    showLoading(false);
}

function getNextWord() {
    if (preGenerateIndex < preGeneratedWords.length) {
        return preGeneratedWords[preGenerateIndex++] || "（単語生成失敗）";
    }
    return "（単語がありません）";
}

document.addEventListener("DOMContentLoaded", function () {
    const targetInput = document.getElementById("targetInput");
    const warningMessage = document.getElementById("warning");
    const initialScreen = document.getElementById("initial-screen");
    const playingScreen = document.getElementById("playing-screen");
    const wordDisplay = document.getElementById("wordDisplay");
    const textLog = document.getElementById("textLog");
    const resultElement = document.getElementById("result");
    const startButton = document.getElementById('start-button');
    const loadingDiv = document.getElementById('loading');

    loadRegisteredWords();

    if (startButton) {
        startButton.addEventListener('click', async function () {
            //await fetchRegisteredWords();

            const enteredTarget = parseInt(targetInput.value) || 0;
            const selectedTarget = document.querySelector('input[name="targetCorrect"]:checked');
            const targetValue = enteredTarget > 0 ? enteredTarget : (selectedTarget ? parseInt(selectedTarget.value) : 0);

            if (targetValue > 0) {
                targetCorrect = targetValue;

                startButton.style.display = 'none';

                // 画面遷移を先に行う
                warningMessage.classList.add('d-none');
                initialScreen.classList.add('d-none');
                playingScreen.classList.remove('d-none');

                // ローディング表示
                showLoading(true);

                // 単語生成
                await preGenerateWords();

                // ローディング非表示
                showLoading(false);

                // ゲーム開始
                startGame();
            } else {
                warningMessage.classList.remove('d-none');
                warningMessage.textContent = "目標の正解数を設定してください。";
            }
        });
    } else {
        console.error('Start button not found');
    }

    async function startGame() {
        loadingDiv && (loadingDiv.style.display = 'flex');
        currentWord = getNextWord();
        loadingDiv && (loadingDiv.style.display = 'none');
        wordDisplay.textContent = currentWord;
        correctAnswers = 0;
        mistakes = 0;
        startRecognition();
    }

    async function nextWordAndRecognition() {
        loadingDiv.classList.remove('hidden'); // ローディング表示を即時ON
        currentWord = await getRandomWord();
        wordDisplay.textContent = currentWord;
        textLog.textContent = '';
        resultElement.textContent = '';
        loadingDiv.classList.add('hidden'); // 単語取得後すぐ非表示
        isRecognitionActive = false;
        startRecognition(); // setTimeoutなしで即時再開
    }

    async function startRecognition() {
        if (!isRecognitionActive) {
            try {
                console.log('Starting recognition...');
                recognition.start();
                isRecognitionActive = true; // 状態を更新
            } catch (error) {
                console.error('Error starting speech recognition:', error);
            }
        }
    }

    // ==== ここを差し替え（サーバ優先＋クライアントフォールバックで必ずひらがな化）====
    recognition.addEventListener('result', async (event) => {
        if (!event.results || !event.results[0].isFinal) return;
        const transcript = event.results[0][0].transcript.trim();
        if (!transcript) return;

        // 音素強度データ用（信頼度）
        const confidence = event.results[0][0].confidence || 0.5;

        // ひらがな & 音素（サーバ→失敗時はフロント）
        const recogRes = await toHiraganaServerOrClient(transcript);
        if (!recogRes.converted || recogRes.converted.trim()==='') {
            resultElement.textContent = "無効な認識結果です。もう一度試してください。";
            return;
        }

        // 期待側（出題語）も同様に統一
        const expectRes = await toHiraganaServerOrClient(currentWord);

        resultElement.textContent = `ひらがな変換結果: ${recogRes.converted} 音素: /${recogRes.phonemes || ''}/`;

        // 音素別強度
        const perPhoneme = calculatePhonemeIntensityByPhoneme(recogRes.phonemes, confidence);

        // 類似ペア（期待→認識）
        const expArr = (expectRes.phonemes || '').split(' ').filter(Boolean);
        const recArr = (recogRes.phonemes || '').split(' ').filter(Boolean);
        const similarPairs = bestSimilarPairs(expArr, recArr);

        // 音素強度データを保存
        const phonemeData = {
            word: wordDisplay.textContent,
            recognized: recogRes.converted,
            phonemesRecognized: recogRes.phonemes,
            phonemesExpected: expectRes.phonemes,
            confidence,
            phonemeIntensities: perPhoneme,
            similarPairs,
            timestamp: new Date().toISOString(),
            correctAnswer: recogRes.converted === wordDisplay.textContent
        };
        phonemeIntensityData.push(phonemeData);

        // 判定処理
        if (phonemeData.correctAnswer) {
            resultElement.textContent += " 正解！";
            correctAnswers++;
            correctWordsArray.push(wordDisplay.textContent);
            // 即時で次の問題へ
            await nextWordAndRecognition();
        } else {
            resultElement.textContent += " 残念！";
            mistakes++;
            mistakeWordsArray.push(`${transcript} (${wordDisplay.textContent})`);
            // 即時で終了
            endGame();
        }
    })

    recognition.addEventListener('end', () => {
        isRecognitionActive = false;
        if (!gameIsOver) {
            startRecognition();
        }
    });

    recognition.addEventListener('error', (event) => {
        isRecognitionActive = false;
        if (!gameIsOver) {
            startRecognition();
        }
    });

    function endGame() {
        gameIsOver = true;
        recognition.stop();

        // 音素強度データをlocalStorageに保存
        localStorage.setItem('phonemeIntensityData', JSON.stringify(phonemeIntensityData));

        const url = new URL('/utterance_check/checkB_end', window.location.origin);
        url.searchParams.append('correct', correctAnswers);
        url.searchParams.append('mistakes', mistakes);
        url.searchParams.append('correctWords', correctWordsArray.join("、"));
        url.searchParams.append('mistakeWords', mistakeWordsArray.join("、"));
        url.searchParams.append('targetCorrect', targetCorrect);
        window.location.href = url.toString();
    }
});

function showLoading(show) {
    let loading = document.getElementById('loading');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading';
        loading.style.position = 'fixed';
        loading.style.top = '0';
        loading.style.left = '0';
        loading.style.width = '100vw';
        loading.style.height = '100vh';
        loading.style.background = 'rgba(255,255,255,0.8)';
        loading.style.zIndex = '9999';
        loading.style.display = 'flex';
        loading.style.alignItems = 'center';
        loading.style.justifyContent = 'center';
        loading.style.fontSize = '2rem';
        loading.innerText = '単語を生成中です。しばらくお待ちください...';
        document.body.appendChild(loading);
    }
    loading.style.display = show ? 'flex' : 'none';
}

// （※ この下の targetInput のリスナーは既存のまま残しています）
document.querySelectorAll('input[name="targetCorrect"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            targetInput.value = '';
        }
    });
});

targetInput.addEventListener('input', () => {
    if (targetInput.value) {
        document.querySelectorAll('input[name="targetCorrect"]').forEach((checkbox) => {
            checkbox.checked = false;
        });
    }
});

function fetchRegisteredWords() {
    return fetch('/utterance_check/get_registered_words')
    .then(response => response.json())
    .then(data => {
        registeredWords = data.words || [];
        console.log('Fetched registered words:', registeredWords);
    })
    .catch(error => console.error('Error fetching registered words:', error));
}

function calculatePhonemeIntensityByPhoneme(phonemes, confidence) {
    if (!phonemes || !phonemes.trim()) return [];

    const pList = phonemes.split(' ').filter(Boolean);

    const isIn = (set, p) => set.includes(p);

    const VOWELS = ['a','i','u','e','o'];
    const PLOSIVES = ['k','g','t','d','p','b'];
    const FRICATIVES = ['s','sh','h','f','z','j'];
    const NASALS_LIQ = ['n','m','r','y','w'];
    // よく出る特殊記号（無音・ポーズ・促音）
    const SPECIAL_WEAK = ['cl','pau','sil','q','N'];

    const WEIGHTS = {
      vowel: 0.80,
      plosive: 0.90,
      fricative: 0.70,
      nasal_liq: 0.55,
      special: 0.35,
      other: 0.50
    };

    const results = [];
    for (const p of pList) {
        let base = WEIGHTS.other;
        if (isIn(VOWELS, p)) base = WEIGHTS.vowel;
        else if (isIn(PLOSIVES, p)) base = WEIGHTS.plosive;
        else if (isIn(FRICATIVES, p)) base = WEIGHTS.fricative;
        else if (isIn(NASALS_LIQ, p)) base = WEIGHTS.nasal_liq;
        else if (isIn(SPECIAL_WEAK, p)) base = WEIGHTS.special;

        // confidence で線形補正（0.3 を“安全側”の下駄に）
        let val = base * confidence + (1 - confidence) * 0.3;
        val = Math.max(0.2, Math.min(1.0, val));

        results.push({ phoneme: p, intensity: val });
    }
    return results;
}

// ==== 追加: 音素類似度（0〜1）====
// 簡易な調音特徴ベクトルでコサイン類似度近似
function phonemeFeature(p) {
    // features: [vowel, plosive, fricative, nasal, liquid, glide, voiced, coronal, dorsal, labial]
    // ※ pyopenjtalk の主な記号をカバー（必要に応じて拡張）
    const base = {v:0, pl:0, fr:0, na:0, li:0, gl:0, vd:0, co:0, do:0, la:0};
    const set = (k) => (base[k]=1);
    const voiced = (p) => ['g','d','b','z','j','m','n','r','y','w','N'].includes(p);

    if (['a','i','u','e','o'].includes(p)) { set('v'); base.vd=1; return [1,0,0,0,0,0,1,0,0,0]; }

    if (['k','g'].includes(p)) { set('pl'); base.do=1; base.vd = p==='g'?1:0; return [0,1,0,0,0,0,base.vd,0,1,0]; }
    if (['t','d'].includes(p)) { set('pl'); base.co=1; base.vd = p==='d'?1:0; return [0,1,0,0,0,0,base.vd,1,0,0]; }
    if (['p','b'].includes(p)) { set('pl'); base.la=1; base.vd = p==='b'?1:0; return [0,1,0,0,0,0,base.vd,0,0,1]; }

    if (['s','z','sh','j','h','f'].includes(p)) {
        set('fr');
        if (['s','z'].includes(p)) base.co=1;
        if (['sh','j'].includes(p)) base.co=1;
        if (p==='h') base.gl=1; // 便宜上
        if (p==='f') base.la=1;
        base.vd = ['z','j'].includes(p)?1:0;
        return [0,0,1,0,0,0,base.vd,base.co,0,base.la];
    }

    if (['m'].includes(p)) { set('na'); base.la=1; base.vd=1; return [0,0,0,1,0,0,1,0,0,1]; }
    if (['n','N'].includes(p)) { set('na'); base.co=1; base.vd=1; return [0,0,0,1,0,0,1,1,0,0]; }

    if (['r'].includes(p)) { set('li'); base.co=1; base.vd=1; return [0,0,0,0,1,0,1,1,0,0]; }
    if (['y','w'].includes(p)) { set('gl'); base.vd=1; base.co = (p==='y')?1:0; base.la=(p==='w')?1:0; return [0,0,0,0,0,1,1,base.co,0,base.la]; }

    // 無音・ポーズ・促音など
    if (['cl','pau','sil','q'].includes(p)) { return [0,0,0,0,0,0,0,0,0,0]; }

    // 既定
    return [0,0,0,0,0,0,0,0,0,0];
}

function cosineSim(a,b){
    let dot=0,na=0,nb=0;
    for(let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
    if (na===0 || nb===0) return 0;
    return dot / (Math.sqrt(na)*Math.sqrt(nb));
}

// 期待配列 exp[] と 認識配列 rec[] の間で、各 exp に最も似てる rec を取る
function bestSimilarPairs(expArr, recArr) {
    const pairs = [];
    for (const e of expArr) {
        let best = {match:null, score:0};
        const fe = phonemeFeature(e);
        for (const r of recArr) {
            const fr = phonemeFeature(r);
            const s = cosineSim(fe, fr);
            if (s > best.score) best = {match:r, score:s};
        }
        pairs.push({ expected: e, matched: best.match, score: +best.score.toFixed(2) });
    }
    return pairs;
}

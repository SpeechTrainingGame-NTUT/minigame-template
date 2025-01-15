// 音声認識設定
let timeLimit;
let targetCorrect = 0;
let correctAnswers = 0;
let mistakes = 0;
let correctWordsArray = [];
let mistakeWordsArray = [];
let currentWord;
let gameIsOver = false;
let isRecognitionActive = false; // 音声認識がアクティブかどうかを示すフラグ

// ローカルストレージキー
const WORDS_KEY = 'registeredWords';

// 登録単語を格納する変数
let registeredWords = [];

// 音声認識の初期化
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ja-JP';

// ローカルストレージから登録単語を読み込む
function loadRegisteredWords() {
    registeredWords = JSON.parse(localStorage.getItem(WORDS_KEY)) || [];
    console.log("Loaded registered words:", registeredWords);
}

function getRandomWord() {
    const wordType = document.querySelector('input[name="wordType"]:checked').value;
    const defaultWords = [
        "かきごおり", "きんぎょ", "はれ", "おと", "かぜ", "みみ", "なつ", "うちわ", "ちゃわん", "きせつ",
        "きもの", "みどり", "ちず", "ぼうけん", "ぶんか", "ゆうやけ", "へいわ", "しぜん", "まほう", "りそう",
        "つくえ", "でんわ", "かぞく", "ほしぞら", "さくら", "やま", "ほん", "そら", "ゆめ", "えがお",
        "おもいで", "つき", "ひこうき", "えいが", "せかい", "かんじょう", "れすとらん", "りょこう", "ちへいせん", "かなしみ",
        "いつわり", "まつり", "にちじょう", "うんめい", "かたち", "きぼう", "まさちゅーせっつしゅう", "しゅんかん", "ぎゃっきょう",
        "いかり", "へいわ", "ほのお", "そうげん", "ひびき", "こうしょきょうふしょう", "ひみつ", "どりょく", "はんだん", "こころ", "ゆうじょう",
        "やわらかい", "つよい", "とうめい", "やさしい", "かいてき", "うつくしい", "まばら", "たんじゅん", "うそ", "あんぜんちたい", 
        "へんか", "あんてい", "せいちょう", "なみだ", "ぶんしょう", "かぞく", "とりざたされる", "たいよう", "ちゃれんじ", "きょうだい",
        "うちゅう", "いっしょうけんめい", "とり", "しばふ", "どうろ", "しゃしん", "はなび", "まじめ", "いっきょりょうとく", "くうぜんぜつご",
        "しんきいってん", "ぶんぶりょうどう", "べんきょう", "れきし", "あめりか", "ちょうしょく", "さんぽ", "じんじゃ", "しんじつ",
        "ゆだんたいてき", "りんきおうへん", "さかもとりょうま", "にほんこくけんぽう", "こじんじょうほうほごほう", "そういくふう", "りろせいぜん", "しゅしゃせんたく", "れんたいせきにん", "ろうにゃくなんにょ"
    ];
    
    let wordPool = [];
    if (wordType === 'registered') {
        wordPool = registeredWords;
    } else if (wordType === 'default') {
        wordPool = defaultWords;
    } else if (wordType === 'both') {
        wordPool = [...defaultWords, ...registeredWords];
    }

    if (wordPool.length === 0) {
        alert('単語リストが空です。');
        return "N/A";
    }

    return wordPool[Math.floor(Math.random() * wordPool.length)];
}

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

    const startButton = document.getElementById('start-button');

    loadRegisteredWords(); // 登録単語をロード

    if (startButton) {
        startButton.addEventListener('click', async function () {
            await fetchRegisteredWords(); // 登録単語を取得

            const selectedTarget = document.querySelector('input[name="targetCorrect"]:checked');
            const selectedTime = document.querySelector('input[name="timer"]:checked');
            
            const enteredTarget = parseInt(targetInput.value) || 0;
            const enteredTime = parseInt(timerInput.value) || 0;

            // 入力欄が空の場合、チェック欄の値を使用する
            const targetValue = enteredTarget > 0 ? enteredTarget : (selectedTarget ? parseInt(selectedTarget.value) : 0);
            const timeValue = enteredTime > 0 ? enteredTime : (selectedTime ? parseInt(selectedTime.value) : 0);

            // 両方の値を確認してエラーメッセージを表示
            if (targetValue > 0 && timeValue > 0) {
                targetCorrect = targetValue;
                timeLimit = timeValue;

                // ゲーム画面を表示
                initialScreen.classList.add('hidden');
                playingScreen.classList.remove('hidden');
                startGame();            

            } else {
                warningMessage.classList.remove('hidden');
            }
        });
    } else {
        console.error('Start button not found');
    }

    function startGame() {
        currentWord = getRandomWord();
        wordDisplay.textContent = currentWord;
        correctAnswers = 0;
        mistakes = 0;
        timerDisplay.textContent = "Time: " + timeLimit;
        startRecognition(); // 音声認識を開始
        timer();
    }

    function startRecognition() {
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

    recognition.addEventListener('result', (event) => {
        if (!event.results || !event.results[0].isFinal) {
            console.warn('Interim or empty result, ignoring...');
            return; // 中間結果や無効な結果を無視
        }

        const transcript = event.results[0][0].transcript.trim();
        if (!transcript) {
            console.warn('Empty transcript, ignoring...');
            return; // 空のテキストを無視
        }

        console.log('Recognized text:', transcript);

        // サーバーにリクエストを送信して、ひらがなと音素に変換
        fetch('/utterance_check/hiragana', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: transcript })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.converted || data.converted.trim() === '') {
                console.error('Empty conversion result:', data);
                resultElement.textContent = "無効な認識結果です。もう一度試してください。";
                return;
            }
            resultElement.textContent = `ひらがな変換結果: ${data.converted} 音素: /${data.phonemes}/`;

            // 判定処理
            if (data.converted === wordDisplay.textContent) {
                resultElement.textContent += " 正解！";
                correctAnswers++;
                correctWordsArray.push(wordDisplay.textContent);
            } else {
                resultElement.textContent += " 残念！";
                mistakes++;
                mistakeWordsArray.push(`${transcript} (${wordDisplay.textContent})`);
            }

            // 次の単語に進む
            currentWord = getRandomWord();
            wordDisplay.textContent = currentWord;
            textLog.textContent = '';
            isRecognitionActive = false;
        })
        .catch(error => {
            console.error('Fetch error:', error);
            resultElement.textContent = `エラー: ${error.message}`;
        });
    });

    recognition.addEventListener('end', () => {
        console.log('Recognition ended. Restarting...');
        isRecognitionActive = false; // 状態をリセット
        if (!gameIsOver) {
            startRecognition(); // 再起動
        }
    });

    recognition.addEventListener('error', (event) => {
        console.error('Speech recognition error:', event.error);
        isRecognitionActive = false;
        if (!gameIsOver) {
            startRecognition(); // エラー後の再起動
        }
    });

    function timer() {
        if (timeLimit > 0) {
            timeLimit--;
            timerDisplay.textContent = "Time: " + timeLimit;
            setTimeout(timer, 1000);
        } else {
            endGame();
        }
    }

    function endGame() {
        gameIsOver = true;
        recognition.stop(); // 音声認識を停止
        const url = new URL('/utterance_check/checkA_end', window.location.origin);
        url.searchParams.append('correct', correctAnswers);
        url.searchParams.append('mistakes', mistakes);
        url.searchParams.append('correctWords', correctWordsArray.join("、"));
        url.searchParams.append('mistakeWords', mistakeWordsArray.join("、"));
        url.searchParams.append('targetCorrect', targetCorrect);
        window.location.href = url.toString();
    }
});

document.querySelectorAll('input[name="targetCorrect"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            targetInput.value = ''; // 入力欄をクリア
        }
    });
});

document.querySelectorAll('input[name="timer"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
            timerInput.value = ''; // 入力欄をクリア
        }
    });
});

targetInput.addEventListener('input', () => {
    if (targetInput.value) {
        document.querySelectorAll('input[name="targetCorrect"]').forEach((checkbox) => {
            checkbox.checked = false; // チェックを外す
        });
    }
});

timerInput.addEventListener('input', () => {
    if (timerInput.value) {
        document.querySelectorAll('input[name="timer"]').forEach((checkbox) => {
            checkbox.checked = false; // チェックを外す
        });
    }
});

// ローカルストレージから登録単語を読み込む
function loadRegisteredWords() {
    registeredWords = JSON.parse(localStorage.getItem(WORDS_KEY)) || [];
    console.log("Loaded registered words:", registeredWords);
}

function fetchRegisteredWords() {
    return fetch('/get_registered_words')
    .then(response => response.json())
    .then(data => {
        registeredWords = data.words || [];
        console.log('Fetched registered words:', registeredWords);
    })
    .catch(error => console.error('Error fetching registered words:', error));
}
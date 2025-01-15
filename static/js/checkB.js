// 音声認識設定
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
    // ラジオボタンの選択を確認
    const selectedRadio = document.querySelector('input[name="wordType"]:checked');
    
    // 選択されていない場合、エラーを防ぐために警告を表示して終了
    if (!selectedRadio) {
        alert('単語の種類を選択してください。');
        return "N/A"; // 処理を終了して安全な値を返す
    }

    // 選択されている場合、値を取得
    const wordType = selectedRadio.value;

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
    const targetInput = document.getElementById("targetInput");
    const warningMessage = document.getElementById("warning");
    const initialScreen = document.getElementById("initial-screen");
    const playingScreen = document.getElementById("playing-screen");
    const wordDisplay = document.getElementById("wordDisplay");
    const textLog = document.getElementById("textLog");
    const resultElement = document.getElementById("result");

    const startButton = document.getElementById('start-button');

    loadRegisteredWords(); // 登録単語をロード

    if (startButton) {
        startButton.addEventListener('click', async function () {
            // 単語の種類が選択されているかを確認
            const selectedRadio = document.querySelector('input[name="wordType"]:checked');
            if (!selectedRadio) {
                alert('単語の種類を選択してください。');
                return; // 処理を終了してエラーを防止
            }

            const wordType = selectedRadio.value;
            console.log('Selected word type:', wordType);

            await fetchRegisteredWords(); // 登録単語を取得

            // 目標の正解数のチェック
            const enteredTarget = parseInt(targetInput.value) || 0;
            const selectedTarget = document.querySelector('input[name="targetCorrect"]:checked');

            // 目標の正解数を取得（選択または入力値）
            const targetValue = enteredTarget > 0 ? enteredTarget : (selectedTarget ? parseInt(selectedTarget.value) : 0);

            // 両方の値を確認してエラーメッセージを表示
            if (targetValue > 0) {
                targetCorrect = targetValue;

                // 注意書きを非表示にしてゲームを開始
                warningMessage.classList.add('d-none');
                initialScreen.classList.add('d-none');
                playingScreen.classList.remove('d-none');
                startGame();            

            } else {
                warningMessage.classList.remove('d-none');
                warningMessage.textContent = "目標の正解数を設定してください。";
            }
        });
    } else {
        console.error('Start button not found');
    }

    function startGame() {
        currentWord = getRandomWord();
        console.log('Current word:', currentWord); // 出題された単語をログに表示
        wordDisplay.textContent = currentWord;
        console.log('Updated wordDisplay:', wordDisplay.textContent); // DOMが正しく更新されたか確認
        correctAnswers = 0;
        mistakes = 0;
        startRecognition(); // 音声認識を開始
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
        console.log('Recognition result event:', event); // デバッグ用ログ
        if (!event.results || !event.results[0].isFinal) {
            console.warn('Interim or empty result, ignoring...');
            return; // 中間結果や無効な結果を無視
        }

        const transcript = event.results[0][0].transcript.trim();
        console.log('Recognized transcript:', transcript); // 認識されたテキストをログ出力

        if (!transcript) {
            console.warn('Empty transcript, ignoring...');
            return; // 空のテキストを無視
        }

        // サーバーにリクエストを送信して、ひらがなと音素に変換
        fetch('/utterance_check/hiragana', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: transcript })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Server response:', data); // サーバーレスポンスを確認
            if (!data.converted || data.converted.trim() === '') {
                console.error('Empty conversion result:', data);
                resultElement.textContent = "無効な認識結果です。もう一度試してください。";
                return;
            }
            resultElement.textContent = `ひらがな変換結果: ${data.converted} 音素: /${data.phonemes}/`;

            // 判定処理
            if (data.converted === wordDisplay.textContent) {
                console.log('Match! Correct answer.');
                resultElement.textContent += " 正解！";
                correctAnswers++;
                correctWordsArray.push(wordDisplay.textContent);
            } else {
                console.log('No match. Expected:', wordDisplay.textContent, 'Got:', data.converted);
                resultElement.textContent += " 残念！";
                mistakes++;
                mistakeWordsArray.push(`${transcript} (${wordDisplay.textContent})`);
                endGame();
            }

            // 次の単語に進む
            currentWord = getRandomWord();
            console.log('Next word:', currentWord); // 次の単語をログ表示
            wordDisplay.textContent = currentWord;
            console.log('Updated wordDisplay:', wordDisplay.textContent); // DOMが正しく更新されたか確認
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

    function endGame() {
        gameIsOver = true;
        recognition.stop(); // 音声認識を停止
        const url = new URL('/utterance_check/checkB_end', window.location.origin);
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

targetInput.addEventListener('input', () => {
    if (targetInput.value) {
        document.querySelectorAll('input[name="targetCorrect"]').forEach((checkbox) => {
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
const canvas = document.getElementById('gameCanvas'); // ゲーム用のキャンバス要素を取得
const ctx = canvas.getContext('2d'); // キャンバスの 2D コンテキストを取得
const volumeBar = document.getElementById('volume-bar'); // 音量バー要素を取得

// プレイヤーの初期化
const player = {
    x: 0,  // 足場の少し前に配置
    y: 0,   // 初期化時に足場の上に配置
    width: 20, // プレイヤーの幅を 20 に設定
    height: 20, // プレイヤーの高さを 20 に設定
    speed: 10, // プレイヤーの速度を 10 に設定
    jumpPower: 14, // ジャンプをの強さを 14 に設定
    dy: 0, // プレイヤーの y 方向の速度を 0 に設定
    onGround: true // プレイヤーが地面にいるかどうかを true に設定
};

const gravity = 0.5; // 重力を 0.5 に設定
const platforms = [{ x: 0, y: 220, width: 1000, height: 1000 }]; // 足場の初期化
let goal = { x: 780, y: 200, width: 20, height: 20 }; // ゴールの初期化
let gameRunning = false; // ゲームが実行中かどうかを false に設定

let startTime;
let coinScore = 0;
let collectedCoins = { red: 0, blue: 0, yellow: 0 };

// コインの配置
let coinData = [
    { x: 230, y: 60, radius: 8, color: 'red', points: 30 },
    { x: 330, y: 40, radius: 8, color: 'red', points: 30 },

    { x: 500, y: 30, radius: 8, color: 'blue', points: 20 },
    { x: 650, y: 80, radius: 8, color: 'blue', points: 20 },

    { x: 150, y: 150, radius: 8, color: 'yellow', points: 10 },
    { x: 70, y: platforms[0].y - 8, radius: 8, color: 'yellow', points: 10 },
    { x: 280, y: platforms[0].y - 8, radius: 8, color: 'yellow', points: 10 },
    { x: 400, y: platforms[0].y - 8, radius: 8, color: 'yellow', points: 10 },
    { x: 600, y: platforms[0].y - 8, radius: 8, color: 'yellow', points: 10 },
    { x: 700, y: platforms[0].y - 8, radius: 8, color: 'yellow', points: 10 }
];

// dB のしきい値
const jumpThreshold = 70;
const moveThreshold = 30;

// プレイヤーを描画する関数
function drawPlayer() {
    ctx.fillStyle = 'blue';
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

// 足場を描画する関数
function drawPlatforms() {
    ctx.fillStyle = 'black';
    platforms.forEach(platform => {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });
}

// ゴールを描画する関数
function drawGoal() {
    ctx.fillStyle = 'red';
    ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
}

// コインを描画する関数
function drawCoins() {
    coinData.forEach(coin => {
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
        ctx.fillStyle = coin.color;
        ctx.fill();
        ctx.closePath();
    });
}

// プレイヤーの位置を更新する関数
function updatePlayer() {
    if (!gameRunning) return; // ゲームが実行中でない場合は処理を終了
    
    player.y += player.dy; // プレイヤーの y 座標に速度を加算

    if (!player.onGround) {
        player.dy += gravity; // プレイヤーが地面にいない場合は重力を適用
    }

    let onAnyPlatform = false;
    platforms.forEach(platform => {
        if (
            player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height >= platform.y &&
            player.y + player.height <= platform.y + 10
        ) {
            player.y = platform.y - player.height;
            player.dy = 0;
            player.onGround = true;
            onAnyPlatform = true;
        }
    });

    if (!onAnyPlatform && player.y + player.height < canvas.height) {
        player.onGround = false;
    }

    if (player.y + player.height > canvas.height) {
        player.y = canvas.height - player.height;
        player.dy = 0;
        endGame(false);
    }

    if (player.y + player.height < 0) {
        player.y = 0;
        player.dy = 0;
    }

    if (
        player.x < goal.x + goal.width &&
        player.x + player.width > goal.x &&
        player.y + player.height > goal.y &&
        player.y < goal.y + goal.height
    ) {
        endGame(true);
    }

    if (player.x > goal.x + goal.width) {
        endGame(false);
    }

    checkCoinCollision();
}

// コインとの衝突判定を行う関数
function checkCoinCollision() {
    coinData = coinData.filter(coin => {
        const distX = player.x + player.width / 2 - coin.x;
        const distY = player.y + player.height / 2 - coin.y;
        const distance = Math.sqrt(distX * distX + distY * distY);

        if (distance < coin.radius + player.width / 2) {
            coinScore += coin.points;
            if (coin.color === 'red') collectedCoins.red++;
            if (coin.color === 'blue') collectedCoins.blue++;
            if (coin.color === 'yellow') collectedCoins.yellow++;
            return false;
        }
        return true;
    });
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPlayer();
    drawPlatforms();
    drawGoal();
    drawCoins();
    updatePlayer();
    requestAnimationFrame(gameLoop);
}

function resetGame() {
    const firstPlatform = platforms[0];
    player.x = firstPlatform.x; // 初期位置を調整
    player.y = firstPlatform.y - player.height; // 足場の上に配置
    player.dy = 0;
    player.onGround = true;
    gameRunning = false;
}

// 音声処理を開始する関数
function startAudioProcessing() {
    navigator.mediaDevices.getUserMedia({ // ユーザーのマイクにアクセス
        audio: {
            echoCancellation: false, // エコーキャンセル無効化
            noiseSuppression: false, // ノイズ抑制無効化
            autoGainControl: false  // 自動ゲインコントロール無効化
        }
    })
    .then(stream => { // マイクへのアクセスが成功した場合
        const audioContext = new (window.AudioContext || window.webkitAudioContext)(); // オーディオコンテキストを作成
        const microphone = audioContext.createMediaStreamSource(stream); // マイクからの入力を取得
        const processor = audioContext.createScriptProcessor(4096, 1, 1); // オーディオデータを処理するプロセッサを作成

        processor.onaudioprocess = (event) => { // オーディオデータの処理
            const inputBuffer = event.inputBuffer.getChannelData(0); // 入力バッファからデータを取得
            const int16Array = floatTo16BitPCM(inputBuffer); // Float32 形式のオーディオデータを 16-bit PCM に変換
            sendAudioData(int16Array); // サーバーに音声データを送信
        };

        microphone.connect(processor); // マイクからの入力をプロセッサに接続
        processor.connect(audioContext.destination); // プロセッサの出力をデスティネーションに接続
    })
    .catch(error => {
        console.error("マイクのアクセスに失敗しました:", error);
    });
}

function floatTo16BitPCM(inputBuffer) { //Float32 形式のオーディオデータを 16-bit PCM に変換する関数
    const int16Array = new Int16Array(inputBuffer.length); //16-bit の整数配列 (Int16Array) を作成
    for (let i = 0; i < inputBuffer.length; i++) { //音声データの各サンプルをループ処理
        int16Array[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32768)); //Float32（-1.0 ～ 1.0 の範囲）を 16-bit PCM（-32768 ～ 32767）に変換
    }
    return int16Array; //16-bit PCM に変換したデータを返す
}

function sendAudioData(data) { //サーバーに音声データを送信する
    fetch("/voice_jump_db/audio", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: data.buffer, //オーディオデータ (data.buffer) を送信。data.buffer は Int16Array のバイナリデータ
    })
    .then(response => response.json())
    .then(({ db }) => {
        handlePlayerMovement(db);
        updateVolumeDisplay(db);
    })
    .catch(error => console.error("音声データ送信エラー:", error));
}

function updateVolumeDisplay(db) {
    if (volumeBar) {
        volumeBar.style.width = `${db}%`; // dB 値そのままをバーの長さに反映
    }
}

function handlePlayerMovement(db) { //プレイヤーの移動を制御する関数
    if (gameRunning) { //ゲームが実行中の場合
        if (db >= jumpThreshold && player.onGround) { //dB がジャンプのしきい値以上で、プレイヤーが地面にいる場合
            player.dy = -player.jumpPower; // プレイヤーをジャンプさせる
            player.onGround = false; // プレイヤーが地面にいない状態にする
        } else if (db >= moveThreshold && db < jumpThreshold) { //dB が移動のしきい値以上かつジャンプのしきい値未満の場合
            player.x += player.speed; // プレイヤーを右に移動
        }
    }
}

function beginDetect() { //ゲームを開始する
    gameRunning = true; //ゲームが実行中に
    startTime = performance.now(); //ゲームの開始時刻を記録
    startAudioProcessing(); //音声処理を開始
}

function endGame(isCleared) { //ゲームを終了する
    gameRunning = false; //ゲームが実行中でない状態に
    const elapsedTime = ((window.performance.now() - startTime) / 1000).toFixed(2); //経過時間を計算
    if (isCleared) { //ゲームクリアの場合
        const resultURL = `/voice_jump_db/performance1_db_rslt?elapsedTime=${elapsedTime}&coinScore=${coinScore}&redCoins=${collectedCoins.red}&blueCoins=${collectedCoins.blue}&yellowCoins=${collectedCoins.yellow}`; //結果画面に遷移する URL を作成
        window.location.href = resultURL; //結果画面に遷移
    } else { //ゲームオーバーの場合
        window.location.reload(); //ページをリロードしてゲームをリセット
    }
}

resetGame();
gameLoop();


const canvas = document.getElementById('gameCanvas'); //キャンパスの初期化
const ctx = canvas.getContext('2d');
const messageElement = document.getElementById('message');
const volumeBar = document.getElementById('volume-bar');

const player = { //プレイヤーの初期化
    x: 0, 
    y: 0, 
    width: 20,
    height: 20,
    speed: 10,
    jumpPower: 14, //この値は変えないように（15だと画面をはみ出してしまう）
    dy: 0, 
    onGround: true 
};

const gravity = 0.5; 
const platforms = [
    { x: 0, y: 250, width: 100, height: 250 },
    { x: 220, y: 320, width: 100, height: 100 },
    { x: 400, y: 220, width: 100, height: 190 },
    { x: 550, y: 300, width: 100, height: 110 },
    { x: 700, y: 270, width: 100, height: 140 }
];
let goal = { x: 780, y: 250, width: 20, height: 20 };
let gameRunning = false;

// 各コインの色とポイントの定義
let coinData = [
    { x: 260, y: platforms[1].y - 8, radius: 8, color: 'red', points: 30 },
    { x: 708, y: platforms[4].y - 8, radius: 8, color: 'red', points: 30 },

    { x: 150, y: 70, radius: 8, color: 'blue', points: 20 },
    { x: 360, y: 140, radius: 8, color: 'blue', points: 20 },


    { x: 92, y: 140, radius: 8, color: 'yellow', points: 10 },
    { x: 490, y: 110, radius: 8, color: 'yellow', points: 10 },
    { x: 430, y: platforms[2].y - 8, radius: 8, color: 'yellow', points: 10 },
    { x: 590, y: platforms[3].y - 8, radius: 8, color: 'yellow', points: 10 },
    { x: 650, y: 190, radius: 8, color: 'yellow', points: 10 },
    { x: 745, y: 200, radius: 8, color: 'yellow', points: 10 }
];

let startTime;
let coinScore = 0; // グローバルに移動
let collectedCoins = { red: 0, blue: 0, yellow: 0 };
let socket = null;

function drawPlayer() {
    ctx.fillStyle = 'blue';
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

function drawCoins() {
    coinData.forEach(coin => {
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.radius, 0, Math.PI * 2);
        ctx.fillStyle = coin.color;
        ctx.fill();
        ctx.closePath();
    });
}

function updatePlayer() {
    if (!gameRunning) return;

    player.y += player.dy;

    if (!player.onGround) {
        player.dy += gravity; // 重力の影響を追加
    }

    let onAnyPlatform = false;
    platforms.forEach(platform => {
        if (
            player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height <= platform.y + 10 &&
            player.y + player.height >= platform.y
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

    //プレイヤーが画面の下に落ちたらゲームオーバー
    if (player.y + player.height > canvas.height) {
        player.y = canvas.height - player.height;
        player.dy = 0;
        endGame(false); //ゲームオーバーの場合、結果画面にいかない
    }

    if (player.y + player.height < 0) {
        player.y = 0;
        player.dy = 0;
    }

    //ゴールに到達したらクリア
    if (
        player.x < goal.x + goal.width &&
        player.x + player.width > goal.x &&
        player.y + player.height > goal.y &&
        player.y < goal.y + goal.height
    ) {
        endGame(true); //クリアした場合、結果画面にいく
    }

    //プレイヤーがゴールを通り過ぎたらゲームオーバー
    if (player.x > goal.x + goal.width) {
        endGame(false); //ゲームオーバーの場合、結果画面にいかない
    }

    checkCoinCollision();  // コインとの衝突を確認
}

// コインとの衝突を確認
function checkCoinCollision() {
    coinData = coinData.filter(coin => {
        const distX = player.x + player.width / 2 - coin.x;
        const distY = player.y + player.height / 2 - coin.y;
        const distance = Math.sqrt(distX * distX + distY * distY);

        if (distance < coin.radius + player.width / 2) {
            coinScore += coin.points; // コインのポイントを加算
            // 獲得したコインの色に応じてカウントを増やす
            if (coin.color === 'red') collectedCoins.red++;
            if (coin.color === 'blue') collectedCoins.blue++;
            if (coin.color === 'yellow') collectedCoins.yellow++;
            return false; // 取得したコインを配列から削除
        }
        return true;
    });
}

function drawPlatforms() {
    ctx.fillStyle = 'black';
    platforms.forEach(platform => {
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });
}

function drawGoal() {
    ctx.fillStyle = 'red';
    ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
}

function resetGame() {
    const firstPlatform = platforms[0];
    player.x = firstPlatform.x;
    player.y = firstPlatform.y - player.height;
    player.dy = 0;
    player.onGround = true;
    gameRunning = false;

    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPlayer();
    drawPlatforms();
    drawGoal();
    drawCoins(); // コインを描画
    updatePlayer();
    requestAnimationFrame(gameLoop);
}

function beginDetect() {
    startTime = performance.now();
    gameRunning = true;

    // WebSocketの接続を確立（相対パスを使用）
    socket = io('http://localhost:8080', {
        transports: ['websocket'],
        upgrade: false
    });

    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        socket.emit('start_monitoring');
    });

    socket.on('audio_data', (data) => {
        const dbLevel = data.power;
        console.log('Received audio data:', dbLevel);
    
        // 既存のvolume-display要素を更新または作成
        let volumeDisplayElement = document.getElementById('volume-display');
        if (!volumeDisplayElement) {
            volumeDisplayElement = document.createElement('div');
            volumeDisplayElement.id = 'volume-display';
            document.body.appendChild(volumeDisplayElement);
        }
        
        // ボリュームバーの更新
        if (volumeBar) {
            volumeBar.style.width = `${Math.max(0, Math.min(100, dbLevel))}%`;
        }
    
        // キャラクターの動きを制御
        if (gameRunning) {
            if (dbLevel >= 70 && player.onGround) {
                console.log('Jump triggered:', dbLevel);
                player.dy = -player.jumpPower;
                player.onGround = false;
            } else if (dbLevel >= 30 && dbLevel < 70) {
                console.log('Move forward:', dbLevel);
                player.x += player.speed;
            }
        }
    });

    socket.on('error', (data) => {
        console.error('WebSocket error:', data.message);
        gameRunning = false;
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
        gameRunning = false;
    });
}

function endGame(isCleared) {
    gameRunning = false;
    if (isCleared) {
        //クリアした場合、結果画面に遷移
        const elapsedTime = ((window.performance.now() - startTime) / 1000).toFixed(2);

        //結果画面に取得したコインの数と総コイン数を送信
        const resultURL = `/voice_jump_db/performance5_db_rslt?elapsedTime=${elapsedTime}&coinScore=${coinScore}&redCoins=${collectedCoins.red}&blueCoins=${collectedCoins.blue}&yellowCoins=${collectedCoins.yellow}`;
        window.location.href = resultURL;
    } else {
        //ゲームオーバーの場合、プレイ画面にリロード
        window.location.reload();
    }
}

resetGame();
gameLoop();
var socket = io.connect(window.location.origin);
var threshold = 0;
var timer;
var elapsedTime = 0;
var isDetecting = false;
var hasExceededThreshold = false;

window.onload = function() {
  resetTimer(); // ページロード時にタイマーをリセット
};

socket.on('connect', function() {
  console.log('Connected to server');
  socket.emit('start_monitoring');
});

socket.on('audio_data', function(data) {
  if (!isDetecting) return; // 開始ボタンが押されるまで動作しない

  console.log('Received audio data:', data);
  var dB = data.power;

  // バーを常に動作させる
  document.getElementById('volume').style.width = Math.min(100, (dB / 100) * 100) + '%';

  // しきい値を超えたらカウントを開始
  if (threshold > 0 && dB > threshold) {
    if (!hasExceededThreshold) {
      hasExceededThreshold = true; // しきい値を初めて超えた
      startTimer(); // カウントを開始
    }
  }

  // 一度しきい値を超えた後、下回ったら停止
  if (hasExceededThreshold && dB < threshold) {
    stopTimer();
    isDetecting = false; // 停止状態に
  }
});

socket.on('disconnect', function() {
  console.log('Disconnected from server');
  socket.emit('stop_monitoring');
});

function setThreshold() {
  const dBValue = parseFloat(document.getElementById('threshold').value);
  threshold = dBValue;
  resetTimer();

  // しきい値が設定されたら音声認識を開始
  if (threshold > 0) {
    socket.emit('start_monitoring');
  }
}

function startTimer() {
  timer = setInterval(() => {
    elapsedTime += 0.01; // 0.01秒ずつ増加
    const elapsedTimeElement = document.getElementById('elapsedTime');
    if (elapsedTimeElement) {
      elapsedTimeElement.innerText = '経過時間: ' + elapsedTime.toFixed(2) + '秒'; // 小数第2位まで表示
    }
  }, 10); // 10ミリ秒ごとに更新
}

function stopTimer() {
  clearInterval(timer);
  timer = null;
}

function resetTimer() {
  stopTimer();
  elapsedTime = 0;
  const elapsedTimeElement = document.getElementById('elapsedTime');
  if (elapsedTimeElement) {
    elapsedTimeElement.innerText = '経過時間: 0秒';
  }
  // バーをリセット
  document.getElementById('volume').style.width = '0%';
}

function beginDetect() {
  if (threshold > 0) {
    isDetecting = true; // 開始ボタンが押されたら動作を開始
    hasExceededThreshold = false; // フラグをリセット
    socket.emit('start_monitoring');
  } else {
    alert('しきい値を設定してください。');
  }
}

function goBack() {
  window.location.href = "../../index.html";
}
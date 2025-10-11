let audioContext;
let microphone;
let processor;
let isRecording = false;
let threshold = 0;
let thresholdPlusTwo = 0;
let startTime = null;
let elapsedTime = 0.0;
let timerInterval = null;
let isStopped = false;  // バーの固定フラグ
let fixedVolumeWidth = ""; // 固定されたバーの幅
let firstThresholdExceeded = false; // 初めてしきい値を超えたかどうかのフラグ

document.getElementById("threshold").addEventListener("change", setThreshold);
document.querySelector(".btn-start").addEventListener("click", startRecording);

function setThreshold() {
    threshold = parseInt(document.getElementById("threshold").value, 10);
    thresholdPlusTwo = threshold + 2;
    console.log(`しきい値設定: ${threshold} dB, 上限: ${thresholdPlusTwo} dB`);
    updateThresholdLines();
}

async function startRecording() {
    if (isRecording) return;
    isRecording = true;
    isStopped = false;  // 初期状態でフラグ解除
    firstThresholdExceeded = false; // しきい値超えフラグもリセット
    elapsedTime = 0.0; // 経過時間リセット
    updateElapsedTime();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        microphone = audioContext.createMediaStreamSource(stream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (event) => {
            if (isStopped) return; // 停止フラグが立ったら処理しない
            const inputBuffer = event.inputBuffer.getChannelData(0);
            const int16Array = floatTo16BitPCM(inputBuffer);
            sendAudioData(int16Array);
        };

        microphone.connect(processor);
        processor.connect(audioContext.destination);
    } catch (error) {
        console.error("マイクへのアクセスに失敗しました:", error);
    }
}

function floatTo16BitPCM(inputBuffer) {
    const int16Array = new Int16Array(inputBuffer.length);
    for (let i = 0; i < inputBuffer.length; i++) {
        int16Array[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32768));
    }
    return int16Array;
}

async function sendAudioData(data) {
    if (isStopped) return; // 停止フラグが立っていたら送信を行わない

    try {
        const response = await fetch("/sustainability_of_voice/audio", {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: data.buffer,
        });

        if (response.ok) {
            const { db } = await response.json();
            handleThresholdCheck(db);
        }
    } catch (error) {
        console.error("音声データ送信中のエラー:", error);
    }
}

function updateVolumeDisplay(db) {
  console.log(`バーの更新 - dB: ${db}`); // ★ バーの更新時の dB を表示
  const volumeBar = document.getElementById("volume");

  if (isStopped) {
      console.log("バーは停止しているため、更新しません。");
      volumeBar.style.width = fixedVolumeWidth;
      return;
  }

  const clampedDb = Math.max(0, Math.min(db, 120));
  const displayDb = Math.min(clampedDb, 100);
  const scaledDb = (displayDb / 100) * 100;

  volumeBar.style.width = `${scaledDb}%`;
}

function handleThresholdCheck(db) {
  console.log(`現在の声量: ${db} dB`);

  if (db > thresholdPlusTwo) {
      console.log("しきい値+2dBを超えました。バーとカウントを停止します。");
      stopBar(db);
      return;
  }

  if (!isStopped && db >= threshold && db <= thresholdPlusTwo) { // 停止中は実行しない
      if (!firstThresholdExceeded) {
          firstThresholdExceeded = true;
          console.log("初めてしきい値を超えました。カウントを開始します。");
      }
      if (!startTime) {
          startTime = Date.now();
          timerInterval = setInterval(() => {
              elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
              updateElapsedTime();
          }, 10);
      }
  } else if (!isStopped && firstThresholdExceeded && db < threshold) {
      console.log("しきい値未満になったため、カウントを停止します。");
      stopBar(db);
  }

  updateVolumeDisplay(db);
}

function stopBar(db) {
  if (isStopped) return; // すでに停止している場合は処理しない

  console.log(`バーを停止 - 固定値: ${db} dB`);
  isStopped = true;
  isRecording = false; // 録音も停止
  firstThresholdExceeded = false;

  if (startTime) {
      clearInterval(timerInterval);
      startTime = null;
  }

  const volumeBar = document.getElementById("volume");
  const clampedDb = Math.max(0, Math.min(db, 120));
  const displayDb = Math.min(clampedDb, 100);
  fixedVolumeWidth = `${(displayDb / 100) * 100}%`;

  volumeBar.style.width = fixedVolumeWidth;

  clearInterval(timerInterval);
  updateElapsedTime();
}

function updateElapsedTime() {
    document.getElementById("elapsedTime").textContent = `経過時間: ${elapsedTime}秒`;
}

// しきい値ラインの更新
function updateThresholdLines() {
    document.querySelectorAll(".threshold-line.dynamic").forEach(line => line.remove());

    const meterContainer = document.querySelector(".meter-container");

    function createThresholdLine(db, color) {
        const line = document.createElement("div");
        line.classList.add("threshold-line", "dynamic");
        line.style.backgroundColor = color;
        line.style.left = `${(db / 100) * 100}%`;
        meterContainer.appendChild(line);
    }

    if (threshold > 0) createThresholdLine(threshold, "red");
    if (thresholdPlusTwo > 0) createThresholdLine(thresholdPlusTwo, "blue");
}

window.onload = function () {
    elapsedTime = 0.0;
    updateElapsedTime();
};


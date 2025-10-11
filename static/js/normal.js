let audioContext;
let microphone;
let processor;
let isRecording = false;
let threshold = 0;
let startTime = null;
let elapsedTime = 0.0;
let timerInterval = null;
let isFrozen = false;  // しきい値を下回ったらバーの更新を停止するフラグ
let hasCrossedThreshold = false; // 一度でもしきい値を超えたかを判定

document.getElementById("threshold").addEventListener("change", setThreshold);
document.querySelector(".btn-start").addEventListener("click", startRecording);

function setThreshold() {
    threshold = parseInt(document.getElementById("threshold").value, 10);
    console.log(`しきい値設定: ${threshold} dB`);
}

async function startRecording() {
    if (isRecording) return;
    isRecording = true;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false, 
                noiseSuppression: false, 
                autoGainControl: false 
            }
        });

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        microphone = audioContext.createMediaStreamSource(stream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (event) => {
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
    try {
        const response = await fetch("/sustainability_of_voice/audio", {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: data.buffer,
        });

        if (response.ok) {
            const { db } = await response.json();
            
            console.log("現在の声量:", db, "dB");

            handleThresholdCheck(db);
        }
    } catch (error) {
        console.error("音声データ送信中のエラー:", error);
    }
}

function updateVolumeDisplay(db) {
    const volumeBar = document.getElementById("volume");

    const clampedDb = Math.max(0, Math.min(db, 120));
    const displayDb = Math.min(clampedDb, 100);
    const scaledDb = (displayDb / 100) * 100;

    volumeBar.style.width = `${scaledDb}%`;
}

function handleThresholdCheck(db) {
    if (isFrozen) {
        return; // 既にしきい値を下回っていたら何もしない
    }

    if (db >= threshold) {
        if (!hasCrossedThreshold) {
            hasCrossedThreshold = true; // 初めてしきい値を超えたらフラグを立てる
        }

        if (!startTime) {
            startTime = Date.now();
            timerInterval = setInterval(() => {
                elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
                updateElapsedTime();
            }, 10);
        }
        updateVolumeDisplay(db);
    } else {
        if (hasCrossedThreshold) {
            // 一度しきい値を超えた後にしきい値未満になったら固定
            if (startTime) {
                clearInterval(timerInterval);
                startTime = null;
            }
            isFrozen = true; // しきい値を下回ったらロック
        }
        updateVolumeDisplay(db); // しきい値未満でも現在の音量を表示
    }
}

function updateElapsedTime() {
    document.getElementById("elapsedTime").textContent = `経過時間: ${elapsedTime}秒`;
}

window.onload = function () {
    elapsedTime = 0.0;
    updateElapsedTime();
};


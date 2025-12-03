const myVideo = document.getElementById('my-stream');
const otherVideo = document.getElementById('other-stream');
const startChatButton = document.getElementById('start-chat');
const stopChatButton = document.getElementById('stop-chat');
const skipButton = document.getElementById('skip-btn');

const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');
const sendButton = document.getElementById('send-button');

const videoSelect = document.getElementById('video-input');
const audioSelect = document.getElementById('audio-input');
const volumeControl = document.getElementById('volume-control');

const settingsModal = document.getElementById('settings-modal');
const settingsIcon = document.getElementById('settings-icon');
const closeSettingsButton = document.getElementById('close-settings');

let myStream;

// ✅ PARAMÈTRES OUVERTURE
settingsIcon.onclick = () => settingsModal.style.display = "block";
closeSettingsButton.onclick = () => settingsModal.style.display = "none";

// ✅ CAMÉRA
startChatButton.onclick = async () => {
    myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    myVideo.srcObject = myStream;
    startChatButton.classList.add("hidden");
    stopChatButton.classList.remove("hidden");
};

// ✅ STOP
stopChatButton.onclick = () => {
    if (myStream) {
        myStream.getTracks().forEach(t => t.stop());
    }
    myVideo.srcObject = null;
    startChatButton.classList.remove("hidden");
    stopChatButton.classList.add("hidden");
};

// ✅ SKIP
skipButton.onclick = () => {
    chatBox.innerHTML = "";
    otherVideo.srcObject = null;
};

// ✅ CHAT ÉCRITURE
sendButton.onclick = sendMessage;

chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
});

function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    const div = document.createElement("div");
    div.textContent = msg;
    div.style.background = "#d1e7ff";
    div.style.margin = "5px";
    div.style.padding = "5px";
    div.style.borderRadius = "5px";
    chatBox.appendChild(div);

    chatInput.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ✅ AUDIO SETTINGS
volumeControl.oninput = () => {
    if (myVideo) myVideo.volume = volumeControl.value;
};

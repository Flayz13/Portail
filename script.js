// ============================
// ELEMENTS VIDEO & CHAT
// ============================

const myVideo = document.getElementById('my-stream');
const otherVideo = document.getElementById('other-stream');
const startChatButton = document.getElementById('start-chat');
const stopChatButton = document.getElementById('stop-chat');
const skipButton = document.createElement("button");

const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');
const sendButton = document.getElementById('send-button');

// ============================
// PARAMETRES
// ============================

const videoSelect = document.getElementById('video-input');
const audioSelect = document.getElementById('audio-input');
const audioOutputSelect = document.getElementById('audio-output');
const volumeControl = document.getElementById('volume-control');
const settingsModal = document.getElementById('settings-modal');
const settingsIcon = document.getElementById('settings-icon');
const closeSettingsButton = document.getElementById('close-settings');

// ============================
// WEBRTC + WEBSOCKET
// ============================

let myStream;
let peerConnection;

const iceServers = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const signalingServer = new WebSocket('wss://flayz13s-projects.up.railway.app');

// ============================
// BOUTON SKIP
// ============================

skipButton.textContent = "SKIP";
skipButton.className = "control-btn";
document.querySelector(".controls-section").appendChild(skipButton);

skipButton.addEventListener("click", () => {
  stopChat();
  setTimeout(startChat, 1500);
});

// ============================
// CONNEXION WEBSOCKET
// ============================

signalingServer.onopen = () => {
  console.log("✅ WebSocket connecté");
};

signalingServer.onmessage = async (message) => {
  const data = JSON.parse(message.data);

  if (data.type === "chat") {
    displayMessage(data.message, "received");
  }

  if (data.type === "offer") {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    signalingServer.send(JSON.stringify({ type: "answer", answer }));
  }

  if (data.type === "answer") {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  }

  if (data.type === "candidate") {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
};

// ============================
// DEMARRAGE APPEL VIDEO
// ============================

async function startChat() {
  myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  myVideo.srcObject = myStream;

  peerConnection = new RTCPeerConnection(iceServers);

  myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream));

  peerConnection.ontrack = event => {
    otherVideo.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      signalingServer.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
    }
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  signalingServer.send(JSON.stringify({ type: "offer", offer }));

  startChatButton.classList.add("hidden");
  stopChatButton.classList.remove("hidden");
}

// ============================
// STOP APPEL
// ============================

function stopChat() {
  if (peerConnection) peerConnection.close();
  if (myStream) myStream.getTracks().forEach(track => track.stop());

  myVideo.srcObject = null;
  otherVideo.srcObject = null;

  startChatButton.classList.remove("hidden");
  stopChatButton.classList.add("hidden");
}

// ============================
// CHAT
// ============================

function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  displayMessage(message, "sent");
  signalingServer.send(JSON.stringify({ type: "chat", message }));

  chatInput.value = "";
}

function displayMessage(message, type) {
  const div = document.createElement("div");
  div.textContent = message;
  div.className = type === "sent" ? "sent-message" : "received-message";
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ============================
// EVENEMENTS
// ============================

startChatButton.addEventListener("click", startChat);
stopChatButton.addEventListener("click", stopChat);
sendButton.addEventListener("click", sendMessage);

chatInput.addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

// ============================
// PARAMETRES
// ============================

settingsIcon.addEventListener("click", () => {
  settingsModal.style.display = "block";
});

closeSettingsButton.addEventListener("click", () => {
  settingsModal.style.display = "none";
});

// ============================
// DETECTION CAMERAS
// ============================

async function populateDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();

  devices.forEach(device => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || device.kind;

    if (device.kind === "videoinput") videoSelect.appendChild(option);
    if (device.kind === "audioinput") audioSelect.appendChild(option);
    if (device.kind === "audiooutput") audioOutputSelect.appendChild(option);
  });
}

populateDevices();

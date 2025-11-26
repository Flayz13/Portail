const myVideo = document.getElementById('my-stream');
const otherVideo = document.getElementById('other-stream');
const startBtn = document.getElementById('start-chat');
const skipBtn = document.getElementById('skip-chat');

const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');
const sendBtn = document.getElementById('send-button');

const settingsModal = document.getElementById('settings-modal');
const settingsIcon = document.getElementById('settings-icon');
const closeSettings = document.getElementById('close-settings');

let localStream;
let peerConnection;
let partnerId = null;

const socket = new WebSocket("wss://flayz13s-projects.up.railway.app");

const iceServers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

// ✅ Connexion WebSocket
socket.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);

    if (data.type === "match") {
        partnerId = data.partner;
        startCall();
    }

    if (data.type === "offer") {
        peerConnection = new RTCPeerConnection(iceServers);
        await peerConnection.setRemoteDescription(data.offer);

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.send(JSON.stringify({ type: "answer", answer }));
    }

    if (data.type === "answer") {
        await peerConnection.setRemoteDescription(data.answer);
    }

    if (data.type === "candidate") {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }

    if (data.type === "chat") {
        displayMessage(data.message, "received");
    }
};

// ✅ Démarrer caméra
startBtn.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    myVideo.srcObject = localStream;

    socket.send(JSON.stringify({ type: "search" }));
};

// ✅ Start Appel
async function startCall() {
    peerConnection = new RTCPeerConnection(iceServers);

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = e => {
        otherVideo.srcObject = e.streams[0];
    };

    peerConnection.onicecandidate = e => {
        if (e.candidate) {
            socket.send(JSON.stringify({ type: "candidate", candidate: e.candidate }));
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: "offer", offer }));
}

// ✅ Bouton Skip
skipBtn.onclick = () => {
    if (peerConnection) peerConnection.close();
    otherVideo.srcObject = null;

    partnerId = null;
    socket.send(JSON.stringify({ type: "search" }));
};

// ✅ Chat
sendBtn.onclick = sendMessage;

chatInput.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
});

function sendMessage() {
    if (!chatInput.value) return;

    displayMessage(chatInput.value, "sent");

    socket.send(JSON.stringify({
        type: "chat",
        message: chatInput.value
    }));

    chatInput.value = "";
}

function displayMessage(msg, type) {
    const div = document.createElement("div");
    div.textContent = msg;
    div.className = type === "sent" ? "sent-message" : "received-message";
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ✅ Paramètres
settingsIcon.onclick = () => settingsModal.style.display = "block";
closeSettings.onclick = () => settingsModal.style.display = "none";

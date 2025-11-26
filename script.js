// Video elements and controls
const myVideo = document.getElementById('my-stream');
const otherVideo = document.getElementById('other-stream');
const startChatButton = document.getElementById('start-chat');
const stopChatButton = document.getElementById('stop-chat');

// Chat elements
const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');
const sendButton = document.getElementById('send-button');

// WebRTC and WebSocket setup
let myStream;
let peerConnection;
const iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// ⚠️ Important : ton serveur doit gérer le matching automatique
const signalingServer = new WebSocket('wss://flayz13s-projects.up.railway.app');

// Camera and Microphone Selection (for settings)
const videoSelect = document.getElementById('video-input');
const audioSelect = document.getElementById('audio-input');
const audioOutputSelect = document.getElementById('audio-output');
const volumeControl = document.getElementById('volume-control');
const settingsModal = document.getElementById('settings-modal');
const settingsIcon = document.getElementById('settings-icon');
const closeSettingsButton = document.getElementById('close-settings');

// ----- AUTO MATCHMAKING -----

signalingServer.onopen = () => {
    console.log("✅ Connecté au serveur");
    
    // 🔥 Demande au serveur d’être mis en attente d’un autre utilisateur
    signalingServer.send(JSON.stringify({ type: "find-partner" }));
};

// ----- MEDIA PERMISSIONS -----

async function requestMediaPermissions() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const audioDevices = devices.filter(device => device.kind === 'audioinput');

        if (videoDevices.length === 0 || audioDevices.length === 0) {
            alert("Autorise la caméra et le micro !");
            return false;
        }
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// ----- START VIDEO CHAT -----

async function startChat() {
    const permissionGranted = await requestMediaPermissions();
    if (!permissionGranted) return;

    myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    myVideo.srcObject = myStream;

    peerConnection = new RTCPeerConnection(iceServers);

    myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream));

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            signalingServer.send(JSON.stringify({
                type: "candidate",
                candidate: event.candidate
            }));
        }
    };

    peerConnection.ontrack = event => {
        otherVideo.srcObject = event.streams[0];
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    signalingServer.send(JSON.stringify({
        type: "offer",
        offer
    }));

    startChatButton.classList.add("hidden");
    stopChatButton.classList.remove("hidden");
}

// ----- SKIP PARTNER -----

function skipPartner() {
    stopChat();

    chatBox.innerHTML = "";

    signalingServer.send(JSON.stringify({
        type: "skip"
    }));

    setTimeout(() => {
        signalingServer.send(JSON.stringify({ type: "find-partner" }));
    }, 500);
}

// ----- STOP CHAT -----

function stopChat() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (myStream) {
        myStream.getTracks().forEach(track => track.stop());
        myStream = null;
    }

    myVideo.srcObject = null;
    otherVideo.srcObject = null;

    startChatButton.classList.remove("hidden");
    stopChatButton.classList.add("hidden");
}

// ----- CHAT -----

function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    displayMessage(message, "sent");

    signalingServer.send(JSON.stringify({
        type: "chat",
        message
    }));

    chatInput.value = "";
}

function displayMessage(message, type) {
    const div = document.createElement("div");
    div.textContent = message;
    div.className = type === "sent" ? "sent-message" : "received-message";
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ----- SIGNAL SERVER HANDLER -----

signalingServer.onmessage = async message => {
    const data = JSON.parse(message.data);
    console.log("📩", data);

    if (data.type === "partner-found") {
        console.log("✅ Partenaire trouvé !");
    }

    if (data.type === "offer") {
        if (!peerConnection) startChat();

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        signalingServer.send(JSON.stringify({
            type: "answer",
            answer
        }));
    }

    if (data.type === "answer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }

    if (data.type === "candidate") {
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    }

    if (data.type === "chat") {
        displayMessage(data.message, "received");
    }

    if (data.type === "partner-left") {
        alert("L'autre personne a quitté. Nouvelle recherche...");
        skipPartner();
    }
};

// ----- EVENTS -----

startChatButton.addEventListener("click", startChat);
stopChatButton.addEventListener("click", skipPartner);
sendButton.addEventListener("click", sendMessage);

chatInput.addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
});

// ----- SETTINGS -----

settingsIcon.addEventListener("click", () => {
    settingsModal.style.display = "block";
});

closeSettingsButton.addEventListener("click", () => {
    settingsModal.style.display = "none";
});

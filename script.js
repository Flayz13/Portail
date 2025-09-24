// Video elements and controls
const myVideo = document.getElementById('my-stream');
const otherVideo = document.getElementById('other-stream');
const startChatButton = document.getElementById('start-chat');
const stopChatButton = document.getElementById('stop-chat');

// Chat elements
const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');
const sendButton = document.getElementById('send-button');

// Camera and Microphone Selection
const videoSelect = document.getElementById('video-input');
const audioSelect = document.getElementById('audio-input');
const audioOutputSelect = document.getElementById('audio-output');
const volumeControl = document.getElementById('volume-control');
const settingsModal = document.getElementById('settings-modal');
const settingsIcon = document.getElementById('settings-icon');
const closeSettingsButton = document.getElementById('close-settings');

// Login elements
const loginButton = document.getElementById('login-button');
const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const loginError = document.getElementById('login-error');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

// WebRTC and WebSocket
let myStream;
let peerConnection;
let signalingServer;
const iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Current user
let currentUser = null;

// Handle login
loginButton.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        loginError.textContent = "Veuillez remplir tous les champs";
        loginError.style.display = "block";
        return;
    }

    try {
        const res = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        if (res.status === 401) {
            loginError.textContent = "Nom d'utilisateur ou mot de passe invalide";
            loginError.style.display = "block";
            return;
        }

        const data = await res.json();
        currentUser = username;

        signalingServer = new WebSocket('wss://flayz13s-projects.up.railway.app');
        signalingServer.onopen = () => {
            signalingServer.send(JSON.stringify({ type: 'auth', token: data.token }));
        };
        signalingServer.onmessage = handleSignalingMessage;

        loginContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
    } catch (err) {
        console.error(err);
        loginError.textContent = "Erreur lors de la connexion";
        loginError.style.display = "block";
    }
});

// Request media permissions
async function requestMediaPermissions() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        const audioDevices = devices.filter(device => device.kind === 'audioinput');

        if (videoDevices.length === 0 || audioDevices.length === 0) {
            alert('Veuillez autoriser l\'accès à votre caméra et microphone');
            return false;
        }

        return true;
    } catch (error) {
        console.error('Erreur lors de la demande de permissions :', error);
        return false;
    }
}

// Start chat
async function startChat() {
    const permissionGranted = await requestMediaPermissions();
    if (!permissionGranted) return;

    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');

        // Choose camera based on username
        let videoDeviceId;
        if (currentUser === "Veynes") videoDeviceId = videoDevices[0]?.deviceId;
        else videoDeviceId = videoDevices[1]?.deviceId || videoDevices[0]?.deviceId;

        myStream = await navigator.mediaDevices.getUserMedia({ 
            video: { deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined }, 
            audio: true 
        });
        myVideo.srcObject = myStream;

        peerConnection = new RTCPeerConnection(iceServers);
        myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream));

        peerConnection.onicecandidate = event => {
            if (event.candidate) signalingServer.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        };

        peerConnection.ontrack = event => {
            otherVideo.srcObject = event.streams[0];
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingServer.send(JSON.stringify({ type: 'offer', offer }));

        startChatButton.classList.add('hidden');
        stopChatButton.classList.remove('hidden');
    } catch (err) {
        console.error('Erreur lors du démarrage du chat vidéo :', err);
    }
}

// Handle signaling messages
async function handleSignalingMessage(message) {
    const data = JSON.parse(message.data);

    if (data.type === 'chat') displayMessage(data.message, 'received');
    if (data.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        signalingServer.send(JSON.stringify({ type: 'answer', answer }));
    } else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.type === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
}

// Stop chat
function stopChat() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (myStream) myStream.getTracks().forEach(track => track.stop());
    myVideo.srcObject = null;
    otherVideo.srcObject = null;

    startChatButton.classList.remove('hidden');
    stopChatButton.classList.add('hidden');
}

// Send chat messages
function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    displayMessage(message, 'sent');
    signalingServer.send(JSON.stringify({ type: 'chat', message }));
    chatInput.value = '';
}

// Display messages
function displayMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.classList.add(type === 'sent' ? 'sent-message' : 'received-message');
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Populate devices
async function populateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    const audioDevices = devices.filter(d => d.kind === 'audioinput');
    const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

    videoDevices.forEach((d,i) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || `Caméra ${i+1}`;
        videoSelect.appendChild(opt);
    });
    audioDevices.forEach((d,i) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || `Micro ${i+1}`;
        audioSelect.appendChild(opt);
    });
    audioOutputs.forEach((d,i) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || `Haut-parleur ${i+1}`;
        audioOutputSelect.appendChild(opt);
    });
}

// Event listeners
startChatButton.addEventListener('click', startChat);
stopChatButton.addEventListener('click', stopChat);
sendButton.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', e => { if(e.key==='Enter'){e.preventDefault(); sendMessage();} });
settingsIcon.addEventListener('click', () => settingsModal.style.display='block');
closeSettingsButton.addEventListener('click', () => settingsModal.style.display='none');

// Populate devices on load
populateDevices();

// Video elements and controls
const leftVideo = document.getElementById('left-stream');
const rightVideo = document.getElementById('right-stream');
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
let signalingServer;
let usernameGlobal = null;

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

// Handle login
loginButton.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        loginError.textContent = "Please enter username and password";
        loginError.style.display = "block";
        return;
    }

    try {
        const res = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) throw new Error("Invalid credentials");

        const data = await res.json();
        loginContainer.style.display = 'none';
        chatContainer.style.display = 'flex';
        loginError.style.display = 'none';

        usernameGlobal = username;
        connectWebSocket(data.token);

    } catch (err) {
        loginError.textContent = "Invalid username or password";
        loginError.style.display = "block";
    }
});

// Connect WebSocket
function connectWebSocket(token) {
    signalingServer = new WebSocket('ws://localhost:3000');
    signalingServer.onopen = () => {
        signalingServer.send(JSON.stringify({ type: 'auth', token }));
    };

    signalingServer.onmessage = async message => {
        const data = JSON.parse(message.data);

        // Chat messages
        if (data.type === 'chat') displayMessage(data.message, 'received');

        // WebRTC signaling
        if (data.type === 'offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            signalingServer.send(JSON.stringify({ type: 'answer', answer }));
        } else if (data.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.type === 'candidate') {
            const candidate = new RTCIceCandidate(data.candidate);
            await peerConnection.addIceCandidate(candidate);
        }
    };
}

// Request media permissions
async function requestMediaPermissions() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioDevices = devices.filter(d => d.kind === 'audioinput');
        if (!videoDevices.length || !audioDevices.length) {
            alert("Please allow camera and microphone access");
            return false;
        }
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

// Start chat
async function startChat() {
    const permissionGranted = await requestMediaPermissions();
    if (!permissionGranted) return;

    try {
        const allStreams = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allStreams.filter(d => d.kind === 'videoinput');
        let selectedDeviceId;

        if (usernameGlobal === 'Veynes') selectedDeviceId = videoDevices[0].deviceId; // left camera
        else selectedDeviceId = videoDevices[1]?.deviceId || videoDevices[0].deviceId; // right camera

        myStream = await navigator.mediaDevices.getUserMedia({ 
            video: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined },
            audio: true 
        });

        // Assign stream to left or right video
        if (usernameGlobal === 'Veynes') leftVideo.srcObject = myStream;
        else rightVideo.srcObject = myStream;

        peerConnection = new RTCPeerConnection(iceServers);
        myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream));

        peerConnection.onicecandidate = e => {
            if (e.candidate) signalingServer.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
        };

        peerConnection.ontrack = e => {
            if (usernameGlobal === 'Veynes') rightVideo.srcObject = e.streams[0];
            else leftVideo.srcObject = e.streams[0];
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingServer.send(JSON.stringify({ type: 'offer', offer }));

        startChatButton.classList.add('hidden');
        stopChatButton.classList.remove('hidden');

    } catch (err) {
        console.error(err);
    }
}

// Stop chat
function stopChat() {
    if (peerConnection) peerConnection.close();
    if (myStream) myStream.getTracks().forEach(track => track.stop());

    leftVideo.srcObject = null;
    rightVideo.srcObject = null;

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

function displayMessage(message, type) {
    const div = document.createElement('div');
    div.textContent = message;
    div.classList.add(type === 'sent' ? 'sent-message' : 'received-message');
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Event listeners
startChatButton.addEventListener('click', startChat);
stopChatButton.addEventListener('click', stopChat);
sendButton.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', e => { if(e.key==='Enter'){e.preventDefault();sendMessage();} });
settingsIcon.addEventListener('click', () => settingsModal.style.display='block');
closeSettingsButton.addEventListener('click', () => settingsModal.style.display='none');

// ---------- CONFIG (modifie ici si besoin) ----------
const BACKEND_URL = "https://flayz13s-projects.up.railway.app"; // <- mettre l'URL HTTPS de ton serveur déployé
// Si tu testes localement (serveur sur ta machine), remplace par "http://localhost:3000"

// Derived WebSocket URL
const SIGNALING_URL = BACKEND_URL.replace(/^http/, "ws");

// ---------- UI elements ----------
const loginButton = document.getElementById('login-button');
const loginContainer = document.getElementById('login-container');
const loginError = document.getElementById('login-error');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

const chatContainer = document.getElementById('chat-container');
const myVideo = document.getElementById('my-stream');
const otherVideo = document.getElementById('other-stream');
const startChatButton = document.getElementById('start-chat');
const stopChatButton = document.getElementById('stop-chat');
const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');
const sendButton = document.getElementById('send-button');

const videoSelect = document.getElementById('video-input');
const audioSelect = document.getElementById('audio-input');
const audioOutputSelect = document.getElementById('audio-output');
const settingsModal = document.getElementById('settings-modal');
const settingsIcon = document.getElementById('settings-icon');
const closeSettingsButton = document.getElementById('close-settings');

let signalingSocket = null;
let peerConnection = null;
let myStream = null;
let currentUser = null;
const iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// ---------- UTIL helpers ----------
function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
}
function hideLoginError() {
    loginError.style.display = 'none';
}
function displayMessage(text, type) {
    const d = document.createElement('div');
    d.textContent = text;
    d.className = type === 'sent' ? 'sent-message' : 'received-message';
    chatBox.appendChild(d);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ---------- Populate device lists ----------
async function populateDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

        videoSelect.innerHTML = '';
        audioSelect.innerHTML = '';
        audioOutputSelect.innerHTML = '';

        videoDevices.forEach((d, i) => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || `Caméra ${i+1}`;
            videoSelect.appendChild(opt);
        });
        audioInputs.forEach((d,i) => {
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
    } catch (err) {
        console.warn('Impossible d\'énumérer les devices :', err);
    }
}

// ---------- Login flow ----------
loginButton.addEventListener('click', async () => {
    hideLoginError();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        showLoginError("Veuillez remplir tous les champs");
        return;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.status === 401) {
            showLoginError("Nom d'utilisateur ou mot de passe invalide");
            return;
        }
        if (!res.ok) {
            // réseau / serveur -> afficher message plus clair
            const text = await res.text().catch(()=>res.statusText);
            showLoginError(`Erreur serveur: ${res.status} ${text}`);
            console.error('Login failed response:', res.status, text);
            return;
        }

        const data = await res.json();
        if (!data.token) {
            showLoginError("Réponse serveur incorrecte (pas de token)");
            console.error('Login response:', data);
            return;
        }

        // login OK
        currentUser = username;
        loginContainer.style.display = 'none';
        chatContainer.style.display = 'flex';

        // Connect to signaling (WebSocket)
        connectSignaling(data.token);

        // populate device lists (best-effort)
        await populateDevices();
    } catch (err) {
        // fetch/network error (ex: mixed content blocked, server down, DNS)
        console.error('Erreur fetch login:', err);
        showLoginError("Impossible de contacter le serveur. Vérifiez l'URL backend et la connexion réseau.");
    }
});

// ---------- Signaling (WebSocket) ----------
function connectSignaling(token) {
    try {
        signalingSocket = new WebSocket(`${SIGNALING_URL}`);
    } catch (err) {
        console.error('Erreur création WebSocket:', err);
        showLoginError("Impossible d'ouvrir la connexion WebSocket.");
        return;
    }

    signalingSocket.onopen = () => {
        console.log('Signaling connected, sending auth token');
        signalingSocket.send(JSON.stringify({ type: 'auth', token }));
    };

    signalingSocket.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);
        console.log('Signaling message:', data);

        if (data.type === 'auth_success') {
            console.log('Auth websocket réussie');
            return;
        }
        if (data.type === 'auth_error') {
            showLoginError("Authentification WebSocket échouée");
            signalingSocket.close();
            return;
        }
        if (data.type === 'chat') displayMessage(data.message, 'received');

        // WebRTC signaling
        if (data.type === 'offer') {
            if (!peerConnection) await preparePeer(false); // prepare for receiving
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            signalingSocket.send(JSON.stringify({ type: 'answer', answer }));
        } else if (data.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.type === 'candidate') {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.warn('Erreur addIceCandidate', e);
            }
        }
    };

    signalingSocket.onerror = (e) => {
        console.error('WebSocket error', e);
    };

    signalingSocket.onclose = () => {
        console.log('WebSocket closed');
    };
}

// ---------- WebRTC: prepare peer connection ----------
async function preparePeer(isOfferer = true) {
    peerConnection = new RTCPeerConnection(iceServers);

    peerConnection.onicecandidate = (e) => {
        if (e.candidate && signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
            signalingSocket.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
        }
    };

    peerConnection.ontrack = (e) => {
        otherVideo.srcObject = e.streams[0];
    };

    if (myStream) {
        myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream));
    }

    return peerConnection;
}

// ---------- Start chat ----------
startChatButton.addEventListener('click', async () => {
    // check media
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const audioInputs = devices.filter(d => d.kind === 'audioinput');

        if (videoDevices.length === 0 || audioInputs.length === 0) {
            alert("Veuillez autoriser l'accès à la caméra et au microphone.");
            return;
        }

        // Choose camera based on username:
        // Veynes -> left camera (videoDevices[0])
        // Gap -> right camera (videoDevices[1] if exists, else [0])
        let chosenDeviceId = videoDevices[0].deviceId;
        if (currentUser === 'Gap') chosenDeviceId = videoDevices[1]?.deviceId || videoDevices[0].deviceId;
        else chosenDeviceId = videoDevices[0].deviceId;

        myStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: chosenDeviceId ? { exact: chosenDeviceId } : undefined },
            audio: true
        });
        myVideo.srcObject = myStream;

        // Set select value in settings
        if (videoSelect.querySelector(`option[value="${chosenDeviceId}"]`)) {
            videoSelect.value = chosenDeviceId;
        }

        await preparePeer(true);

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingSocket.send(JSON.stringify({ type: 'offer', offer }));

        startChatButton.classList.add('hidden');
        stopChatButton.classList.remove('hidden');
    } catch (err) {
        console.error('startChat error:', err);
        alert('Erreur lors du démarrage du chat : ' + (err.message || err));
    }
});

// ---------- Stop chat ----------
stopChatButton.addEventListener('click', () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (myStream) {
        myStream.getTracks().forEach(t => t.stop());
        myStream = null;
    }
    myVideo.srcObject = null;
    otherVideo.srcObject = null;
    startChatButton.classList.remove('hidden');
    stopChatButton.classList.add('hidden');
});

// ---------- Send / Receive chat ----------
sendButton.addEventListener('click', () => {
    const m = chatInput.value.trim();
    if (!m) return;
    displayMessage(m, 'sent');
    if (signalingSocket && signalingSocket.readyState === WebSocket.OPEN) {
        signalingSocket.send(JSON.stringify({ type: 'chat', message: m }));
    }
    chatInput.value = '';
});
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendButton.click(); } });

// ---------- Settings modal ----------
settingsIcon.addEventListener('click', () => settingsModal.style.display = 'block');
closeSettingsButton.addEventListener('click', () => settingsModal.style.display = 'none');

// populate devices on load
populateDevices();

// Video elements and controls
const myVideo = document.getElementById('my-stream');
const otherVideo = document.getElementById('other-stream');
const startChatButton = document.getElementById('start-chat');
const stopChatButton = document.getElementById('stop-chat');

// Chat elements
const chatInput = document.getElementById('chat-input');
const chatBox = document.getElementById('chat-box');
const sendButton = document.getElementById('send-button');

// Settings modal elements
const videoSelect = document.getElementById('video-input');
const audioSelect = document.getElementById('audio-input');
const audioOutputSelect = document.getElementById('audio-output');
const volumeControl = document.getElementById('volume-control');
const settingsModal = document.getElementById('settings-modal');
const settingsIcon = document.getElementById('settings-icon');
const closeSettingsButton = document.getElementById('close-settings');

// WebRTC and WebSocket setup
let myStream;
let peerConnection;
const iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }; // STUN server
const signalingServer = new WebSocket('ws://your-signaling-server.com'); // Replace with your server's address

// Request camera and microphone permissions
async function requestMediaPermissions() {
    try {
        // Request access to video and audio
        myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        myVideo.srcObject = myStream; // Display local video stream
        console.log('Access to camera granted.');
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Please grant permission to access your camera and microphone.');
        return false;
    }
    return true;
}

// Start video chat
async function startChat() {
    const permissionGranted = await requestMediaPermissions();
    if (!permissionGranted) return;

    try {
        // Initialize WebRTC peer connection
        peerConnection = new RTCPeerConnection(iceServers);

        // Add local stream tracks to peer connection
        myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream));

        // Listen for ICE candidates and send them to the signaling server
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                signalingServer.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
            }
        };

        // Display remote stream when received
        peerConnection.ontrack = event => {
            otherVideo.srcObject = event.streams[0];
        };

        // Create and send an offer to start the connection
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingServer.send(JSON.stringify({ type: 'offer', offer }));

        startChatButton.classList.add('hidden');
        stopChatButton.classList.remove('hidden');
    } catch (error) {
        console.error('Error starting video chat:', error);
    }
}

// Stop video chat
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

    startChatButton.classList.remove('hidden');
    stopChatButton.classList.add('hidden');
}

// Send a chat message
function sendMessage() {
    const message = chatInput.value.trim();
    if (message !== '') {
        signalingServer.send(JSON.stringify({ type: 'chat', message }));
        displayMessage(message, 'sent');
        chatInput.value = '';
    }
}

// Display a chat message
function displayMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.classList.add(type === 'sent' ? 'sent-message' : 'received-message');
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Populate device selectors
async function populateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const audioDevices = devices.filter(device => device.kind === 'audioinput');
    const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput');

    videoDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Camera ${videoDevices.indexOf(device) + 1}`;
        videoSelect.appendChild(option);
    });

    audioDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${audioDevices.indexOf(device) + 1}`;
        audioSelect.appendChild(option);
    });

    audioOutputDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Speaker ${audioOutputDevices.indexOf(device) + 1}`;
        audioOutputSelect.appendChild(option);
    });
}

// Event listeners
startChatButton.addEventListener('click', startChat);
stopChatButton.addEventListener('click', stopChat);
sendButton.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});
settingsIcon.addEventListener('click', () => settingsModal.style.display = 'block');
closeSettingsButton.addEventListener('click', () => settingsModal.style.display = 'none');

// Initialize device selectors on page load
populateDevices();

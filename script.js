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
const iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }; // STUN server
const signalingServer = new WebSocket('wss://flayz13s-projects.up.railway.app'); // Replace with your server's address

// Camera and Microphone Selection (for settings)
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

// Handle login
loginButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();

    if (username) {
        // Here you would handle login logic (for example, sending the username to the server)
        loginContainer.style.display = 'none';
        chatContainer.style.display = 'flex'; // Show the video chat container
    } else {
        loginError.style.display = 'block';
    }
});

// When connected to the signaling server
signalingServer.onopen = () => {
    console.log('Connected to the signaling server');

    // Authentification avec le serveur WebSocket via un token
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiZGVtbyIsImlhdCI6MTc0NDI4NjA2NX0.YyHjKa7mxyINCy5ul4ykNi576410cN2zUE-aQxagY5M"; // Utiliser un token généré sur le serveur
    signalingServer.send(JSON.stringify({ type: 'auth', token }));
};

// Request camera and microphone permissions if not granted
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

// Start the video chat by accessing the local video stream
async function startChat() {
    const permissionGranted = await requestMediaPermissions();
    if (!permissionGranted) return;

    try {
        // Get local stream
        myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        myVideo.srcObject = myStream;

        // Initialize WebRTC connection
        peerConnection = new RTCPeerConnection(iceServers);

        // Add local stream tracks to the peer connection
        myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream));

        // Listen for ICE candidates and send them to the other peer
        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                signalingServer.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
            }
        };

        // Display the remote stream when received
        peerConnection.ontrack = event => {
            console.log('Remote stream received');
            otherVideo.srcObject = event.streams[0];
        };

        // Create an offer to start the connection
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingServer.send(JSON.stringify({ type: 'offer', offer }));

        startChatButton.classList.add('hidden');
        stopChatButton.classList.remove('hidden');
    } catch (error) {
        console.error('Erreur lors du démarrage du chat vidéo :', error);
    }
}

// Handle signaling messages from the other peer
signalingServer.onmessage = async message => {
    const data = JSON.parse(message.data);
    console.log('Message received from signaling server:', data);

    // Handle chat messages
    if (data.type === 'chat') {
        displayMessage(data.message, 'received');
    }

    // Handle WebRTC signaling messages
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
    } else if (data.type === 'auth_success') {
        console.log('Authentification réussie');
    } else if (data.type === 'auth_error') {
        console.error('Erreur d\'authentification');
    }
};

// Stop both local and remote streams
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

// Send message function
function sendMessage() {
    const message = chatInput.value.trim();

    if (message !== '') {
        // Display message in chat box
        displayMessage(message, 'sent');
        
        // Send the message to the signaling server
        signalingServer.send(JSON.stringify({ type: 'chat', message }));

        // Clear the input field after sending the message
        chatInput.value = '';
    }
}

// Display message in the chat box
function displayMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.classList.add(type === 'sent' ? 'sent-message' : 'received-message');
    chatBox.appendChild(messageDiv);

    // Scroll to the bottom
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Event listeners
startChatButton.addEventListener('click', startChat);
stopChatButton.addEventListener('click', stopChat);

// Handle "Send" button click
sendButton.addEventListener('click', sendMessage);

// Handle "Enter" key press to send messages
chatInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();  // Prevent the default Enter behavior (like line break)
        sendMessage();  // Call sendMessage
    }
});

// Auto-populate video and audio device inputs
async function populateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    const audioDevices = devices.filter(device => device.kind === 'audioinput');
    const audioOutputDevices = devices.filter(device => device.kind === 'audiooutput');

    videoDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Caméra ${videoDevices.indexOf(device) + 1}`;
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
        option.textContent = device.label || `Haut-parleur ${audioOutputDevices.indexOf(device) + 1}`;
        audioOutputSelect.appendChild(option);
    });
}

// Populate device selectors on page load
populateDevices();

// Open and close settings modal
settingsIcon.addEventListener('click', () => {
    settingsModal.style.display = 'block';
});

closeSettingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

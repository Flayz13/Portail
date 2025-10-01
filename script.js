let socket;
let peerConnection;
let localStream;
let currentUser;
let token;

const loginContainer = document.getElementById("login-container");
const chatContainer = document.getElementById("chat-container");
const errorMessage = document.getElementById("error-message");
const loginBtn = document.getElementById("loginBtn");

// Bouton connexion
loginBtn.addEventListener("click", async () => {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
        const res = await fetch("http://localhost:3000/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) throw new Error("Erreur lors de la connexion");

        const data = await res.json();
        token = data.token;
        currentUser = username;

        loginContainer.style.display = "none";
        chatContainer.style.display = "flex";

        initWebSocket();
    } catch (err) {
        errorMessage.textContent = "Nom d'utilisateur ou mot de passe invalide";
    }
});

function initWebSocket() {
    socket = new WebSocket("ws://localhost:3000");

    socket.onopen = () => {
        socket.send(JSON.stringify({ type: "auth", token }));
    };

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "auth_success") {
            console.log("Connecté en tant que", data.user);
        }

        if (data.type === "offer") {
            await createPeerConnection();
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.send(JSON.stringify({ type: "answer", answer }));
        }

        if (data.type === "answer" && peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }

        if (data.type === "candidate" && peerConnection) {
            try {
                await peerConnection.addIceCandidate(data.candidate);
            } catch (e) {
                console.error("Erreur ICE", e);
            }
        }
    };
}

async function createPeerConnection() {
    peerConnection = new RTCPeerConnection();

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
        }
    };

    peerConnection.ontrack = (event) => {
        // Choisir l'écran en fonction de l'utilisateur
        if (event.streams && event.streams[0]) {
            if (currentUser === "Gap") {
                document.getElementById("video-veynes").srcObject = event.streams[0];
            } else if (currentUser === "Veynes") {
                document.getElementById("video-gap").srcObject = event.streams[0];
            }
        }
    };

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    if (currentUser === "Veynes") {
        document.getElementById("video-veynes").srcObject = localStream;
    } else if (currentUser === "Gap") {
        document.getElementById("video-gap").srcObject = localStream;
    }
}

// Bouton "Démarrer appel"
document.getElementById("startCallBtn").addEventListener("click", async () => {
    await createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: "offer", offer }));
});

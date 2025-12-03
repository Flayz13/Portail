// client.js (Anciennement server.js)

// --- VARIABLES GLOBALES (À CONSERVER EN HAUT DE VOTRE FICHIER) ---
const myVideo = document.getElementById('my-stream');
const otherVideo = document.getElementById('other-stream');
const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const startButton = document.getElementById('start-chat');
const skipButton = document.getElementById('skip-btn');
const stopButton = document.getElementById('stop-chat');

let partnerId = null;
let peerConnection; // Votre objet RTCPeerConnection
let localStream; // Votre flux vidéo/audio local
// Assurez-vous que le port correspond à celui de votre serveur Node.js (ex: 3000)
const socket = new WebSocket("ws://localhost:3000"); 


// -----------------------------------------------------------
// --- NOUVELLES FONCTIONS D'INTERFACE ET DE CHAT ---
// -----------------------------------------------------------

/**
 * Affiche un message dans la boîte de chat.
 * @param {string} message - Le contenu du message.
 * @param {string} senderType - 'sent' ou 'received'.
 */
function displayMessage(message, senderType) {
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.classList.add(senderType === 'sent' ? 'sent-message' : 'received-message');
    chatBox.appendChild(messageDiv);
    // Défile vers le bas pour voir le dernier message
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Gère l'envoi d'un message via WebSocket.
 */
function sendMessage() {
    const message = chatInput.value.trim();
    if (message !== '' && partnerId) {
        // 1. Envoyer le message via WebSocket au serveur backend
        const chatData = {
            type: 'chat',
            message: message,
            targetId: partnerId // Le backend reliera vers le partenaire
        };
        socket.send(JSON.stringify(chatData));
        
        // 2. Afficher le message localement (dans votre propre chatbox)
        displayMessage(`Moi: ${message}`, 'sent');
        
        // 3. Vider le champ de saisie
        chatInput.value = '';
    }
}


// -----------------------------------------------------------
// --- GESTION DES ÉVÉNEMENTS (AJOUTS CLÉS) ---
// -----------------------------------------------------------

// 1. Événement pour le clic sur le bouton "Envoyer"
sendButton.addEventListener('click', sendMessage);

// 2. Événement pour la touche "Entrée" dans le champ de saisie
chatInput.addEventListener('keypress', (event) => {
    // Vérifie si la touche pressée est 'Enter'
    if (event.key === 'Enter') {
        event.preventDefault(); // Empêche le retour à la ligne par défaut
        sendMessage();
    }
});

// 3. Événement Démarrer/Arrêter/Skip (Connexion à remplacer par vos fonctions réelles)
startButton.addEventListener('click', () => {
    // Logique pour commencer la recherche de partenaire
    socket.send(JSON.stringify({ type: 'search' })); 
    startButton.classList.add('hidden');
    stopButton.classList.remove('hidden');
    displayMessage("Recherche d'un partenaire en cours...", "received");
    // Initialisez la caméra ici (votre fonction d'initialisation)
    // initLocalStream(); 
});

stopButton.addEventListener('click', () => {
    // Logique pour se déconnecter du partenaire actuel et s'arrêter
    // closeCall(); // Votre fonction pour fermer la connexion WebRTC
    startButton.classList.remove('hidden');
    stopButton.classList.add('hidden');
    displayMessage("Chat terminé. Cliquez sur Démarrer pour chercher un nouveau partenaire.", "received");
});

skipButton.addEventListener('click', () => {
    // Logique pour sauter le partenaire (envoie la déconnexion et relance la recherche)
    // closeCall(); // Votre fonction pour fermer la connexion WebRTC
    socket.send(JSON.stringify({ type: 'search' }));
    displayMessage("Partenaire ignoré. Recherche d'un nouveau match...", "received");
});


// -----------------------------------------------------------
// --- GESTION DES MESSAGES DU SERVEUR (Mise à jour) ---
// -----------------------------------------------------------

socket.onopen = () => {
    console.log("Connecté au serveur WebSocket.");
};

socket.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);

    switch (data.type) {
        case 'match':
            // Nouvelle fonction pour démarrer l'appel WebRTC
            partnerId = data.partner;
            // startCall(data.partner); 
            console.log(`Match trouvé avec ${partnerId}`);
            displayMessage("Partenaire trouvé ! Démarrage de la connexion vidéo...", "received");
            startButton.classList.add('hidden');
            skipButton.classList.remove('hidden');
            break;

        case 'chat':
            // ⭐️ NOUVEAU: Affichage du message reçu
            displayMessage(`Partenaire: ${data.message}`, 'received');
            break;

        case 'partner_disconnected':
            // Gérer la déconnexion du partenaire
            // closeCall(); // Votre fonction pour nettoyer l'appel
            partnerId = null;
            displayMessage("Le partenaire a mis fin à la conversation. En recherche d'un nouveau match...", "received");
            // Relancer la recherche automatiquement
            socket.send(JSON.stringify({ type: "search" }));
            break;
            
        // ... (vos autres cas: 'offer', 'answer', 'candidate' pour WebRTC) ...

        default:
            console.log("Message inconnu reçu:", data.type);
    }
};

socket.onclose = () => {
    console.warn("Déconnexion du serveur WebSocket.");
};

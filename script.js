// Charger le modèle Teachable Machine
let classifier;
let modelURL = "https://teachablemachine.withgoogle.com/models/WMlLAhdMKq/model.json";

// Détection des mains
let handsDetector;
let numHands = 0;
let canvasElement;
let canvasCtx;

// Variables pour le jeu
let player1Move = "En attente...";
let player2Move = "En attente...";
let scoreJoueur = 0;
let scoreOrdi = 0;
let gameHistory = [];
let roundsToWin = 3; // Nombre de manches à gagner pour le tournoi
let gameMode = "solo"; // "solo" ou "duo"
let isGameActive = false;

// Fonction pour initialiser la détection de mains
async function setupHandsDetection() {
    handsDetector = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    handsDetector.setOptions({
        maxNumHands: 2, // Détecte jusqu'à 2 mains
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    canvasElement = document.getElementById("canvas");
    canvasCtx = canvasElement.getContext("2d");

    handsDetector.onResults((results) => {
        numHands = results.multiHandLandmarks.length; // Nombre de mains détectées
        
        // Afficher le nombre de mains détectées
        document.getElementById("hands-count").innerText = `Mains détectées: ${numHands}`;
        
        // Dessiner les repères des mains sur le canvas
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Dessiner l'image vidéo en miroir
        canvasCtx.drawImage(
            results.image, 0, 0, canvasElement.width, canvasElement.height
        );
        
        // Dessiner les landmarks des mains
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS,
                              {color: '#00FF00', lineWidth: 3});
                drawLandmarks(canvasCtx, landmarks, {
                    color: '#FF0000', lineWidth: 1, radius: 3
                });
            }
        }
        
        canvasCtx.restore();
    });

    const videoElement = document.getElementById("video");
    
    // Ajuster la taille du canvas à celle de la vidéo
    canvasElement.width = videoElement.width;
    canvasElement.height = videoElement.height;
    
    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await handsDetector.send({ image: videoElement });
        },
        width: 640,
        height: 480
    });

    camera.start();
}

// Fonction pour initialiser le modèle et la webcam
async function setup() {
    await tf.setBackend('cpu'); // Force le CPU pour éviter les erreurs WebGL
    console.log("✅ Backend forcé sur CPU");

    await setupHandsDetection(); // Démarrer la détection des mains
    classifier = await ml5.imageClassifier(modelURL, modelReady);

    let video = document.getElementById("video");
    navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
            video.srcObject = stream;
        });
        
    // Initialiser les boutons de l'interface
    setupUI();
}

// Configuration de l'interface utilisateur
function setupUI() {
    // Bouton pour changer de mode de jeu
    document.getElementById("toggle-mode").addEventListener("click", toggleGameMode);
    
    // Bouton pour commencer une nouvelle partie
    document.getElementById("start-game").addEventListener("click", startNewGame);
    
    // Bouton pour réinitialiser les scores
    document.getElementById("reset-scores").addEventListener("click", resetScores);
    
    // Sélecteur pour le nombre de manches
    document.getElementById("rounds-selector").addEventListener("change", function() {
        roundsToWin = parseInt(this.value);
        updateGameInfo();
    });
}

// Fonction pour changer de mode de jeu
function toggleGameMode() {
    gameMode = gameMode === "solo" ? "duo" : "solo";
    document.getElementById("toggle-mode").innerText = 
        gameMode === "solo" ? "Mode: Solo (vs IA)" : "Mode: Duo (2 joueurs)";
    updateGameInfo();
}

// Fonction pour commencer une nouvelle partie
function startNewGame() {
    resetScores();
    isGameActive = true;
    document.getElementById("start-game").innerText = "Partie en cours...";
    document.getElementById("start-game").disabled = true;
    
    updateGameInfo();
    startCountdown(classifyVideo);
}

// Fonction pour réinitialiser les scores
function resetScores() {
    scoreJoueur = 0;
    scoreOrdi = 0;
    gameHistory = [];
    updateScoreboard();
    updateGameHistory();
}

// Mettre à jour les informations du jeu
function updateGameInfo() {
    let infoText = `Mode: ${gameMode === "solo" ? "Solo (vs IA)" : "Duo (2 joueurs)"}<br>`;
    infoText += `Premier à ${roundsToWin} victoires`;
    document.getElementById("game-info").innerHTML = infoText;
}

// Fonction appelée lorsque le modèle est prêt
function modelReady() {
    console.log("✅ Modèle chargé avec succès !");
    document.getElementById("loading-indicator").style.display = "none";
    document.getElementById("game-controls").style.display = "block";
    updateGameInfo();
}

// Fonction pour classifier la vidéo et détecter Pierre-Feuille-Ciseaux
function classifyVideo() {
    if (!isGameActive) return;
    
    classifier.classify(document.getElementById("video"), gotResult);
}

// Fonction pour traiter les résultats après classification
function gotResult(error, results) {
    if (error) {
        console.error(error);
        return;
    }

    if (numHands === 1) {
        player1Move = results[0].label;
        
        if (gameMode === "solo") {
            player2Move = getRandomMove(); // L'ordi joue aléatoirement
            evaluateRound();
        } else {
            player2Move = "En attente...";
            document.getElementById("move-p1").innerText = `Joueur 1: ${player1Move}`;
            document.getElementById("move-p2").innerText = `Joueur 2: En attente...`;
            // Attendre la seconde main dans le mode duo
        }
    } else if (numHands === 2 && gameMode === "duo") {
        // Essayer de classifier les deux mains séparément
        // Note: Ceci est une simplification, une solution plus robuste nécessiterait 
        // une segmentation plus précise des deux mains
        classifier.classify(document.getElementById("video"), (error, secondResults) => {
            if (error) {
                console.error(error);
                return;
            }
            player1Move = results[0].label;
            player2Move = secondResults[0].label; // Utiliser le second résultat pour la 2e main
            evaluateRound();
        });
    } else {
        player1Move = "Aucune main";
        player2Move = "Aucune main";
        
        if (isGameActive) {
            startCountdown(classifyVideo);
        }
    }
}

// Évaluer les résultats d'une manche
function evaluateRound() {
    document.getElementById("move-p1").innerText = `Joueur 1: ${player1Move}`;
    document.getElementById("move-p2").innerText = `${gameMode === "solo" ? "IA" : "Joueur 2"}: ${player2Move}`;
    
    determineWinner(player1Move, player2Move);
    
    // Vérifier si un joueur a gagné le tournoi
    if (scoreJoueur >= roundsToWin || scoreOrdi >= roundsToWin) {
        endGame();
    } else if (isGameActive) {
        // Continuer la partie
        setTimeout(() => {
            startCountdown(classifyVideo);
        }, 2000);
    }
}

// Terminer la partie
function endGame() {
    isGameActive = false;
    let winner = scoreJoueur >= roundsToWin ? "Joueur 1" : (gameMode === "solo" ? "IA" : "Joueur 2");
    
    document.getElementById("result").innerHTML = 
        `<div class="winner-announcement">🏆 ${winner} remporte le tournoi! 🏆</div>`;
        
    document.getElementById("start-game").innerText = "Nouvelle partie";
    document.getElementById("start-game").disabled = false;
}

// Fonction pour générer un coup aléatoire pour l'ordinateur
function getRandomMove() {
    const moves = ["Pierre", "Feuille", "Ciseaux"];
    return moves[Math.floor(Math.random() * moves.length)];
}

// Fonction pour déterminer le gagnant et afficher le score
function determineWinner(player1, player2) {
    if (player1 === "Aucune main" || player2 === "Aucune main") {
        document.getElementById("result").innerHTML = 
            `<div class="waiting">⏳ En attente d'un joueur...</div>`;
        return;
    }

    let winner = "";
    let resultClass = "";

    if (
        (player1 === "Pierre" && player2 === "Ciseaux") ||
        (player1 === "Feuille" && player2 === "Pierre") ||
        (player1 === "Ciseaux" && player2 === "Feuille")
    ) {
        winner = "🎉 Joueur 1 gagne !";
        resultClass = "player1-win";
        scoreJoueur++;
    } else if (player1 === player2) {
        winner = "🤝 Égalité !";
        resultClass = "draw";
    } else {
        winner = gameMode === "solo" ? "🔥 L'IA gagne !" : "🔥 Joueur 2 gagne !";
        resultClass = "player2-win";
        scoreOrdi++;
    }

    // Ajouter à l'historique
    gameHistory.push({
        player1: player1,
        player2: player2,
        winner: winner
    });

    // Mettre à jour l'affichage
    document.getElementById("result").innerHTML = 
        `<div class="${resultClass}">${winner}</div>`;
    
    updateScoreboard();
    updateGameHistory();
}

// Mettre à jour le tableau des scores
function updateScoreboard() {
    document.getElementById("score").innerHTML = 
        `<span class="score-p1">${scoreJoueur}</span> - <span class="score-p2">${scoreOrdi}</span>`;
}

// Mettre à jour l'historique des parties
function updateGameHistory() {
    const historyElement = document.getElementById("game-history");
    historyElement.innerHTML = "";
    
    // Limiter l'historique aux 5 dernières manches
    const recentHistory = gameHistory.slice(-5);
    
    recentHistory.forEach((round, index) => {
        const roundElement = document.createElement("div");
        roundElement.className = "history-item";
        roundElement.innerHTML = `
            <span class="round-number">Manche ${gameHistory.length - recentHistory.length + index + 1}</span>
            <span class="move">${round.player1}</span> vs 
            <span class="move">${round.player2}</span>
            <span class="result">${round.winner}</span>
        `;
        historyElement.appendChild(roundElement);
    });
}

// Fonction pour afficher un compte à rebours "1, 2, 3, BOOM !" avant la détection
function startCountdown(callback) {
    let count = 3;
    document.getElementById("result").innerHTML = `<div class="countdown-prepare">Préparez-vous...</div>`;

    let countdownInterval = setInterval(() => {
        if (count > 0) {
            document.getElementById("result").innerHTML = `<div class="countdown">${count}</div>`;
            count--;
        } else {
            clearInterval(countdownInterval);
            document.getElementById("result").innerHTML = `<div class="countdown-boom">BOOM !</div>`;

            // Figer les mains et classifier une dernière fois
            setTimeout(() => {
                callback();
            }, 500);
        }
    }, 1000);
}

// Lancer l'initialisation au chargement de la page
window.onload = setup;
// Charger le modèle Teachable Machine
let classifier;
let modelURL = "https://teachablemachine.withgoogle.com/models/WMlLAhdMKq/model.json";

// Détection des mains
let handsDetector;
let numHands = 0;
let handLandmarks = [];

// Variables pour le jeu
let player1Move = "En attente...";
let player2Move = "En attente...";
let scoreJoueur = 0;
let scoreOrdi = 0;
let isGameActive = false;
let gameMode = "solo"; // "solo" ou "duo"
let roundsToWin = 3;
let gameHistory = [];
let confidence = 0;

// Éléments DOM
let videoElement;
let canvasElement;
let canvasCtx;

// Fonction pour initialiser la détection de mains
async function setupHandsDetection() {
    const handsDetector = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    handsDetector.setOptions({
        maxNumHands: 2, // Détecte jusqu'à 2 mains
        modelComplexity: 1,
        minDetectionConfidence: 0.7, // Augmenté pour plus de précision
        minTrackingConfidence: 0.7
    });

    handsDetector.onResults((results) => {
        // Mettre à jour le nombre de mains détectées
        numHands = results.multiHandLandmarks.length;
        handLandmarks = results.multiHandLandmarks;
        
        // Mise à jour de l'interface
        document.getElementById("hands-count").innerText = `Mains détectées: ${numHands}`;
        
        // Dessiner les mains sur le canvas
        drawHands(results);
    });

    return handsDetector;
}

// Dessiner les mains sur le canvas
function drawHands(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Dessiner d'abord la vidéo
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    
    // Dessiner les landmarks des mains
    if (results.multiHandLandmarks) {
        for (const landmarks of results.multiHandLandmarks) {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 3});
            drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 3});
        }
    }
    
    canvasCtx.restore();
}

// Fonction pour initialiser le modèle et la webcam
async function setup() {
    // Récupérer les éléments DOM
    videoElement = document.getElementById("video");
    canvasElement = document.getElementById("canvas");
    canvasCtx = canvasElement.getContext('2d');
    
    // Dimensionner le canvas pour correspondre à la vidéo
    canvasElement.width = 640;
    canvasElement.height = 480;
    
    try {
        await tf.setBackend('webgl'); // Essayer d'utiliser WebGL pour de meilleures performances
        console.log("✅ Backend: WebGL");
    } catch (e) {
        await tf.setBackend('cpu'); // Fallback sur CPU si WebGL échoue
        console.log("✅ Backend: CPU (fallback)");
    }

    // Afficher l'indicateur de chargement
    document.getElementById("loading-indicator").style.display = "flex";

    try {
        // Initialiser la détection des mains
        handsDetector = await setupHandsDetection();
        
        // Charger le modèle de classification
        classifier = await ml5.imageClassifier(modelURL);
        
        console.log("✅ Modèle chargé avec succès !");
        
        // Configuration de la caméra
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await handsDetector.send({ image: videoElement });
            },
            width: 640,
            height: 480
        });
        
        await camera.start();
        console.log("✅ Caméra démarrée");
        
        // Masquer l'indicateur de chargement une fois tout chargé
        document.getElementById("loading-indicator").style.display = "none";
        // Afficher les contrôles du jeu
        document.getElementById("game-controls").style.display = "block";
        
        // Initialiser les gestionnaires d'événements pour les boutons
        setupEventListeners();
        
    } catch (error) {
        console.error("Erreur lors de l'initialisation:", error);
        document.getElementById("loading-indicator").innerHTML = `
            <p style="color: red">Erreur lors du chargement: ${error.message}</p>
            <button onclick="location.reload()" class="btn">Réessayer</button>
        `;
    }
}

// Initialiser les gestionnaires d'événements
function setupEventListeners() {
    // Bouton pour changer de mode de jeu
    document.getElementById("toggle-mode").addEventListener("click", () => {
        gameMode = gameMode === "solo" ? "duo" : "solo";
        const modeText = gameMode === "solo" ? "Solo (vs IA)" : "Duo (2 joueurs)";
        document.getElementById("toggle-mode").innerText = `Mode: ${modeText}`;
        document.getElementById("game-info").innerText = `Mode: ${modeText}\nPremier à ${roundsToWin} victoires`;
        
        // Mettre à jour l'affichage du joueur 2
        document.getElementById("move-p2").innerText = gameMode === "solo" ? "IA: En attente..." : "Joueur 2: En attente...";
    });
    
    // Sélecteur de nombre de manches
    document.getElementById("rounds-selector").addEventListener("change", (e) => {
        roundsToWin = parseInt(e.target.value);
        document.getElementById("game-info").innerText = `Mode: ${gameMode === "solo" ? "Solo (vs IA)" : "Duo (2 joueurs)"}\nPremier à ${roundsToWin} victoires`;
    });
    
    // Bouton pour commencer la partie
    document.getElementById("start-game").addEventListener("click", startGame);
    
    // Bouton pour réinitialiser les scores
    document.getElementById("reset-scores").addEventListener("click", resetScores);
}

// Fonction pour commencer une nouvelle partie
function startGame() {
    if (isGameActive) return;
    
    resetScores();
    document.getElementById("result").innerText = "Préparez-vous...";
    document.getElementById("start-game").innerText = "Partie en cours...";
    document.getElementById("start-game").disabled = true;
    
    isGameActive = true;
    startCountdown(classifyVideo);
}

// Fonction pour réinitialiser les scores
function resetScores() {
    scoreJoueur = 0;
    scoreOrdi = 0;
    gameHistory = [];
    
    document.querySelector(".score-p1").innerText = "0";
    document.querySelector(".score-p2").innerText = "0";
    document.getElementById("game-history").innerHTML = "";
    
    document.getElementById("move-p1").innerText = "Joueur 1: En attente...";
    document.getElementById("move-p2").innerText = gameMode === "solo" ? "IA: En attente..." : "Joueur 2: En attente...";
    document.getElementById("result").innerText = "Prêt à jouer ?";
}

// Fonction pour classifier la vidéo et détecter Pierre-Feuille-Ciseaux
function classifyVideo() {
    if (!isGameActive) return;
    
    if (numHands === 0) {
        document.getElementById("result").innerText = "❓ Aucune main détectée. Montrez vos mains !";
        setTimeout(classifyVideo, 1000);
        return;
    }
    
    classifier.classify(videoElement, gotResult);
}

// Fonction pour traiter les résultats après classification
function gotResult(error, results) {
    if (error) {
        console.error("Erreur de classification:", error);
        document.getElementById("result").innerText = `Erreur: ${error.message || "Classification échouée"}`;
        setTimeout(classifyVideo, 1000);
        return;
    }
    
    if (!results || results.length === 0) {
        setTimeout(classifyVideo, 1000);
        return;
    }
    
    confidence = Math.round(results[0].confidence * 100);
    
    if (gameMode === "solo") {
        // Mode solo: le joueur contre l'IA
        if (numHands >= 1) {
            player1Move = results[0].label;
            player2Move = getRandomMove();
            
            finishRound();
        } else {
            document.getElementById("result").innerText = "❓ Montrez votre main pour jouer !";
            setTimeout(classifyVideo, 1000);
        }
    } else {
        // Mode duo: deux joueurs humains
        if (numHands === 2) {
            // Pour le mode duo, nous devons détecter séparément les deux mains
            // Ici, nous utilisons simplement les coordonnées X pour différencier gauche/droite
            
            // Identifier les mains gauche et droite
            let leftHandIndex = 0;
            let rightHandIndex = 1;
            
            if (handLandmarks[0][0].x > handLandmarks[1][0].x) {
                leftHandIndex = 1;
                rightHandIndex = 0;
            }
            
            // Pour simplifier, nous utilisons le même modèle pour les deux mains
            // En production, il serait préférable d'avoir des régions d'intérêt séparées
            player1Move = results[0].label; // Utilise le résultat pour la première main
            
            // Classificateur pour la deuxième main (normalement, on devrait cropper l'image)
            classifier.classify(videoElement, (error, secondResults) => {
                if (!error && secondResults && secondResults.length > 0) {
                    player2Move = secondResults[0].label;
                } else {
                    player2Move = results[0].label; // Fallback
                }
                
                finishRound();
            });
        } else {
            document.getElementById("result").innerText = "❓ Deux mains sont nécessaires pour le mode duo !";
            setTimeout(classifyVideo, 1000);
        }
    }
}

// Terminer le tour et déterminer le gagnant
function finishRound() {
    document.getElementById("move-p1").innerText = `Joueur 1: ${player1Move} (${confidence}%)`;
    document.getElementById("move-p2").innerText = `${gameMode === "solo" ? "IA" : "Joueur 2"}: ${player2Move}`;
    
    const winner = determineWinner(player1Move, player2Move);
    let resultMessage = "";
    
    if (winner === 1) {
        scoreJoueur++;
        resultMessage = "🎉 Joueur 1 gagne !";
    } else if (winner === 2) {
        scoreOrdi++;
        resultMessage = gameMode === "solo" ? "🔥 L'IA gagne !" : "🔥 Joueur 2 gagne !";
    } else {
        resultMessage = "🤝 Égalité !";
    }
    
    // Mettre à jour le score
    document.querySelector(".score-p1").innerText = scoreJoueur;
    document.querySelector(".score-p2").innerText = scoreOrdi;
    
    // Ajouter à l'historique
    addToHistory(player1Move, player2Move, winner);
    
    // Vérifier si la partie est terminée
    if (scoreJoueur >= roundsToWin || scoreOrdi >= roundsToWin) {
        const finalWinner = scoreJoueur >= roundsToWin ? "Joueur 1" : (gameMode === "solo" ? "L'IA" : "Joueur 2");
        resultMessage = `🏆 ${finalWinner} remporte la partie ${scoreJoueur}-${scoreOrdi} !`;
        
        isGameActive = false;
        document.getElementById("start-game").innerText = "Nouvelle partie";
        document.getElementById("start-game").disabled = false;
    }
    
    document.getElementById("result").innerText = resultMessage;
    
    // Si la partie n'est pas terminée, continuer
    if (isGameActive) {
        setTimeout(() => startCountdown(classifyVideo), 2000);
    }
}

// Ajouter un tour à l'historique
function addToHistory(move1, move2, winner) {
    const historyItem = document.createElement("div");
    historyItem.className = "history-item";
    
    const winnerClass = winner === 1 ? "winner-p1" : (winner === 2 ? "winner-p2" : "tie");
    
    historyItem.innerHTML = `
        <span class="${winner === 1 ? 'winner' : ''}">${move1}</span>
        vs
        <span class="${winner === 2 ? 'winner' : ''}">${move2}</span>
        <span class="result ${winnerClass}">
            ${winner === 0 ? '=' : (winner === 1 ? '>' : '<')}
        </span>
    `;
    
    // Ajouter en haut de l'historique
    const historyContainer = document.getElementById("game-history");
    historyContainer.insertBefore(historyItem, historyContainer.firstChild);
    
    // Limiter l'historique à 10 entrées
    if (historyContainer.children.length > 10) {
        historyContainer.removeChild(historyContainer.lastChild);
    }
    
    // Enregistrer dans le tableau d'historique
    gameHistory.unshift({
        player1: move1,
        player2: move2,
        winner: winner
    });
}

// Fonction pour générer un coup aléatoire pour l'ordinateur
function getRandomMove() {
    const moves = ["Pierre", "Feuille", "Ciseaux"];
    
    // Si nous avons un historique, on peut utiliser une stratégie plus intelligente
    if (gameHistory.length > 0) {
        // 30% de chance d'utiliser une stratégie, 70% aléatoire
        if (Math.random() < 0.3) {
            // Stratégie simple: contrer le dernier coup du joueur
            const lastPlayerMove = gameHistory[0].player1;
            
            if (lastPlayerMove === "Pierre") return "Feuille";
            if (lastPlayerMove === "Feuille") return "Ciseaux";
            if (lastPlayerMove === "Ciseaux") return "Pierre";
        }
    }
    
    return moves[Math.floor(Math.random() * moves.length)];
}

// Fonction pour déterminer le gagnant
// Retourne: 0 pour égalité, 1 pour joueur 1, 2 pour joueur 2
function determineWinner(player1, player2) {
    if (player1 === player2) {
        return 0; // Égalité
    }
    
    if (
        (player1 === "Pierre" && player2 === "Ciseaux") ||
        (player1 === "Feuille" && player2 === "Pierre") ||
        (player1 === "Ciseaux" && player2 === "Feuille")
    ) {
        return 1; // Joueur 1 gagne
    } else {
        return 2; // Joueur 2 gagne
    }
}

// Fonction pour afficher un compte à rebours "1, 2, 3, BOOM !" avant la détection
function startCountdown(callback) {
    let count = 3;
    document.getElementById("result").innerText = `Préparez-vous...`;

    let countdownInterval = setInterval(() => {
        if (count > 0) {
            document.getElementById("result").innerText = `🕒 ${count}...`;
            count--;
        } else {
            clearInterval(countdownInterval);
            document.getElementById("result").innerText = "🔥 BOOM ! 🔥";

            // Figer les mains et classifier une dernière fois
            setTimeout(() => {
                callback();
            }, 500);
        }
    }, 1000);
}

// Lancer l'initialisation au chargement de la page
window.onload = setup;
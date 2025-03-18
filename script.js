// Charger le modèle Teachable Machine
let classifier;
let modelURL = "./model/model.json";

// Détection des mains
let handsDetector;
let numHands = 0;
let handLandmarks = [];

// Variables pour le jeu
let player1Move = "En attente...";
let player2Move = "En attente...";
let player1Confidence = 0;
let player2Confidence = 0;
let scoreJoueur = 0;
let scoreOrdi = 0;
let isGameActive = false;
let gameMode = "solo"; // "solo" ou "duo"
let roundsToWin = 3;
let gameHistory = [];
let countdownInterval = null; // Pour pouvoir arrêter le compte à rebours

// Éléments DOM
let videoElement;
let canvasElement;
let canvasCtx;

// Fonction pour interpréter les gestes à partir des landmarks MediaPipe
function interpretHandGesture(landmarks) {
    // Compter les doigts levés
    let fingersUp = 0;
    
    // Si pas de landmarks ou tableau vide, retourner inconnu
    if (!landmarks || landmarks.length === 0) {
        return "Inconnu";
    }
    
    // Positions de référence
    const wrist = landmarks[0];
    const thumb_tip = landmarks[4];
    const index_tip = landmarks[8];
    const middle_tip = landmarks[12];
    const ring_tip = landmarks[16];
    const pinky_tip = landmarks[20];
    const palm_center = landmarks[9]; // Base du majeur
    
    // Vérifier si chaque doigt est levé en comparant la hauteur du bout avec la paume
    if (index_tip.y < palm_center.y) fingersUp++;
    if (middle_tip.y < palm_center.y) fingersUp++;
    if (ring_tip.y < palm_center.y) fingersUp++;
    if (pinky_tip.y < palm_center.y) fingersUp++;
    
    // Pouce est un cas spécial, vérifions s'il est écarté
    const thumb_distance = Math.sqrt(
        Math.pow(thumb_tip.x - wrist.x, 2) + 
        Math.pow(thumb_tip.y - wrist.y, 2)
    );
    const index_distance = Math.sqrt(
        Math.pow(index_tip.x - wrist.x, 2) + 
        Math.pow(index_tip.y - wrist.y, 2)
    );
    
    // Si le pouce est significativement écarté
    if (thumb_distance > index_distance * 0.7) {
        fingersUp++;
    }
    
    // Interpréter le geste
    if (fingersUp <= 1) return "Pierre";  // Poing fermé
    if (fingersUp >= 4) return "Feuille";  // Main ouverte
    if (fingersUp == 2) return "Ciseaux";  // Deux doigts
    
    return "Inconnu";  // Geste non reconnu
}

// Fonction auxiliaire pour traiter une main spécifique
function processHand(handIndex, callback) {
    // D'abord essayer d'interpréter avec les landmarks (complément à l'IA)
    const handGesture = interpretHandGesture(handLandmarks[handIndex]);
    
    if (handGesture !== "Inconnu") {
        // Si l'interprétation directe a fonctionné, l'utiliser
        callback(handGesture, 90);
    } else {
        // Sinon, tenter la classification avec l'IA en créant une image de la main
        // Créer un canvas temporaire ciblant juste cette main
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoElement.width;
        tempCanvas.height = videoElement.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Dessiner l'image entière
        tempCtx.drawImage(videoElement, 0, 0);
        
        // Calculer la zone de la main avec une marge
        let minX = 1.0, minY = 1.0, maxX = 0.0, maxY = 0.0;
        for (const landmark of handLandmarks[handIndex]) {
            minX = Math.min(minX, landmark.x);
            minY = Math.min(minY, landmark.y);
            maxX = Math.max(maxX, landmark.x);
            maxY = Math.max(maxY, landmark.y);
        }
        
        // Ajouter une marge
        const marginX = (maxX - minX) * 0.3;
        const marginY = (maxY - minY) * 0.3;
        
        minX = Math.max(0, minX - marginX) * tempCanvas.width;
        minY = Math.max(0, minY - marginY) * tempCanvas.height;
        maxX = Math.min(1, maxX + marginX) * tempCanvas.width;
        maxY = Math.min(1, maxY + marginY) * tempCanvas.height;
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        // Dessiner la région sur le canvas
        classifier.classify(tempCanvas, (error, results) => {
            if (error || !results || results.length === 0) {
                // En cas d'échec, utiliser une valeur par défaut ou le résultat d'interprétation
                callback("Pierre", 60); // Valeur par défaut
            } else {
                callback(results[0].label, Math.round(results[0].confidence * 100));
            }
        });
    }
}

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
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FFCC', lineWidth: 3});
            drawLandmarks(canvasCtx, landmarks, {color: '#FF3366', lineWidth: 1, radius: 3});
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
        // Ne pas changer de mode si une partie est en cours
        if (isGameActive) {
            const confirmChange = confirm("Changer de mode va arrêter la partie en cours. Continuer ?");
            if (!confirmChange) return;
            stopGame();
        }
        
        gameMode = gameMode === "solo" ? "duo" : "solo";
        const modeText = gameMode === "solo" ? "Solo (vs IA)" : "Duo (2 joueurs)";
        document.getElementById("toggle-mode").innerText = `Mode: ${modeText}`;
        document.getElementById("game-info").innerText = `Mode: ${modeText}\nPremier à ${roundsToWin} victoires`;
        
        // Mettre à jour l'affichage du joueur 2
        document.getElementById("move-p2").innerText = gameMode === "solo" ? "IA: En attente..." : "Joueur 2: En attente...";
    });
    
    // Sélecteur de nombre de manches
    document.getElementById("rounds-selector").addEventListener("change", (e) => {
        // Ne pas changer de nombre de manches si une partie est en cours
        if (isGameActive) {
            const confirmChange = confirm("Changer le nombre de manches va arrêter la partie en cours. Continuer ?");
            if (!confirmChange) {
                e.target.value = roundsToWin; // Restaurer la valeur précédente
                return;
            }
            stopGame();
        }
        
        roundsToWin = parseInt(e.target.value);
        document.getElementById("game-info").innerText = `Mode: ${gameMode === "solo" ? "Solo (vs IA)" : "Duo (2 joueurs)"}\nPremier à ${roundsToWin} victoires`;
    });
    
    // Bouton pour commencer la partie
    document.getElementById("start-game").addEventListener("click", startGame);
    
    // NOUVEAU: Bouton pour arrêter la partie
    document.getElementById("stop-game").addEventListener("click", stopGame);
    
    // Bouton pour réinitialiser les scores
    document.getElementById("reset-scores").addEventListener("click", resetScores);
}

// NOUVELLE FONCTION: Arrêter la partie en cours
function stopGame() {
    if (!isGameActive) return;
    
    // Arrêter le compte à rebours s'il est en cours
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    isGameActive = false;
    document.getElementById("start-game").innerText = "Commencer la partie";
    document.getElementById("start-game").disabled = false;
    document.getElementById("result").innerText = "Partie arrêtée";
    
    // Ajouter une animation de pulsation rouge
    document.getElementById("result").classList.add("pulse");
    setTimeout(() => {
        document.getElementById("result").classList.remove("pulse");
    }, 2000);
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
    // Ne pas réinitialiser si une partie est en cours
    if (isGameActive) {
        const confirmReset = confirm("Réinitialiser les scores va arrêter la partie en cours. Continuer ?");
        if (!confirmReset) return;
        stopGame();
    }
    
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
    if (!isGameActive) return; // Si la partie a été arrêtée entre temps
    
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
            player1Confidence = Math.round(results[0].confidence * 100);
            player2Move = getRandomMove();
            player2Confidence = 100; // L'IA est toujours à 100% de confiance
            
            finishRound();
        } else {
            document.getElementById("result").innerText = "❓ Montrez votre main pour jouer !";
            setTimeout(classifyVideo, 1000);
        }
    } else {
        // Mode duo: deux joueurs humains
        if (numHands === 2) {
            handleDuoMode(results);
        } else {
            document.getElementById("result").innerText = "❓ Deux mains sont nécessaires pour le mode duo !";
            setTimeout(classifyVideo, 1000);
        }
    }
}

// Terminer le tour et déterminer le gagnant
function finishRound() {
    if (!isGameActive) return; // Si la partie a été arrêtée entre temps
    
    document.getElementById("move-p1").innerText = `Joueur 1: ${player1Move} (${player1Confidence}%)`;
    document.getElementById("move-p2").innerText = `${gameMode === "solo" ? "IA" : "Joueur 2"}: ${player2Move}${gameMode === "duo" ? ` (${player2Confidence}%)` : ''}`;
    
    const winner = determineWinner(player1Move, player2Move);
    let resultMessage = "";
    
    if (winner === 1) {
        scoreJoueur++;
        resultMessage = "🎉 Joueur 1 gagne !";
        document.getElementById("result").classList.add("winner-result");
    } else if (winner === 2) {
        scoreOrdi++;
        resultMessage = gameMode === "solo" ? "🔥 L'IA gagne !" : "🔥 Joueur 2 gagne !";
        document.getElementById("result").classList.add("winner-result");
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
        
        // Ajouter une animation de célébration pour le gagnant
        document.getElementById("result").classList.add("pulse");
    }
    
    document.getElementById("result").innerText = resultMessage;
    
    // Si la partie n'est pas terminée, continuer
    if (isGameActive) {
        setTimeout(() => {
            document.getElementById("result").classList.remove("winner-result");
            startCountdown(classifyVideo);
        }, 2000);
    } else {
        // Nettoyer les animations après quelques secondes
        setTimeout(() => {
            document.getElementById("result").classList.remove("winner-result");
            document.getElementById("result").classList.remove("pulse");
        }, 5000);
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

// Fonction pour afficher un compte à rebours avant la détection
function startCountdown(callback) {
    if (!isGameActive) return; // Ne pas démarrer si le jeu n'est plus actif
    
    let count = 3;
    document.getElementById("result").innerText = `Préparez-vous...`;

    // Stocker l'interval pour pouvoir l'arrêter si nécessaire
    countdownInterval = setInterval(() => {
        if (!isGameActive) {
            // Si le jeu a été arrêté pendant le compte à rebours
            clearInterval(countdownInterval);
            countdownInterval = null;
            return;
        }
        
        if (count > 0) {
            document.getElementById("result").innerText = `🕒 ${count}...`;
            count--;
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            document.getElementById("result").innerText = "🔥 BOOM ! 🔥";

            // Figer les mains et classifier une dernière fois
            setTimeout(() => {
                if (isGameActive) { // Vérifier si le jeu est toujours actif
                    callback();
                }
            }, 500);
        }
    }, 1000);
}

// Modifier la fonction handleDuoMode pour traiter correctement chaque main séparément
function handleDuoMode(results) {
    if (!isGameActive) return; // Si la partie a été arrêtée entre temps
    
    if (numHands !== 2) {
        document.getElementById("result").innerText = "❓ Deux mains sont nécessaires pour le mode duo !";
        setTimeout(classifyVideo, 1000);
        return;
    }
    
    // Identifier quelles mains sont à gauche et à droite
    let leftHandIndex = 0;
    let rightHandIndex = 1;
    
    // Vérifier quelle main est à gauche et à droite
    const hand0CenterX = handLandmarks[0].reduce((sum, pt) => sum + pt.x, 0) / handLandmarks[0].length;
    const hand1CenterX = handLandmarks[1].reduce((sum, pt) => sum + pt.x, 0) / handLandmarks[1].length;
    
    if (hand0CenterX > hand1CenterX) {
        leftHandIndex = 1;
        rightHandIndex = 0;
    }
    
    // Traitement séparé pour chaque main
    // Classification joueur 1 (main gauche)
    processHand(leftHandIndex, (move, confidence) => {
        if (!isGameActive) return; // Vérifier encore si le jeu est actif
        
        player1Move = move;
        player1Confidence = confidence;
        
        // Classification joueur 2 (main droite)
        processHand(rightHandIndex, (move, confidence) => {
            if (!isGameActive) return; // Vérifier encore si le jeu est actif
            
            player2Move = move;
            player2Confidence = confidence;
            
            // Une fois les deux mains traitées, on termine le tour
            finishRound();
        });
    });
}

// Lancer l'initialisation au chargement de la page
window.onload = setup;
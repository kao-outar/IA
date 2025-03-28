# Pierre-Feuille-Ciseaux avec IA

Un jeu moderne de Pierre-Feuille-Ciseaux utilisant la vision par ordinateur et l'intelligence artificielle pour jouer en utilisant simplement votre webcam.

## 🎮 Fonctionnalités

- **Détection de gestes en temps réel** : Utilisez votre main devant la webcam pour jouer
- **IA intelligente** : L'ordinateur apprend de vos mouvements précédents
- **Mode solo** : Affrontez l'IA avec des stratégies adaptatives
- **Mode duo** : Jouez à deux sur la même caméra
- **Interface néon** : Design moderne avec des couleurs vibrantes
- **Historique des parties** : Suivez l'évolution de vos performances
- **Personnalisation** : Choisissez le nombre de manches à gagner

## 🧠 Technologies utilisées

- **TensorFlow.js** : Moteur d'IA pour l'analyse d'images
- **MediaPipe Hands** : Détection précise des mains et doigts
- **ML5.js** : Simplification des modèles d'apprentissage machine
- **Teachable Machine** : Entraînement du modèle de reconnaissance
- **JavaScript / HTML5 / CSS3** : Interface utilisateur fluide et réactive

## 🚀 Installation

1. Clonez ce dépôt :
```bash
git clone https://github.com/votre-nom/pierre-feuille-ciseaux-ia.git
cd pierre-feuille-ciseaux-ia
```

2. Lancez un serveur web local (nécessaire pour que la webcam fonctionne) :
```bash
# Avec Python 3
python -m http.server

# Ou avec Node.js
npx serve
```

3. Ouvrez votre navigateur à l'adresse indiquée (généralement http://localhost:8000)

## 📋 Prérequis

- Navigateur web moderne (Chrome, Firefox, Edge recommandés)
- Webcam fonctionnelle
- Connexion Internet (pour le chargement initial des bibliothèques)

## 🎲 Comment jouer

1. Autorisez l'accès à votre webcam quand le navigateur le demande
2. Attendez le chargement du modèle d'IA (indiqué par la disparition du spinner)
3. Cliquez sur "Commencer la partie"
4. Montrez votre main devant la webcam pour former un signe :
   - **Pierre** : Poing fermé
   - **Feuille** : Main ouverte avec tous les doigts étendus
   - **Ciseaux** : Index et majeur formant un V
5. Attendez le compte à rebours "BOOM!" et maintenez votre geste
6. Observez le résultat du duel et recommencez!

## 🔧 Personnalisation

### Modes de jeu
- **Solo** : Vous contre l'intelligence artificielle
- **Duo** : Deux joueurs, chacun utilisant une main devant la caméra

### Paramètres
- Nombre de manches à gagner : 1, 3, 5 ou 7
- Possibilité d'arrêter une partie en cours
- Réinitialisation des scores

## 📚 Structure du projet

- `index.html` : Structure de la page et chargement des bibliothèques
- `style.css` : Styles visuels avec thème néon et animations
- `script.js` : Logique du jeu et intégration des modèles IA
- `model/` : Dossier contenant le modèle Teachable Machine entraîné

## 🧩 Comment ça fonctionne

1. **Détection des mains** : MediaPipe Hands identifie les positions de 21 points sur chaque main
2. **Interprétation des gestes** : L'algorithme analyse la position des doigts pour déterminer le geste
3. **Classification** : Un modèle d'apprentissage machine confirme la détection (Pierre, Feuille, Ciseaux)
4. **Logique du jeu** : Comparaison des gestes selon les règles classiques
5. **IA adaptative** : En mode solo, l'ordinateur utilise parfois une stratégie basée sur vos coups précédents

## 🔜 Améliorations futures

- [ ] Thèmes visuels supplémentaires
- [ ] Effets sonores et musique d'ambiance


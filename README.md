# Scribbl Bootleg — Jeu de dessin collaboratif en temps réel

> Projet réalisé dans le cadre du Master 2 — matière **Web Temps Réel** (TIW8)
> Travail d'équipe (2 personnes) sur plusieurs semaines

Une réinterprétation du célèbre jeu **skribbl.io**, développée en **TypeScript**, où l'on ne dessine plus seulement à la souris, mais aussi **avec ses doigts, en direct via la caméra**, grâce à la détection de mains par IA.

---

## Le concept

Comme dans skribbl.io : un joueur dessine, les autres devinent. Mais ici, la dimension "temps réel" va plus loin que le chat et le canvas partagé — la webcam de chaque joueur est diffusée en direct aux autres, et le dessinateur peut choisir de dessiner **avec son doigt**, formant un signe particulier, suivi en temps réel par un modèle de détection de mains.

## Fonctionnalités

- **Système de rooms** — création et connexion à une partie via un ID de room, sans base de données ni backend applicatif lourd (peer-to-peer)
- **Canvas collaboratif en temps réel** — le dessin du joueur actif se synchronise instantanément chez tous les participants
- **Chat / système de devinettes en temps réel** — les joueurs proposent des réponses, validées automatiquement
- **Système de tours et de score** — rotation automatique du dessinateur, mots à deviner, minuteur par round, calcul des points
- **Diffusion caméra en direct (WebRTC)** — chaque joueur peut voir la webcam des autres participants
- **Dessin par gestes (main réelle)** — la caméra capture le mouvement de la main du dessinateur ; un modèle de détection identifie le pincement pouce/index pour tracer sur le canvas, sans souris
- **Synchronisation d'état distribuée** — l'état du jeu (joueurs, scores, canvas, tours) est répliqué entre tous les clients via une structure de données conçue pour la résolution de conflits en environnement distribué

## Stack technique

| Domaine | Technologie |
|---|---|
| Langage | TypeScript |
| Connexion pair-à-pair / WebRTC | [PeerJS](https://peerjs.com/) |
| Synchronisation d'état distribué | [Automerge](https://automerge.org/) (CRDT) |
| Détection de mains / vision par ordinateur | [MediaPipe Hands](https://developers.google.com/mediapipe) |
| Frontend | React |
| Serveur de signaling | Node.js / Express + PeerServer |

## Architecture temps réel

Le jeu repose sur une architecture **peer-to-peer** plutôt que sur un serveur de jeu centralisé classique :

- **PeerJS** gère l'établissement des connexions WebRTC entre les joueurs (signaling via un serveur PeerJS léger, puis échange direct des flux vidéo et des données de jeu entre pairs).
- **Automerge** (CRDT) maintient un document d'état de jeu partagé (joueurs, canvas, scores, tours) qui se synchronise entre tous les clients par échange de deltas, avec résolution automatique des conflits — un des cœurs techniques du projet, essentiel pour garantir la cohérence de l'état du jeu sans serveur autoritaire central.
- **MediaPipe Hands** traite en continu le flux vidéo local pour détecter les points de repère de la main, calcule la distance entre le pouce et l'index pour détecter un "pincement", et transforme ce geste en coordonnées de dessin sur le canvas.

## Objectif pédagogique

- Mise en œuvre concrète de WebRTC et de la synchronisation de données distribuées sans backend centralisé
- Gestion des états partagés et de la cohérence en environnement multi-clients (CRDT)
- Intégration d'un modèle de vision par ordinateur en temps réel dans une interface web interactive
- Travail en équipe restreinte sur un projet complexe multi-composants (réseau, UI, IA, jeu)

## Démo

*(à compléter — GIF ou capture d'écran du jeu en action, idéalement avec la détection de main visible)*

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/BTheoB/Scribbl_Botleg.git
cd Scribbl_Botleg

# Installer les dépendances (client et serveur)
npm install

# Lancer le serveur de signaling PeerJS
#Dans le ficher /server
npm start

# Lancer le client
#Dans le ficher /client
npm run dev
```

## Équipe

Projet réalisé à deux dans le cadre du Master 2 — Web Temps Réel.


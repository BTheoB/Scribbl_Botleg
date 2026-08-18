import Peer, { DataConnection, PeerJSOption } from "peerjs";
import * as Automerge from "@automerge/automerge";
import { GameState } from "../types/types";
import { Hands, Results } from "@mediapipe/hands";
class WebRTCService {
  private peer: Peer | null = null;
  private peerId: string | null = null;
  private connections: DataConnection[] = [];
  private connectionMap: Record<string, DataConnection> = {};

  // Document Automerge principal + version précédente pour calculer les deltas
  private doc: Automerge.Doc<GameState>;
  private prevDoc: Automerge.Doc<GameState>;
  private roomId: string | null = null;

  private isHost: boolean = false;
  private receivedWord: string = "";
  private roundTimer: NodeJS.Timeout | null = null;
  private wordList: string[] = [
    "pomme",
    "banane",
    "chat",
    "chien",
    "maison",
    "arbre",
    "voiture",
    "avion",
    "ballon",
    "montagne",
    "plage",
    "soleil",
    "lune",
    "étoile",
    "ordinateur",
    "téléphone",
    "chapeau",
    "chaussure",
    "livre",
    "stylo",
    "table",
    "chaise",
    "télévision",
    "horloge",
    "fleur",
    "guitare",
    "piano",
    "bateau",
    "poisson",
    "robot",
    "train",
    "vélo",
    "pizza",
    "glace",
    "gâteau",
    "café",
    "thé",
    "parapluie",
    "papillon",
    "araignée",
    "tortue",
    "girafe",
    "éléphant",
    "dauphin",
    "dragon",
    "château",
    "pont",
    "lampe",
    "fenêtre",
    "porte",
    "FuuZen",
  ];

  // Callback invoquée à chaque mise à jour du doc (pour rafraîchir l'UI)
  private onStateChange?: (state: GameState) => void;

  // State for hand coordinates
  private handCoordinates: { x: number; y: number } | null = null;
  private subscribers: Array<
    (coordinates: { x: number; y: number } | null) => void
  > = [];
  // MediaPipe Hands instance
  private hands: Hands | null = null;

  constructor() {
    // Initialisation du document Automerge
    this.doc = Automerge.change(Automerge.init<GameState>(), (doc) => {
      doc.canvas = { paths: [] };
      doc.players = [];
      doc.currentWord = "";
      doc.wordHint = "";
      doc.currentDrawer = "";
      doc.currentRound = 0;
      doc.maxRounds = 3; // Valeur par défaut du nombre de tours
      doc.roundActive = false;
      doc.roundTimeLeft = 60;
      doc.gameStarted = false;
      doc.gameEnded = false; // Nouvel état pour indiquer la fin de la partie
      doc.guesses = [];
      doc.nextVideo = false;
    });
    this.prevDoc = this.doc;
    this.hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    // Configuration PeerJS : on ajoute un STUN/TURN exemple (à adapter si besoin)
    const peerConfig: PeerJSOption = 
      {
        host: "localhost",
        port: 9000,  
        secure: false,
      };
    

    this.initializePeer(peerConfig);
  }

  /**
   * Initialise le Peer et définit les handlers pour les connexions entrantes.
   */
  private initializePeer(config: PeerJSOption) {
    this.peer = new Peer(config);

    this.peer.on("open", (id) => {
      this.peerId = id;
      this.roomId = id;
      //console.log('[PeerJS] Local peer ouvert avec ID =', id);
    });

    this.peer.on("connection", (conn) => {
      //console.log('[PeerJS] Connexion entrante de', conn.peer);
      this.setupConnectionHandlers(conn, "");
      this.connections.push(conn);
      // Ajouter la connexion à notre map pour pouvoir retrouver facilement
      this.connectionMap[conn.peer] = conn;
    });

    this.peer.on("error", (err) => {
      console.error("[PeerJS] Erreur globale :", err.message, err.type);
    });

    this.peer.on("call", (call) => {
      call.answer();
      call.on("stream", (remoteStream) => this.addVideoStream(remoteStream));
    });
  }

  /**
   * Renvoie l'ID local (le "Room ID") en s'assurant qu'il est disponible.
   */
  async createRoom(): Promise<string> {
    if (!this.peer) {
      throw new Error("Peer non initialisé");
    }

    // Attente du PeerID si "open" n'a pas encore été émis
    if (!this.peerId) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout: Peer ID introuvable"));
        }, 15000); // 15 secondes

        this.peer!.on("open", () => {
          clearTimeout(timeout);
          console.log(this.peerId);
          resolve();
        });
      });
    }

    if (!this.peerId) {
      throw new Error("Impossible de créer la room, peerId non disponible.");
    }

    // Définir isHost = true car on crée la room
    this.isHost = true;
    return this.peerId;
  }

  /**
   * Se connecte à un autre peer ayant l'ID roomId.
   * Ajoute le joueur local au doc, puis envoie un docSync complet une fois la connexion "open".
   */
  async joinRoom(roomId: string, playerName: string) {
    if (!this.peer) {
      throw new Error("Peer non initialisé");
    }

    // Assure-toi qu'on ait un PeerID local avant de se connecter
    if (!this.peerId) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout: Peer ID introuvable"));
        }, 15000);

        this.peer!.on("open", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    if (!this.peerId) {
      throw new Error(
        "Impossible de rejoindre la room, peerId local non disponible"
      );
    }

    if (this.peerId === roomId) {
      // Si on est le host, on ajoute juste notre playerName
      this.isHost = true;
      this.doc = Automerge.change(this.doc, (doc) => {
        doc.players.push({
          id: this.peerId!,
          name: playerName,
          score: 0,
        });
      });
      this.onStateChange?.(this.doc);
      return;
    }

    // On n'est pas l'host
    this.isHost = false;
    this.roomId = roomId;

    const conn = this.peer.connect(roomId);
    this.setupConnectionHandlers(conn, playerName);
    this.connections.push(conn);
    // Ajouter au connectionMap
    this.connectionMap[roomId] = conn;

    // Attendre que la connexion s'ouvre
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout: connexion impossible"));
      }, 15000);

      conn.on("open", () => {
        clearTimeout(timeout);
        // On récupère le doc du host puis on renvoie nos changes (notre playerName en plus)
        console.log("on demande le document du host");
        this.doc = Automerge.init();
        this.getHostDoc(conn);
        resolve();
      });

      conn.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`Erreur connexion à ${roomId}: ${err}`));
      });
    });
  }

  /**
   * Gère les messages Automerge (docSync, changes) reçus sur une DataConnection PeerJS.
   */
  private setupConnectionHandlers(conn: DataConnection, playerName: string) {
    conn.on("data", (rawData) => {
      if (!rawData) return;

      // Parse JSON
      let data;
      try {
        data = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
      } catch (err) {
        console.error("[PeerJS] Erreur parsing data:", err);
        return;
      }

      // Gérer les messages de type askBroadcast
      if (
        data.type === "askBroadcast" &&
        Array.isArray(data.changes) &&
        this.peerId === this.roomId
      ) {
        console.log("demande de broadcast d'un peer", data.changes);

        const changesUint8 = data.changes.map((chunk: number[] | Uint8Array) =>
          chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
        );
        const [newDoc] = Automerge.applyChanges(this.doc, changesUint8);
        console.log(newDoc);
        this.doc = newDoc;

        this.broadcastChange();
        this.onStateChange?.(this.doc);
      }

      // Gérer les demandes de document complet
      if (data.type === "requestDoc") {
        console.log("quelqu'un request mon doc", this.doc);
        this.sendFullDocSync(conn);
      }

      // Gestion du docSync => réception d'un doc complet
      if (data.type === "docSync" && Array.isArray(data.changes)) {
        console.log("réception d'un doc complet", data.changes);
        const changesUint8 = data.changes.map((chunk: number[] | Uint8Array) =>
          chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
        );
        console.log(changesUint8);

        const [newDoc] = Automerge.applyChanges(this.doc, changesUint8);
        console.log(newDoc);
        this.doc = newDoc;
        this.prevDoc = newDoc;

        // Ajouter le joueur au document
        this.doc = Automerge.change(this.doc, (doc) => {
          doc.players.push({
            id: this.peerId!,
            name: playerName,
            score: 0,
          });
        });

        this.onStateChange?.(this.doc);
        this.broadcastChange();
      }

      // Gestion des changements partiels
      else if (data.type === "changes" && Array.isArray(data.changes)) {
        const changesUint8 = data.changes.map((chunk: number[] | Uint8Array) =>
          chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
        );

        const [newDoc] = Automerge.applyChanges(this.doc, changesUint8);
        this.doc = newDoc;
        this.onStateChange?.(this.doc);
      }

      // Nouvelle gestion pour le mot à deviner (reçu par le dessinateur)
      if (data.type === "word") {
        this.receivedWord = data.word;
        console.log("Mot reçu:", this.receivedWord);
        this.onStateChange?.(this.doc);
      }

      // Gestion des devinettes (pour l'hôte uniquement)
      if (data.type === "guess" && this.isHost) {
        const { playerId, playerName, guess } = data;
        if (this.doc.roundActive && playerId !== this.doc.currentDrawer) {
          const normalizedGuess = guess.trim().toLowerCase();
          const normalizedWord = this.doc.currentWord.trim().toLowerCase();

          this.doc = Automerge.change(this.doc, (doc) => {
            doc.guesses.push({
              playerId,
              playerName,
              guess,
              correct: normalizedGuess === normalizedWord,
            });
          });

          if (normalizedGuess === normalizedWord) {
            this.doc = Automerge.change(this.doc, (doc) => {
              const player = doc.players.find((p) => p.id === playerId);
              if (player) {
                player.score += 10;
              }
              const drawer = doc.players.find(
                (p) => p.id === doc.currentDrawer
              );
              if (drawer) {
                drawer.score += 5;
              }
              doc.roundActive = false;
              doc.canvas.paths = [];
            });

            this.broadcastChange();
            this.onStateChange?.(this.doc);
            setTimeout(() => {
              this.startNewRound();
            }, 3000);
          } else {
            this.broadcastChange();
            this.onStateChange?.(this.doc);
          }
        }
      }
    });

    conn.on("close", () => {
      this.connections = this.connections.filter((c) => c !== conn);
      delete this.connectionMap[conn.peer];

      if (this.isHost) {
        this.doc = Automerge.change(this.doc, (doc) => {
          doc.players = doc.players.filter((p) => p.id !== conn.peer);
          if (doc.currentDrawer === conn.peer && doc.roundActive) {
            doc.roundActive = false;
            setTimeout(() => this.startNewRound(), 2000);
          }
        });
        this.broadcastChange();
        this.onStateChange?.(this.doc);
      }
    });

    conn.on("error", (err) => {
      console.error("[PeerJS] Connexion erreur avec", conn.peer, ":", err);
    });
  }

  /**
   * Envoie un docSync complet à une connexion (tous les changements depuis init()).
   */
  private sendFullDocSync(conn: DataConnection) {
    const allChanges = Automerge.getAllChanges(this.doc);
    const changesAsArrays = allChanges.map((u8: Uint8Array) => Array.from(u8));

    conn.send(
      JSON.stringify({
        type: "docSync",
        changes: changesAsArrays,
      })
    );
  }

  private getHostDoc(conn: DataConnection) {
    conn.send(
      JSON.stringify({
        type: "requestDoc",
      })
    );
  }

  /**
   * Commence un nouveau trait sur le canvas (un path).
   */
  startDrawing(point: { x: number; y: number }, color: string, width: number) {
    if (this.peerId === this.doc.currentDrawer && this.doc.roundActive) {
      this.doc = Automerge.change(this.doc, (doc) => {
        doc.canvas.paths.push({
          points: [point],
          color,
          width,
        });
      });
      this.broadcastChange();
      this.onStateChange?.(this.doc);
    }
  }

  /**
   * Ajoute un point au path en cours.
   */
  draw(point: { x: number; y: number }) {
    if (this.peerId === this.doc.currentDrawer && this.doc.roundActive) {
      this.doc = Automerge.change(this.doc, (doc) => {
        const currentPath = doc.canvas.paths[doc.canvas.paths.length - 1];
        if (currentPath) {
          currentPath.points.push(point);
        }
      });
      this.broadcastChange();
      this.onStateChange?.(this.doc);
    }
  }

  /**
   * Envoie les deltas Automerge (différences) à tous les peers.
   */
  private broadcastChange() {
    const changes = Automerge.getChanges(this.prevDoc, this.doc);
    if (changes.length === 0) {
      console.log("pas de changes");
      return;
    }

    const changesAsArrays = changes.map((u8) => Array.from(u8));

    if (this.peerId !== this.roomId) {
      this.connections[0].send(
        JSON.stringify({
          type: "askBroadcast",
          changes: changesAsArrays,
        })
      );
      this.prevDoc = this.doc;
      return;
    }

    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(
          JSON.stringify({
            type: "changes",
            changes: changesAsArrays,
          })
        );
      }
    });

    this.prevDoc = this.doc;
  }

  /**
   * Permet à ton composant React de s'abonner aux mises à jour du doc.
   */
  setStateChangeCallback(callback: (state: GameState) => void) {
    this.onStateChange = callback;
  }

  /**
   * Définit le nombre de tours pour la partie.
   * Cette méthode ne doit être appelée que par l'hôte avant le début de la partie.
   */
  setMaxRounds(rounds: number) {
    if (!this.isHost || this.doc.gameStarted) {
      console.log(
        "Impossible de définir le nombre de tours: pas l'hôte ou partie déjà démarrée"
      );
      return;
    }

    this.doc = Automerge.change(this.doc, (doc) => {
      doc.maxRounds = rounds;
    });

    this.broadcastChange();
    this.onStateChange?.(this.doc);
  }

  /**
   * Démarre la partie (uniquement pour l'hôte).
   */
  startGame() {
    if (!this.isHost || this.doc.players.length < 2) {
      console.log(
        "Impossible de démarrer le jeu: pas l'hôte ou pas assez de joueurs"
      );
      return;
    }

    this.doc = Automerge.change(this.doc, (doc) => {
      doc.gameStarted = true;
      doc.gameEnded = false;
      doc.currentRound = 0;
      doc.canvas.paths = [];
      doc.players.forEach((player) => {
        player.score = 0;
      });
      doc.guesses = [];
    });

    this.broadcastChange();
    this.onStateChange?.(this.doc);

    this.startNewRound();
  }

  /**
   * Démarre un nouveau round (uniquement pour l'hôte).
   */
  private startNewRound() {
    if (!this.isHost || !this.doc.gameStarted) {
      return;
    }

    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    // Vérifier si le nombre maximum de tours est atteint
    if (this.doc.currentRound >= this.doc.maxRounds * this.doc.players.length) {
      this.endGame();
      return;
    }

    this.doc = Automerge.change(this.doc, (doc) => {
      doc.currentRound += 1;
      doc.canvas.paths = [];
      doc.guesses = [];

      const nextDrawerIndex = (doc.currentRound - 1) % doc.players.length;
      doc.currentDrawer = doc.players[nextDrawerIndex].id;

      const randomIndex = Math.floor(Math.random() * this.wordList.length);
      const word = this.wordList[randomIndex];
      doc.currentWord = word;

      let hint = "";
      if (word.length <= 3) {
        hint = word[0] + " " + "_".repeat(word.length - 1);
      } else {
        hint =
          word[0] +
          " " +
          "_".repeat(word.length - 2) +
          " " +
          word[word.length - 1];
      }
      doc.wordHint = hint;

      doc.roundTimeLeft = 60;
      doc.roundActive = true;
      doc.nextVideo = true;
      this.removeVideoStream();
    });

    this.broadcastChange();
    this.onStateChange?.(this.doc);

    const drawerConn = this.connectionMap[this.doc.currentDrawer];
    if (
      drawerConn &&
      drawerConn.open &&
      this.doc.currentDrawer !== this.peerId
    ) {
      drawerConn.send(
        JSON.stringify({
          type: "word",
          word: this.doc.currentWord,
        })
      );
    } else if (this.doc.currentDrawer === this.peerId) {
      this.receivedWord = this.doc.currentWord;
      this.onStateChange?.(this.doc);
    }

    this.startRoundTimer();
  }

  /**
   * Démarre le timer du round (uniquement pour l'hôte).
   */
  private startRoundTimer() {
    if (!this.isHost || !this.doc.roundActive) {
      return;
    }

    let timeLeft = 60;

    const updateTimer = () => {
      if (!this.isHost || !this.doc.roundActive) {
        return;
      }

      timeLeft -= 1;

      this.doc = Automerge.change(this.doc, (doc) => {
        doc.roundTimeLeft = timeLeft;
      });

      this.broadcastChange();
      this.onStateChange?.(this.doc);

      if (timeLeft <= 0) {
        this.endRound();
      } else {
        this.roundTimer = setTimeout(updateTimer, 1000);
      }
    };

    this.roundTimer = setTimeout(updateTimer, 1000);
  }

  /**
   * Termine le round en cours (uniquement pour l'hôte).
   */
  private endRound() {
    if (!this.isHost) {
      return;
    }

    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    this.doc = Automerge.change(this.doc, (doc) => {
      doc.roundActive = false;
      doc.canvas.paths = [];
    });

    this.broadcastChange();
    this.onStateChange?.(this.doc);

    setTimeout(() => {
      this.startNewRound();
    }, 3000);
  }

  /**
   * Termine la partie et affiche le récapitulatif des scores.
   */
  private endGame() {
    if (!this.isHost) {
      return;
    }
    console.log("end gaaaaame");
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }

    this.doc = Automerge.change(this.doc, (doc) => {
      doc.gameStarted = false;
      doc.gameEnded = true;
      doc.roundActive = false;
      const sortedPlayers = [...doc.players].sort((a, b) => a.score - b.score);
      doc.players.splice(
        0,
        doc.players.length,
        ...sortedPlayers.map((player) => ({ ...player }))
      );
      doc.canvas.paths = [];
      doc.guesses = [];
    });

    this.broadcastChange();
    console.log(this.doc);
    this.onStateChange?.(this.doc);
  }

  /**
   * Permet de redémarrer une nouvelle partie après la fin d'une partie.
   */
  restartGame() {
    if (!this.isHost) {
      return;
    }

    this.doc = Automerge.change(this.doc, (doc) => {
      doc.gameEnded = false;
      // Réinitialiser d'autres états si nécessaire
    });

    this.broadcastChange();
    this.onStateChange?.(this.doc);
  }

  /**
   * Soumet une devinette (pour les joueurs qui ne dessinent pas).
   */
  submitGuess(guess: string) {
    if (this.peerId === this.doc.currentDrawer || !this.doc.roundActive) {
      return;
    }

    if (this.isHost) {
      const normalizedGuess = guess.trim().toLowerCase();
      const normalizedWord = this.doc.currentWord.trim().toLowerCase();

      this.doc = Automerge.change(this.doc, (doc) => {
        doc.guesses.push({
          playerId: this.peerId!,
          playerName:
            doc.players.find((p) => p.id === this.peerId)?.name ||
            "Joueur inconnu",
          guess,
          correct: normalizedGuess === normalizedWord,
        });
      });

      this.onStateChange?.(this.doc);

      if (normalizedGuess === normalizedWord) {
        this.doc = Automerge.change(this.doc, (doc) => {
          const player = doc.players.find((p) => p.id === this.peerId);
          if (player) {
            player.score += 10;
          }
          const drawer = doc.players.find((p) => p.id === doc.currentDrawer);
          if (drawer) {
            drawer.score += 5;
          }
          const sortedPlayers = [...doc.players].sort(
            (a, b) => a.score - b.score
          );
          doc.players.splice(
            0,
            doc.players.length,
            ...sortedPlayers.map((player) => ({ ...player }))
          );
          doc.roundActive = false;
          doc.canvas.paths = [];
        });

        this.broadcastChange();
        this.onStateChange?.(this.doc);
        setTimeout(() => {
          this.startNewRound();
        }, 3000);
      } else {
        this.broadcastChange();
      }
    } else {
      const hostConn = this.connectionMap[this.roomId!];
      if (hostConn && hostConn.open) {
        hostConn.send(
          JSON.stringify({
            type: "guess",
            playerId: this.peerId,
            playerName:
              this.doc.players.find((p) => p.id === this.peerId)?.name ||
              "Joueur inconnu",
            guess,
          })
        );
      }
    }
  }

  /**
   * Vérifie si l'utilisateur courant est l'hôte.
   */
  isHostUser(): boolean {
    return this.isHost;
  }

  /**
   * Vérifie si l'utilisateur courant est le dessinateur.
   */
  isCurrentDrawer(): boolean {
    return this.peerId === this.doc.currentDrawer;
  }

  /**
   * Récupère le mot que le dessinateur doit dessiner.
   */
  getWordToDraw(): string {
    return this.receivedWord;
  }

  /**
   * Récupère l'ID du peer local.
   */
  getPeerId(): string | null {
    return this.peerId;
  }

  /**
   * Ajoute un stream a une balise html VIDEO
   * @param stream
   */
  addVideoStream(stream: any) {
    const video = document.getElementById("localVideo"); // Récupérer la vidéo existante
    if (video) {
      (video as HTMLVideoElement).srcObject = stream; // Mettre à jour le flux vidéo
      (video as HTMLVideoElement).autoplay = true;
    } else {
      console.error("L'élément #localVideo n'existe pas !");
    }
  }

  /**
   * Supprime le stream d'une balise hmtl video
   */
  removeVideoStream() {
    const video = document.getElementById("localVideo"); // Récupérer la vidéo existante
    if (video) {
      let stream = (video as HTMLVideoElement).srcObject;
      if (stream) {
        let tracks = (stream as MediaStream).getTracks();
        tracks.forEach((track) => track.stop()); // Stoppe chaque track (vidéo/audio)
      }
      (video as HTMLVideoElement).srcObject = null; // Mettre à jour le flux vidéo
    } else {
      console.error("L'élément #localVideo n'existe pas !");
    }
  }

  //Lance un appel video à tous les peer connue (celui qui lance l'appel est le nouveau drawer)
  startVideo() {
    this.connectToPeers();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error("WebRTC non supporté sur ce navigateur !");
      return;
    }else{
      navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        // Envoyer le flux aux autres utilisateurs connectés
        console.log("this.connectionMap", this.connectionMap);
        Object.values(this.connectionMap).forEach((conn) => {
          console.log("peer qui sont appelé");
          console.log(conn.peer);
          this.peer?.call(conn.peer, stream);
        });

        // Initialize hand tracking with the video stream
        this.initializeHandTracking(stream);
      })
      .catch((err) => console.error("Erreur caméra/micro :", err));
    }
    
    this.doc = Automerge.change(this.doc, (doc) => {
      doc.nextVideo = false;
    });

    this.broadcastChange();
    this.onStateChange?.(this.doc);
  }

  getIsNextVideo() {
    return this.doc.nextVideo;
  }

  connectToPeers() {
    this.doc.players.forEach((peerId) => {
      // Si on n'est pas déjà connecté à ce peer
      if (
        this.peer &&
        !this.connectionMap[peerId.id] &&
        peerId.id !== this.peer.id
      ) {
        const conn = this.peer.connect(peerId.id);

        conn.on("open", () => {
          this.connectionMap[peerId.id] = conn;
        });

        conn.on("error", (err) => {
          console.error(`Erreur avec ${peerId}:`, err);
        });
      }
    });
  }
  private async initializeHandTracking(stream: MediaStream) {
    this.hands?.onResults((results: Results) => {
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        const thumbTip = landmarks[4]; // Thumb tip
        const indexFingerTip = landmarks[8]; // Index finger tip

        const canvas = document.getElementById("canvas");
        const canvasRect = (
          canvas as HTMLCanvasElement
        ).getBoundingClientRect();
        const canvasWidth = canvasRect.width;
        const canvasHeight = canvasRect.height;

        // Scale landmarks to canvas dimensions
        const thumbX = thumbTip.x * canvasWidth;
        const thumbY = thumbTip.y * canvasHeight;
        const indexX = indexFingerTip.x * canvasWidth;
        const indexY = indexFingerTip.y * canvasHeight;

        // Calculate Euclidean distance between thumb and index finger tip
        const distance = Math.sqrt(
          (thumbX - indexX) ** 2 + (thumbY - indexY) ** 2
        );
        console.log(distance);
        const PINCH_THRESHOLD = 50; // Adjust threshold as needed

        if (distance < PINCH_THRESHOLD) {
          // Pinch detected -> Use midpoint between thumb and index finger
          const pinchX = (thumbX + indexX) / 2;
          const pinchY = (thumbY + indexY) / 2;

          this.setHandCoordinates({ x: pinchX, y: pinchY });
        } else {
          this.setHandCoordinates(null);
        }
      } else {
        this.setHandCoordinates(null);
      }
    });

    const videoTrack = stream.getVideoTracks()[0];
    // @ts-ignore
    const imageCapture = new ImageCapture(videoTrack);

    // Use OffscreenCanvas instead of a visible canvas
    const offscreenCanvas = new OffscreenCanvas(1, 1);
    const ctx = offscreenCanvas.getContext("2d");

    const processFrame = async () => {
      try {
        const bitmap = await imageCapture.grabFrame();

        // Resize the offscreen canvas to match the video frame
        offscreenCanvas.width = bitmap.width;
        offscreenCanvas.height = bitmap.height;

        if (ctx) {
          // Flip the image horizontally
          ctx.translate(bitmap.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(bitmap, 0, 0);
          const imageData = ctx?.getImageData(
            0,
            0,
            bitmap.width,
            bitmap.height
          );

          // Send the flipped frame to the hand tracking model
          // @ts-ignore
        await this.hands?.send({ image: imageData });
        }
      } catch (error) {
        console.error("Error capturing frame:", error);
      }

      requestAnimationFrame(processFrame);
    };

    processFrame();
  }

  stopHandTracking = () => {
    this.hands?.close(); // Stop the hand tracking
    console.log("Hand tracking stopped.");
  };

  private setHandCoordinates(coordinates: { x: number; y: number } | null) {
    this.handCoordinates = coordinates;
    this.notifySubscribers();
  }

  public subscribe(
    callback: (coordinates: { x: number; y: number } | null) => void
  ) {
    this.subscribers.push(callback);
  }

  public unsubscribe(
    callback: (coordinates: { x: number; y: number } | null) => void
  ) {
    this.subscribers = this.subscribers.filter((sub) => sub !== callback);
  }

  private notifySubscribers() {
    this.subscribers.forEach((callback) => callback(this.handCoordinates));
  }
}

export const webRTCService = new WebRTCService();

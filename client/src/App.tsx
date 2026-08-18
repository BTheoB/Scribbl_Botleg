import { useEffect, useState, useRef } from "react";
import { webRTCService } from "./services/webrtcService";
import type { GameState } from "./types/types";
import Canvas from "./components/canva/Canvas";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import {
  UsersRound,
  Plus,
  LogIn,
  Play,
  Clock,
  Send,
  Crown,
  PenTool,
  RotateCcw,
  Award,
} from "lucide-react";
import Select from "react-select";

const App = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roomId, setRoomId] = useState("");
  const [playerName, setPlayerName] = useState(
    `Player-${Math.floor(Math.random() * 1000)}`
  );
  const [guess, setGuess] = useState("");
  const [maxRounds, setMaxRounds] = useState(3);
  const guessInputRef = useRef<HTMLInputElement>(null);
  const roundOptions = [
    { value: "1", label: "1 tour" },
    { value: "2", label: "2 tours" },
    { value: "3", label: "3 tours" },
    { value: "4", label: "4 tours" },
    { value: "5", label: "5 tours" },
  ];

  useEffect(() => {
    webRTCService.setStateChangeCallback((newState) => {
      setGameState(newState);
    });
  }, []);

  const handleCreateRoom = async () => {
    try {
      const myRoomId = await webRTCService.createRoom();
      setRoomId(myRoomId);
      await webRTCService.joinRoom(myRoomId, playerName);
    } catch (error) {
      console.error("Erreur lors de la création de la room:", error);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomId) return;
    try {
      await webRTCService.joinRoom(roomId, playerName);
    } catch (error) {
      console.error("Erreur lors de la jonction à la room:", error);
    }
  };

  const handleStartGame = () => {
    if (webRTCService.isHostUser()) {
      webRTCService.setMaxRounds(maxRounds);
      webRTCService.startGame();
    }
  };

  const handleRestartGame = () => {
    if (webRTCService.isHostUser()) {
      webRTCService.restartGame();
    }
  };

  const handleSubmitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (guess.trim()) {
      webRTCService.submitGuess(guess);
      setGuess("");
      // Focus sur l'input après soumission
      guessInputRef.current?.focus();
    }
  };

  // Détermine si l'utilisateur est le dessinateur actuel
  const isDrawer = gameState && webRTCService.isCurrentDrawer();


  //Vérifie si un nouveau roudn vien d'être lancé
  if (webRTCService.getIsNextVideo()) {
    webRTCService.removeVideoStream();
    //webRTCService.stopHandTracking();
    //Vérifie que le peer est drawer ou non, si oui il lance un appel a tous les autres
    if (isDrawer) {
      console.log("lancement vidéo");
      webRTCService.startVideo();
    }
  }

  // Récupère le mot à dessiner (visible uniquement pour le dessinateur)
  const wordToDraw = webRTCService.getWordToDraw();

  // Vérifie si l'utilisateur est l'hôte
  const isHost = webRTCService.isHostUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">
            Scribble.io Clone
          </h1>
          <p className="text-gray-500">Draw and guess with your friends!</p>
        </div>

        {!gameState ? (
          /* Room Join Controls */
          <Card>
            <CardHeader>
              <CardTitle>Rejoindre une partie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="playerName"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Votre nom
                  </label>
                  <Input
                    id="playerName"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Entrez votre nom"
                  />
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                  <Button
                    onClick={handleCreateRoom}
                    className="flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Créer une Room
                  </Button>
                  <div className="flex-1 flex gap-2">
                    <Input
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      placeholder="Code de la Room"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleJoinRoom}
                      variant="secondary"
                      className="flex items-center gap-2"
                      disabled={!roomId}
                    >
                      <LogIn size={20} />
                      Rejoindre
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Game Area */
          <div className="space-y-6">
            {/* Game Controls & Status */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <Card className="flex-1">
                <CardContent className="p-4 flex items-center">
                  <div className="w-full">
                    {!gameState.gameStarted && !gameState.gameEnded ? (
                      /* Waiting for game to start */
                      <div className="text-center">
                        <p className="text-gray-500 mb-3">
                          En attente du démarrage de la partie
                        </p>
                        {isHost && (
                          <div className="space-y-4">
                            <div className="flex flex-col items-center gap-2">
                              <label
                                htmlFor="maxRounds"
                                className="block text-sm font-medium text-gray-700"
                              >
                                Nombre de tours par joueur
                              </label>
                              <Select
                                inputId="maxRounds"
                                value={roundOptions.find(
                                  (option) =>
                                    option.value === maxRounds.toString()
                                )}
                                options={roundOptions}
                                placeholder="Tours"
                                styles={{
                                  control: (base) => ({
                                    ...base,
                                    width: "8rem",
                                  }),
                                }}
                                className="w-32"
                                onChange={(selectedOption) =>
                                  setMaxRounds(parseInt(selectedOption?.value||"3"))
                                }
                              />
                            </div>
                            <Button
                              onClick={handleStartGame}
                              disabled={gameState.players.length < 2}
                              className="flex mx-auto items-center gap-2"
                            >
                              <Play size={18} />
                              Démarrer la partie
                            </Button>
                          </div>
                        )}
                        {isHost && gameState.players.length < 2 && (
                          <p className="text-amber-600 text-sm mt-2">
                            Au moins 2 joueurs sont nécessaires
                          </p>
                        )}
                      </div>
                    ) : gameState.gameEnded ? (
                      /* Game has ended */
                      <div className="text-center">
                        <div className="flex justify-center items-center gap-2 mb-3">
                          <Award size={24} className="text-yellow-500" />
                          <h3 className="text-xl font-bold">Partie terminée</h3>
                        </div>
                        {isHost && (
                          <Button
                            onClick={handleRestartGame}
                            className="flex mx-auto items-center gap-2"
                          >
                            <RotateCcw size={18} />
                            Nouvelle partie
                          </Button>
                        )}
                      </div>
                    ) : (
                      /* Game is running */
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Tour</p>
                          <p className="font-medium">
                            {gameState.currentRound} /{" "}
                            {gameState.maxRounds * gameState.players.length}
                          </p>
                        </div>
                        <div className="text-center">
                          <div className="flex justify-center items-center gap-2">
                            <Clock
                              size={18}
                              className={
                                gameState.roundActive
                                  ? "text-green-500"
                                  : "text-gray-400"
                              }
                            />
                            <p
                              className={`font-bold ${
                                gameState.roundTimeLeft <= 10
                                  ? "text-red-500"
                                  : ""
                              }`}
                            >
                              {gameState.roundTimeLeft}s
                            </p>
                          </div>
                          {gameState.roundActive ? (
                            isDrawer ? (
                              <div className="mt-1 p-2 bg-blue-100 rounded-lg">
                                <p className="text-sm text-gray-600">
                                  Dessinez :
                                </p>
                                <p className="font-bold text-blue-800">
                                  {wordToDraw}
                                </p>
                              </div>
                            ) : (
                              <div className="mt-1 p-2 bg-gray-100 rounded-lg">
                                <p className="text-sm text-gray-600">
                                  Indice :
                                </p>
                                <p className="font-bold tracking-wider">
                                  {gameState.wordHint}
                                </p>
                              </div>
                            )
                          ) : (
                            <p className="mt-1 text-sm text-purple-600">
                              En attente du prochain tour
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-end">
                          {gameState.roundActive && gameState.currentDrawer && (
                            <div className="flex items-center gap-2">
                              <PenTool size={18} className="text-blue-500" />
                              <span>
                                {gameState.players.find(
                                  (p) => p.id === gameState.currentDrawer
                                )?.name || "Joueur"}
                                {" dessine..."}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Game Content */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Canvas Area */}
              <div className="md:col-span-3 space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <Canvas gameState={gameState} />
                  </CardContent>
                </Card>

                {/* Guess Input */}
                {gameState.gameStarted &&
                  gameState.roundActive &&
                  !isDrawer && (
                    <form onSubmit={handleSubmitGuess} className="flex gap-2">
                      <Input
                        ref={guessInputRef}
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        placeholder="Votre réponse..."
                        className="flex-1"
                        autoComplete="off"
                      />
                      <Button
                        type="submit"
                        className="flex items-center gap-2"
                        disabled={!guess.trim()}
                      >
                        <Send size={18} />
                        Envoyer
                      </Button>
                    </form>
                  )}

                {/* Guesses Display */}
                {gameState.guesses.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Réponses</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-40 overflow-y-auto py-0">
                      <ul className="space-y-1">
                        {gameState.guesses.map((guessItem, idx) => (
                          <li
                            key={idx}
                            className={`text-sm p-1.5 rounded ${
                              guessItem.correct
                                ? "bg-green-100 text-green-800"
                                : "text-gray-700"
                            }`}
                          >
                            <span className="font-medium">
                              {guessItem.playerName}:{" "}
                            </span>
                            {guessItem.guess}
                            {guessItem.correct && " ✓"}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Players Sidebar */}
              <div className="md:col-span-1">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UsersRound size={20} />
                      Joueurs ({gameState.players.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-2">
                      {gameState.players
                        .sort((a, b) => b.score - a.score) // Trier par score
                        .map((player, index) => (
                          <li
                            key={player.id}
                            className={`flex justify-between items-center p-2 rounded-lg
                              ${
                                player.id === gameState.currentDrawer
                                  ? "bg-blue-50 border border-blue-200"
                                  : "bg-gray-50 hover:bg-gray-100"
                              } 
                              transition-colors`}
                          >
                            <div className="flex items-center gap-2">
                              {index === 0 &&
                                gameState.gameStarted &&
                                gameState.players[0].score > 0 && (
                                  <Crown
                                    size={16}
                                    className="text-yellow-500"
                                  />
                                )}
                              <span
                                className={
                                  player.id === gameState.currentDrawer
                                    ? "font-medium"
                                    : ""
                                }
                              >
                                {player.name}
                                {player.id === webRTCService.getPeerId()
                                  ? " (vous)"
                                  : ""}
                              </span>
                            </div>
                            <span className="font-medium text-blue-600">
                              {player.score}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <div className="w-full text-center">
                      <p className="text-xs text-gray-500">
                        Code de la room:{" "}
                        <span className="font-mono">{roomId}</span>
                      </p>
                    </div>
                  </CardFooter>
                </Card>
                <div className="md:col-span-1">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        Live cam
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div id="videoContainer">
                        <video id="localVideo" autoPlay muted></video>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

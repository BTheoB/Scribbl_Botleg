export interface GameState {
  canvas: {
    paths: {
      points: { x: number; y: number }[];
      color: string;
      width: number;
    }[];
  };
  players: {
    id: string;
    name: string;
    score: number;
  }[];
  currentWord: string; // Visible uniquement pour l'hôte (pour validation)
  wordHint: string;    // Indice du mot à deviner (partiellement masqué, visible par tous)
  currentDrawer: string;
  maxRounds: number;
  gameEnded: boolean;
  currentRound: number;
  roundActive: boolean;
  roundTimeLeft: number;
  gameStarted: boolean;
  guesses: {
    playerId: string;
    playerName: string;
    guess: string;
    correct: boolean;
  }[];
  nextVideo: Boolean;
}
import React, { useState, useCallback } from 'react';
import { Game } from './Game';
import { UI } from './components/UI';
import { GameState } from './types';
import { COLORS } from './constants';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.INTRO);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [tasksCompleted, setTasksCompleted] = useState(0);
  const [currentZoneName, setCurrentZoneName] = useState("The Barren Sands");
  const [dialogue, setDialogue] = useState<string | null>(null);

  const handleStart = () => {
    setGameState(GameState.PLAYING);
  };

  const handleTaskComplete = useCallback((count: number) => {
    setTasksCompleted(count);
  }, []);

  const handleZoneChange = useCallback((zone: string) => {
    setCurrentZoneName(zone);
  }, []);

  const handleDialogue = useCallback((text: string | null) => {
    setDialogue(text);
  }, []);

  const handleFinishLevel = useCallback(() => {
    // If we just finished Ep 4, go to Global Finish
    if (currentEpisode === 4) {
      setGameState(GameState.FINISHED);
    } else {
      // Otherwise, advance episode and reset player state via Game component re-mount
      setCurrentEpisode(prev => prev + 1);
      setTasksCompleted(0);
      setDialogue(null);
      // We stay in PLAYING state, the Game component will handle the level init based on prop change
    }
  }, [currentEpisode]);

  return (
    <div className="relative w-full h-screen overflow-hidden select-none" style={{ backgroundColor: COLORS.BLUE }}>
      {/* Scanlines Effect */}
      <div className="scanlines"></div>
      <div className="vignette"></div>

      {gameState !== GameState.FINISHED && (
        <Game 
          gameState={gameState}
          episode={currentEpisode}
          onTaskComplete={handleTaskComplete}
          onZoneChange={handleZoneChange}
          onDialogue={handleDialogue}
          onFinish={handleFinishLevel}
        />
      )}
      
      <UI 
        gameState={gameState}
        episode={currentEpisode}
        tasksCompleted={tasksCompleted}
        currentZoneName={currentZoneName}
        dialogue={dialogue}
        onStart={handleStart}
      />
    </div>
  );
}

export default App;
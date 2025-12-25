
import React, { useState, useCallback, useEffect } from 'react';
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
  const [isEndingTransition, setIsEndingTransition] = useState(false);

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
    // If we just finished Ep 4, trigger fade to white
    if (currentEpisode === 4) {
      setIsEndingTransition(true);
      setTimeout(() => {
        setGameState(GameState.FINISHED);
      }, 3000);
    } else {
      // Otherwise, advance episode
      setCurrentEpisode(prev => prev + 1);
      setTasksCompleted(0);
      setDialogue(null);
    }
  }, [currentEpisode]);

  const currentBg = gameState === GameState.INTRO ? COLORS.EPISODE_1.bg : 
                    gameState === GameState.FINISHED ? '#000' :
                    [COLORS.EPISODE_1.bg, COLORS.EPISODE_2.bg, COLORS.EPISODE_3.bg, COLORS.EPISODE_4.bg][currentEpisode - 1];

  return (
    <div className="relative w-full h-screen overflow-hidden select-none" style={{ backgroundColor: currentBg }}>
      {/* Scanlines Effect */}
      <div className="scanlines"></div>
      <div className="vignette"></div>

      {/* Fade to White Overlay */}
      <div 
        className={`absolute inset-0 z-[60] bg-white transition-opacity duration-[3000ms] pointer-events-none ${isEndingTransition ? 'opacity-100' : 'opacity-0'}`}
      />

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

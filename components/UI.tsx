
import React from 'react';
import { GameState } from '../types';
import { COLORS } from '../constants';

interface UIProps {
  gameState: GameState;
  episode: number;
  tasksCompleted: number;
  currentZoneName: string;
  dialogue: string | null;
  onStart: () => void;
}

export const UI: React.FC<UIProps> = ({ gameState, episode, tasksCompleted, currentZoneName, dialogue, onStart }) => {
  const getEpisodeTitle = () => {
    switch(episode) {
      case 1: return "The Full Journey";
      case 2: return "The Weaver's Tongue";
      case 3: return "The Feast of Ash";
      case 4: return "The Recurrence";
      default: return "";
    }
  };

  if (gameState === GameState.INTRO) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-center p-8 bg-opacity-95" style={{ backgroundColor: COLORS.EPISODE_1.bg }}>
        <h1 className="text-5xl md:text-8xl mb-4 tracking-widest font-bold" style={{ color: COLORS.EPISODE_1.player }}>
          PROCNE
        </h1>
        <div className="w-24 h-1 bg-orange-500 mb-12"></div>
        
        <div className="text-sm md:text-base space-y-4 max-w-lg leading-loose mb-12" style={{ color: COLORS.EPISODE_1.player }}>
          <p className="italic opacity-60 mb-8">"It is not the sky that holds me, but the weight of what I left below."</p>
          <div className="grid grid-cols-2 gap-4 text-left border p-4 border-opacity-20" style={{ borderColor: COLORS.EPISODE_1.player }}>
            <div><span style={{ color: COLORS.ORANGE }}>ARROWS</span> Move</div>
            <div><span style={{ color: COLORS.ORANGE }}>SPACE</span> Jump / Slash</div>
            <div><span style={{ color: COLORS.ORANGE }}>E</span> Interact</div>
          </div>
        </div>

        <button 
          onClick={onStart}
          className="px-8 py-4 text-xl border-4 transition-colors duration-200"
          style={{ 
            borderColor: COLORS.ORANGE, 
            color: COLORS.EPISODE_1.player, 
            backgroundColor: 'transparent' 
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = COLORS.EPISODE_1.player;
            e.currentTarget.style.color = COLORS.EPISODE_1.bg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = COLORS.EPISODE_1.player;
          }}
        >
          BEGIN
        </button>
      </div>
    );
  }

  if (gameState === GameState.PLAYING) {
    const palette = [COLORS.EPISODE_1, COLORS.EPISODE_2, COLORS.EPISODE_3, COLORS.EPISODE_4][episode - 1];
    return (
      <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-between p-6">
        {/* Top Bar */}
        <div className="flex justify-between items-start">
          <div style={{ color: palette.player }}>
            <div className="text-xs text-orange-400 uppercase tracking-widest mb-1">Episode {episode}: {getEpisodeTitle()}</div>
            <h3 className="text-lg mb-2 opacity-80 tracking-wider">{currentZoneName}</h3>
            {episode !== 4 && (
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-3 h-3 border transform rotate-45"
                    style={{ 
                      borderColor: palette.player,
                      backgroundColor: i < tasksCompleted ? COLORS.ORANGE : 'transparent' 
                    }}
                  />
                ))}
              </div>
            )}
            {episode === 4 && (
               <div className="text-xs text-red-500 mt-2 animate-pulse">SURVIVE</div>
            )}
          </div>
        </div>

        {/* Dialogue Overlay */}
        {dialogue && (
          <div className="self-center w-full max-w-2xl mb-12">
            <div 
              className="border-t-4 border-b-4 p-8 bg-opacity-95 text-center leading-loose shadow-lg backdrop-blur-sm"
              style={{ borderColor: COLORS.ORANGE, color: palette.player, backgroundColor: palette.bg }}
            >
              <p className="text-lg md:text-xl font-serif">{dialogue}</p>
              <p className="text-xs mt-6 text-orange-400 uppercase tracking-widest">Press E to continue</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (gameState === GameState.FINISHED) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center z-50 overflow-hidden bg-black transition-opacity duration-1000">
         {/* Background Bird Silhouette (Huge, faded) */}
         <div className="absolute inset-0 flex items-center justify-center opacity-10">
             <div className="w-[800px] h-[800px] bg-white rounded-full blur-3xl"></div>
         </div>
         
         <div className="relative z-10 text-center">
            <h1 className="text-6xl md:text-9xl tracking-[1rem] font-bold text-white mb-8 animate-pulse">
              PROCNE
            </h1>
            <div className="w-full h-1 bg-orange-500 mb-8 mx-auto max-w-md"></div>
            <button 
              onClick={() => window.location.reload()}
              className="mt-8 text-xs text-gray-500 hover:text-white transition-colors"
            >
              The cycle continues...
            </button>
         </div>
      </div>
    );
  }

  return null;
};

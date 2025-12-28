
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

  const palette = [COLORS.EPISODE_1, COLORS.EPISODE_2, COLORS.EPISODE_3, COLORS.EPISODE_4][episode - 1] || COLORS.EPISODE_1;

  if (gameState === GameState.INTRO) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-center p-8 overflow-hidden transition-all duration-1000" style={{ backgroundColor: COLORS.EPISODE_1.bg }}>
        
        {/* Background Atmospheric Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.1] transform transition-transform duration-[30000ms] hover:scale-110">
            <svg width="600" height="600" viewBox="0 0 200 200" fill={COLORS.EPISODE_1.player}>
               <path d="M100 50 C 115 45, 130 55, 130 65 C 160 40, 190 10, 195 15 C 175 45, 150 70, 135 85 L 140 115 L 100 130 L 60 115 L 65 85 C 50 70, 25 45, 5 15 C 10 10, 40 40, 70 65 C 70 55, 85 45, 100 50 Z" />
               <path d="M100 130 L 70 180 L 100 150 L 130 180 Z" />
            </svg>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <h1 className="text-6xl md:text-8xl mb-6 tracking-[1rem] font-black drop-shadow-lg" style={{ color: COLORS.EPISODE_1.player }}>
            PROCNE
          </h1>
          
          <div className="w-48 h-2 bg-white mb-12 shadow-md"></div>
          
          <div className="w-full max-w-4xl px-4">
            <p className="text-sm md:text-lg italic opacity-80 mb-12 tracking-widest font-serif leading-relaxed" style={{ color: COLORS.EPISODE_1.player }}>
              "The silence is waiting for your voice."
            </p>

            <div className="flex flex-col md:flex-row justify-center items-center gap-6 py-8 border-t-4 border-b-4 border-white text-xs md:text-sm uppercase tracking-[0.2rem] font-bold" style={{ color: COLORS.EPISODE_1.player }}>
              <div className="whitespace-nowrap"><span className="bg-white px-2 py-1 rounded mr-2" style={{ color: COLORS.ORANGE }}>ARROWS</span> MOVE</div>
              <div className="whitespace-nowrap"><span className="bg-white px-2 py-1 rounded mr-2" style={{ color: COLORS.ORANGE }}>SPACE</span> ACTION</div>
              <div className="whitespace-nowrap"><span className="bg-white px-2 py-1 rounded mr-2" style={{ color: COLORS.ORANGE }}>E</span> INTERACT</div>
            </div>
          </div>

          <button 
            onClick={onStart}
            className="mt-16 px-16 py-6 text-2xl font-bold border-4 shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 group relative"
            style={{ 
              borderColor: 'white', 
              color: 'white', 
              backgroundColor: COLORS.EPISODE_1.player 
            }}
          >
            <span className="relative z-10">BEGIN JOURNEY</span>
          </button>
        </div>
      </div>
    );
  }

  if (gameState === GameState.PLAYING) {
    return (
      <div className="absolute inset-0 pointer-events-none z-40 flex flex-col justify-between p-8">
        {/* Top Bar HUD */}
        <div className="flex justify-between items-start bg-black bg-opacity-20 p-4 rounded-lg backdrop-blur-sm border-l-8 border-white shadow-lg">
          <div style={{ color: 'white' }}>
            <div className="text-xs text-yellow-300 uppercase tracking-[0.3rem] font-black mb-1">
              Episode {episode}: {getEpisodeTitle()}
            </div>
            <h3 className="text-xl tracking-wider font-serif font-bold text-white shadow-sm">{currentZoneName}</h3>
            {episode !== 4 && (
              <div className="flex gap-3 mt-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-4 h-4 border-2 transform rotate-45 transition-all duration-500 shadow-md"
                    style={{ 
                      borderColor: 'white',
                      backgroundColor: i < tasksCompleted ? COLORS.ORANGE : 'transparent' 
                    }}
                  />
                ))}
              </div>
            )}
            {episode === 4 && (
               <div className="text-sm text-red-400 mt-2 animate-pulse tracking-[0.4rem] font-black drop-shadow-md">
                 SURVIVE THE RECURRENCE
               </div>
            )}
          </div>
        </div>

        {/* Dialogue Overlay */}
        {dialogue && (
          <div className="self-center w-full max-w-4xl mb-12">
            <div 
              className="border-8 p-12 bg-opacity-95 text-center leading-relaxed shadow-2xl backdrop-blur-lg rounded-xl transition-all"
              style={{ borderColor: COLORS.ORANGE, color: 'white', backgroundColor: palette.player }}
            >
              <p className="text-xl md:text-2xl font-serif italic tracking-wide drop-shadow-sm font-bold">"{dialogue}"</p>
              <p className="text-xs mt-10 text-yellow-400 uppercase tracking-[0.5rem] opacity-70 animate-bounce">Press E to continue</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (gameState === GameState.FINISHED) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center z-50 overflow-hidden bg-black transition-opacity duration-1000">
         <div className="relative z-10 text-center">
            <h1 className="text-7xl md:text-9xl tracking-[2rem] font-black text-white mb-8 animate-pulse drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
              PROCNE
            </h1>
            <div className="w-full h-2 bg-orange-500 mb-8 mx-auto max-w-lg shadow-lg"></div>
            <p className="text-white text-lg tracking-[1rem] font-bold opacity-80 mb-12">THE CYCLE IS SEALED</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-8 text-sm text-gray-400 hover:text-white transition-all tracking-[0.5rem] uppercase font-black border-2 border-gray-800 hover:border-white px-8 py-4"
            >
              Restart
            </button>
         </div>
      </div>
    );
  }

  return null;
};

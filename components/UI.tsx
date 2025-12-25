
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
      <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-center p-8 overflow-hidden transition-all duration-1000" style={{ backgroundColor: COLORS.EPISODE_1.bg }}>
        
        {/* Background Atmospheric Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Distant Bird Head Silhouette */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] scale-[2] transform transition-transform duration-[10000ms] hover:scale-[2.1]">
            <svg width="400" height="400" viewBox="0 0 100 100" fill={COLORS.EPISODE_1.player}>
              <path d="M50 10 L80 40 L70 80 L30 80 L20 40 Z" />
              <path d="M45 45 Q50 35 55 45" stroke={COLORS.ORANGE} fill="none" strokeWidth="2" />
            </svg>
          </div>
          
          {/* Sky Ambience - Drifting Clouds/Mist */}
          <div className="absolute top-[20%] left-[-10%] w-[40%] h-[2px] bg-white opacity-10 animate-pulse" style={{ filter: 'blur(40px)', animationDuration: '8s' }}></div>
          <div className="absolute bottom-[30%] right-[-10%] w-[50%] h-[4px] bg-white opacity-5 animate-pulse" style={{ filter: 'blur(60px)', animationDuration: '12s' }}></div>
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <h1 className="text-6xl md:text-9xl mb-6 tracking-[1.5rem] font-bold transition-all" style={{ color: COLORS.EPISODE_1.player }}>
            PROCNE
          </h1>
          
          <div className="w-32 h-1 bg-orange-600 mb-12 opacity-80"></div>
          
          <div className="w-full max-w-3xl px-4">
            <p className="text-xs md:text-sm italic opacity-70 mb-12 tracking-widest font-serif" style={{ color: COLORS.EPISODE_1.player }}>
              "The silence is waiting for your voice."
            </p>

            <div className="flex flex-wrap justify-center items-center gap-8 py-6 border-t border-b border-opacity-10 text-[10px] md:text-[12px] uppercase tracking-widest" style={{ borderColor: COLORS.EPISODE_1.player, color: COLORS.EPISODE_1.player }}>
              <div className="whitespace-nowrap"><span className="text-orange-600 mr-2 font-bold">ARROWS</span> MOVE</div>
              <div className="hidden md:block w-1 h-1 bg-current opacity-20 rounded-full"></div>
              <div className="whitespace-nowrap"><span className="text-orange-600 mr-2 font-bold">SPACE</span> JUMP / SLASH</div>
              <div className="hidden md:block w-1 h-1 bg-current opacity-20 rounded-full"></div>
              <div className="whitespace-nowrap"><span className="text-orange-600 mr-2 font-bold">E</span> INTERACT / SHIELD</div>
            </div>
          </div>

          <button 
            onClick={onStart}
            className="mt-16 px-12 py-5 text-xl border-2 transition-all duration-300 hover:tracking-[0.5rem] relative group"
            style={{ 
              borderColor: COLORS.ORANGE, 
              color: COLORS.EPISODE_1.player, 
              backgroundColor: 'transparent' 
            }}
          >
            <span className="relative z-10">BEGIN</span>
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-5 transition-opacity"></div>
          </button>
        </div>
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
            <div className="text-[10px] text-orange-400 uppercase tracking-widest mb-1">Episode {episode}: {getEpisodeTitle()}</div>
            <h3 className="text-sm mb-2 opacity-80 tracking-wider font-serif">{currentZoneName}</h3>
            {episode !== 4 && (
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div 
                    key={i} 
                    className="w-2 h-2 border transform rotate-45"
                    style={{ 
                      borderColor: palette.player,
                      backgroundColor: i < tasksCompleted ? COLORS.ORANGE : 'transparent' 
                    }}
                  />
                ))}
              </div>
            )}
            {episode === 4 && (
               <div className="text-[10px] text-red-500 mt-2 animate-pulse tracking-widest">SURVIVE THE RECURRENCE</div>
            )}
          </div>
        </div>

        {/* Dialogue Overlay */}
        {dialogue && (
          <div className="self-center w-full max-w-2xl mb-12">
            <div 
              className="border-t-2 border-b-2 p-10 bg-opacity-95 text-center leading-loose shadow-2xl backdrop-blur-md"
              style={{ borderColor: COLORS.ORANGE, color: palette.player, backgroundColor: palette.bg }}
            >
              <p className="text-base md:text-lg font-serif italic tracking-wide">"{dialogue}"</p>
              <p className="text-[8px] mt-8 text-orange-400 uppercase tracking-[0.3rem] opacity-50">Press E to continue</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (gameState === GameState.FINISHED) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center z-50 overflow-hidden bg-black transition-opacity duration-1000">
         <div className="absolute inset-0 flex items-center justify-center opacity-10">
             <div className="w-[800px] h-[800px] bg-white rounded-full blur-3xl"></div>
         </div>
         
         <div className="relative z-10 text-center">
            <h1 className="text-6xl md:text-9xl tracking-[2rem] font-bold text-white mb-8 animate-pulse">
              PROCNE
            </h1>
            <div className="w-full h-1 bg-orange-500 mb-8 mx-auto max-w-md"></div>
            <p className="text-white text-[10px] tracking-[0.5rem] opacity-50 mb-12">THE CYCLE IS SEALED</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-8 text-[10px] text-gray-500 hover:text-white transition-colors tracking-widest uppercase"
            >
              Return to the beginning
            </button>
         </div>
      </div>
    );
  }

  return null;
};

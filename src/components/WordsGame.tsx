import React, { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Send } from 'lucide-react';

interface WordsGameProps {
  gameState: any;
  onUpdate: (newState: any) => void;
  myUid?: string;
  myDisplayName?: string;
}

export const WordsGame = ({ gameState, onUpdate, myUid, myDisplayName }: WordsGameProps) => {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    const word = inputText.trim().toLowerCase();
    if (!word) return;

    if (gameState.words && gameState.words.includes(word)) {
      (window as any).addToast?.('Это слово уже было!', 'error');
      return;
    }

    if (gameState.lastWord) {
      const lastChar = gameState.lastWord.slice(-1);
      const validLastChar = ['ь', 'ъ', 'ы'].includes(lastChar) ? gameState.lastWord.slice(-2, -1) : lastChar;
      
      if (word[0] !== validLastChar) {
        (window as any).addToast?.(`Слово должно начинаться на букву "${validLastChar.toUpperCase()}"`, 'error');
        return;
      }
    }

    const newWords = [...(gameState.words || []), word];
    
    onUpdate({
      ...gameState,
      words: newWords,
      lastWord: word,
      turnId: gameState.opponentId === myUid ? gameState.creatorId : gameState.opponentId
    });
    setInputText('');
  };

  if (gameState.status === 'waiting') {
    if (gameState.creatorId === myUid) {
      return <div className="p-4 bg-slate-50 rounded-2xl text-center text-sm font-medium">Ожидание соперника...</div>;
    }
    return (
      <div className="p-4 bg-slate-50 rounded-2xl text-center space-y-3">
        <p className="text-sm font-medium">Вас приглашают в Игру в слова!</p>
        <button
          onClick={() => onUpdate({ ...gameState, status: 'playing', opponentId: myUid, turnId: myUid })}
          className="w-full py-2 bg-blue-500 text-white rounded-xl font-bold"
        >
          Принять вызов
        </button>
      </div>
    );
  }

  const isMyTurn = gameState.turnId === myUid;
  const lastChar = gameState.lastWord ? (() => {
    const char = gameState.lastWord.slice(-1);
    return ['ь', 'ъ', 'ы'].includes(char) ? gameState.lastWord.slice(-2, -1) : char;
  })() : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden text-slate-800">
      <div className="bg-blue-500 text-white text-center py-2 font-bold text-xs uppercase tracking-wide">
        Игра в слова
      </div>
      
      <div className="p-4 space-y-4">
        {gameState.words?.length > 0 && (
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-lg">
            {gameState.words.map((w: string, i: number) => (
              <span key={i} className="text-xs font-medium px-2 py-1 bg-white border border-slate-200 rounded-md shadow-sm">
                {w}
              </span>
            ))}
          </div>
        )}
        
        <div className="text-center font-bold text-sm">
          {isMyTurn ? (
            <span className="text-blue-500">Ваш ход! {lastChar && `Вам на букву "${lastChar.toUpperCase()}"`}</span>
          ) : (
            <span className="text-slate-500">Ожидание хода соперника...</span>
          )}
        </div>

        {isMyTurn && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder={lastChar ? `Слово на "${lastChar.toUpperCase()}"` : "Любое слово..."}
              className="flex-1 text-sm py-2 px-3 bg-slate-100 border-none rounded-xl"
            />
            <button onClick={handleSend} className="p-2 bg-blue-500 text-white rounded-xl shrink-0">
              <Send size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

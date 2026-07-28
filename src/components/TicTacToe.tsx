import React from 'react';
import { motion } from 'motion/react';
import { RotateCw, X, Circle } from 'lucide-react';

interface TicTacToeProps {
  gameState: {
    board: Array<'X' | 'O' | null>;
    xIsNext: boolean;
    winner: 'X' | 'O' | null;
    playerX: string;
    playerO: string | null;
  };
  onMove: (index: number) => void;
  onReset?: () => void;
  isMyTurn: boolean;
  mySymbol: 'X' | 'O' | null;
}

export function TicTacToe({ gameState, onMove, onReset, isMyTurn, mySymbol }: TicTacToeProps) {
  const { board, xIsNext, winner } = gameState;
  const isDraw = !winner && board.every(square => square !== null);

  const handleClick = (i: number) => {
    if (board[i] || winner || !isMyTurn) return;
    onMove(i);
  };

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <div className="mb-4 text-center">
        {winner ? (
          <div className="text-lg font-bold text-green-600 flex items-center gap-2 justify-center">
            Победитель: {winner === 'X' ? <X size={20} /> : <Circle size={20} />}
          </div>
        ) : isDraw ? (
          <div className="text-lg font-bold text-slate-600">Ничья!</div>
        ) : (
          <div className="text-sm font-medium text-slate-700 flex items-center gap-2 justify-center">
            {isMyTurn ? 'Ваш ход' : 'Ход противника'}
            {xIsNext ? <X size={16} className="text-blue-500" /> : <Circle size={16} className="text-red-500" />}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 bg-slate-200 p-1.5 rounded-xl">
        {board.map((square, i) => (
          <motion.button
            key={i}
            whileTap={isMyTurn && !square && !winner ? { scale: 0.95 } : {}}
            onClick={() => handleClick(i)}
            disabled={!isMyTurn || square !== null || winner !== null}
            className={`w-12 h-12 bg-white rounded-lg flex items-center justify-center text-2xl shadow-sm transition-colors ${isMyTurn && !square && !winner ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}
          >
            {square === 'X' && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><X size={32} className="text-blue-500" /></motion.div>}
            {square === 'O' && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Circle size={32} className="text-red-500" /></motion.div>}
          </motion.button>
        ))}
      </div>

      {onReset && (winner || isDraw) && (
        <button
          onClick={onReset}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors text-sm"
        >
          <RotateCw size={16} />
          Сыграть еще
        </button>
      )}
    </div>
  );
}

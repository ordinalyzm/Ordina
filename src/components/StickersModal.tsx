import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Save, Check } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { StickerPack, Sticker, UserProfile } from '../types';

interface StickersModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  profile: UserProfile | null;
  onSendSticker: (url: string, packId?: string) => void;
  socket: any;
}

export default function StickersModal({ isOpen, onClose, user, profile, onSendSticker, socket }: StickersModalProps) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [activeTab, setActiveTab] = useState<'saved' | 'create'>('saved');
  const [newPackName, setNewPackName] = useState('');
  const [newStickers, setNewStickers] = useState<{file?: File, preview: string, id?: string}[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !socket) return;
    
    socket.emit('stickers:list');
    
    const handleList = (loadedPacks: StickerPack[]) => {
      setPacks(loadedPacks);
    };

    const handleCreated = (newPack: StickerPack) => {
      setPacks(prev => [...prev, newPack]);
    };

    const handleDeleted = (id: string) => {
      setPacks(prev => prev.filter(p => p.id !== id));
    };

    const handleUpdated = (updatedPack: StickerPack) => {
      setPacks(prev => prev.map(p => p.id === updatedPack.id ? updatedPack : p));
    };

    socket.on('stickers:list', handleList);
    socket.on('sticker:pack:created', handleCreated);
    socket.on('sticker:pack:deleted', handleDeleted);
    socket.on('sticker:pack:updated', handleUpdated);

    return () => {
      socket.off('stickers:list', handleList);
      socket.off('sticker:pack:created', handleCreated);
      socket.off('sticker:pack:deleted', handleDeleted);
      socket.off('sticker:pack:updated', handleUpdated);
    };
  }, [isOpen, socket]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => f.type.startsWith('image/') && f.size < 5 * 1024 * 1024);
    
    if (validFiles.length < files.length) {
      if ((window as any).addToast) (window as any).addToast('Некоторые файлы пропущены (только картинки до 5МБ)', 'error');
    }

    const newPreviews = validFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    
    setNewStickers(prev => [...prev, ...newPreviews]);
  };

  const handleCreatePack = async () => {
    if (!user || !newPackName.trim() || newStickers.length === 0 || !socket) return;
    setIsUploading(true);
    
    try {
      const { uploadFileToFirestore } = await import('../lib/fileStorage');
      
      const uploadedStickers: Sticker[] = [];
      for (const item of newStickers) {
        if (item.id && item.preview.startsWith('http')) {
          uploadedStickers.push({ id: item.id, url: item.preview });
        } else if (item.file) {
          const url = await uploadFileToFirestore(item.file, user.uid);
          uploadedStickers.push({
            id: uuidv4(),
            url: url
          });
        }
      }
      
      if (editingPackId) {
        const updatedPack = {
          id: editingPackId,
          name: newPackName.trim(),
          creatorId: user.uid,
          stickers: uploadedStickers,
          updatedAt: new Date().toISOString()
        };
        socket.emit('sticker:pack:update', updatedPack);
        if ((window as any).addToast) (window as any).addToast('Стикерпак обновлен!', 'success');
      } else {
        const packId = uuidv4();
        const newPack = {
          id: packId,
          name: newPackName.trim(),
          creatorId: user.uid,
          stickers: uploadedStickers,
          createdAt: new Date().toISOString()
        };
        socket.emit('sticker:pack:create', newPack);
        
        // Auto-save for creator
        if (profile) {
          const saved = profile.savedStickerPacks || [];
          const newSaved = [...saved, packId];
          socket.emit('profile:update', { uid: user.uid, profile: { savedStickerPacks: newSaved } });
        }
        if ((window as any).addToast) (window as any).addToast('Стикерпак успешно создан!', 'success');
      }
      
      setNewPackName('');
      setNewStickers([]);
      setEditingPackId(null);
      setActiveTab('saved');
    } catch (error) {
      console.error(error);
      if ((window as any).addToast) (window as any).addToast('Ошибка при сохранении стикерпака', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSavePack = async (packId: string) => {
    if (!user || !profile || !socket) return;
    const saved = profile.savedStickerPacks || [];
    const isSaved = saved.includes(packId);
    
    const newSaved = isSaved 
      ? saved.filter(id => id !== packId)
      : [...saved, packId];
      
    socket.emit('profile:update', { uid: user.uid, profile: { savedStickerPacks: newSaved } });
  };

  const deletePack = async (packId: string) => {
    if (!user || !socket) return;
    socket.emit('sticker:pack:delete', packId);
  };

  if (!isOpen) return null;

  const savedPacks = packs.filter(p => (profile?.savedStickerPacks || []).includes(p.id));
  const otherPacks = packs.filter(p => !(profile?.savedStickerPacks || []).includes(p.id));

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="font-bold text-lg">Стикеры</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex border-b border-slate-100">
          <button 
            className={`flex-1 py-3 text-sm font-medium ${activeTab === 'saved' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
            onClick={() => setActiveTab('saved')}
          >
            Мои стикеры
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium ${activeTab === 'create' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
            onClick={() => {
              setActiveTab('create');
              setEditingPackId(null);
              setNewPackName('');
              setNewStickers([]);
            }}
          >
            {editingPackId ? 'Редактирование' : 'Создать пак'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'saved' && (
            <div className="space-y-6">
              {savedPacks.length === 0 && otherPacks.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <p className="mb-4">У вас пока нет стикерпаков.</p>
                  <button 
                    onClick={() => setActiveTab('create')}
                    className="text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-colors font-medium text-sm"
                  >
                    Создать первый пак
                  </button>
                  <p className="mt-4 text-xs">или поищите их в группах</p>
                </div>
              )}
              {savedPacks.length === 0 && otherPacks.length > 0 && (
                <div className="text-center py-6 text-slate-500">
                  <p className="mb-2">Вы не добавили ни одного стикерпака.</p>
                  <p className="text-xs">Ниже есть доступные паки, которые можно добавить!</p>
                </div>
              )}
              {savedPacks.map(pack => (
                <div key={pack.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sm">{pack.name}</h3>
                    <div className="flex gap-2">
                       {pack.creatorId === user?.uid && (
                        <button 
                          onClick={() => {
                            setEditingPackId(pack.id);
                            setNewPackName(pack.name);
                            setNewStickers(pack.stickers.map(s => ({ preview: s.url, id: s.id })));
                            setActiveTab('create');
                          }} 
                          className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
                        >
                          Редактировать
                        </button>
                      )}
                      <button onClick={() => toggleSavePack(pack.id)} className="text-xs text-slate-500 hover:text-slate-700 hover:underline">Убрать</button>
                      {pack.creatorId === user?.uid && (
                        <button onClick={() => deletePack(pack.id)} className="text-xs text-red-400 hover:text-red-600 ml-2" title="Удалить пак навсегда"><Trash2 size={14}/></button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {pack.stickers.map(s => (
                      <div 
                        key={s.id} 
                        className="aspect-square bg-slate-50 rounded-lg overflow-hidden cursor-pointer hover:bg-slate-100 transition-colors p-1"
                        onClick={() => { onSendSticker(s.url, pack.id); onClose(); }}
                      >
                        <img 
                          src={s.url} 
                          alt="sticker"
                          className="w-full h-full object-contain" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {otherPacks.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <h3 className="font-bold text-sm text-slate-500 mb-4">Доступные паки</h3>
                  {otherPacks.map(pack => (
                    <div key={pack.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl mb-2">
                      <div>
                        <p className="font-bold text-sm">{pack.name}</p>
                        <p className="text-xs text-slate-500">{pack.stickers.length} стикеров</p>
                      </div>
                      <button 
                        onClick={() => toggleSavePack(pack.id)}
                        className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-xs font-bold"
                      >
                        Добавить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Название пака</label>
                <input 
                  type="text" 
                  value={newPackName}
                  onChange={e => setNewPackName(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl text-sm"
                  placeholder="Например: Смешные коты"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Стикеры (до 5MB каждый)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {newStickers.map((s, i) => (
                    <div key={i} className="aspect-square bg-slate-50 rounded-lg overflow-hidden relative group">
                      <img src={s.preview} className="w-full h-full object-cover" alt="preview" />
                      <button 
                        onClick={() => setNewStickers(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors text-slate-400">
                    <Plus size={24} />
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                  </label>
                </div>
              </div>
              
              <button 
                onClick={handleCreatePack}
                disabled={isUploading || !newPackName.trim() || newStickers.length === 0}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
              >
                {isUploading ? 'Сохранение...' : (editingPackId ? 'Сохранить изменения' : 'Создать стикерпак')}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

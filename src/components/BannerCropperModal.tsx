import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ZoomIn } from 'lucide-react';

interface BannerCropperModalProps {
  isOpen: boolean;
  imageSrc: string;
  avatarSrc?: string;
  avatarInitial?: string;
  onClose: () => void;
  onCropComplete: (croppedBase64: string) => void;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedBannerImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return '';
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.translate(image.width / 2, image.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-image.width / 2, -image.height / 2);

  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    return '';
  }

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  croppedCtx.fillStyle = '#0F172A';
  croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    resolve(croppedCanvas.toDataURL('image/jpeg', 0.9));
  });
}

export const BannerCropperModal: React.FC<BannerCropperModalProps> = ({
  isOpen,
  imageSrc,
  avatarSrc,
  avatarInitial,
  onClose,
  onCropComplete,
}) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropCompleteEvent = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedBannerImg(imageSrc, croppedAreaPixels);
        onCropComplete(croppedImage);
      } catch (err) {
        console.error('Crop banner failed', err);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[32000] flex flex-col bg-slate-950 text-white select-none"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-slate-900/90 border-b border-slate-800 relative z-20">
          <button 
            type="button" 
            onClick={onClose} 
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-300 hover:text-white"
            title="Отмена"
          >
            <X size={22} />
          </button>
          <div className="text-center">
            <h2 className="font-bold text-base text-white">Кадрирование фона профиля</h2>
            <p className="text-[11px] text-slate-400">Настройте масштаб и положение под вырез аватарки</p>
          </div>
          <button 
            type="button" 
            onClick={handleConfirm} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/30"
          >
            <Check size={16} />
            <span>Применить</span>
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={0.5}
            maxZoom={4}
            aspect={2.4 / 1}
            cropShape="rect"
            showGrid={true}
            restrictPosition={false}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteEvent}
            onZoomChange={setZoom}
          />

          {/* Avatar Cutout Guide Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <div className="relative flex flex-col items-center">
              {/* Circular avatar cutout mask */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-dashed border-amber-400/90 bg-black/40 backdrop-blur-[2px] shadow-2xl flex items-center justify-center overflow-hidden">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="w-full h-full object-cover opacity-50" />
                ) : (
                  <span className="text-white text-3xl font-bold opacity-60">{avatarInitial || '?'}</span>
                )}
              </div>
              <div className="mt-2 px-3 py-1 bg-black/80 rounded-full text-[11px] font-bold text-amber-300 border border-amber-500/40 shadow-lg whitespace-nowrap">
                Вырез под аватарку
              </div>
            </div>
          </div>
        </div>

        {/* Controls footer */}
        <div className="p-4 sm:p-6 bg-slate-900/95 border-t border-slate-800 relative z-20 space-y-3 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          <div className="flex items-center justify-between text-xs text-slate-300 max-w-md mx-auto">
            <span className="flex items-center gap-1 font-bold">
              <ZoomIn size={14} className="text-blue-400" />
              <span>Масштаб фона</span>
            </span>
            <span className="font-mono text-slate-400 font-bold">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="max-w-md mx-auto flex items-center gap-3">
            <input
              type="range"
              value={zoom}
              min={0.5}
              max={4}
              step={0.05}
              aria-label="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <p className="text-[11px] text-center text-slate-400 max-w-md mx-auto">
            Перемещайте изображение пальцем или мышью, чтобы расположить важные детали вокруг центральной аватарки.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

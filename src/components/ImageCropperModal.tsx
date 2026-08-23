import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Point, Area } from 'react-easy-crop';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string;
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

async function getCroppedImg(
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

  // set canvas size to match the bounding box
  canvas.width = image.width;
  canvas.height = image.height;

  ctx.translate(image.width / 2, image.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-image.width / 2, -image.height / 2);

  ctx.drawImage(image, 0, 0);

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) {
    return '';
  }

  // Set the size of the cropped canvas
  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  // Fill background with white instead of black for jpeg 
  croppedCtx.fillStyle = '#FFFFFF';
  croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);

  // Draw the cropped image onto the new canvas
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

export default function ImageCropperModal({ isOpen, imageSrc, onClose, onCropComplete }: ImageCropperModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropCompleteEvent = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (croppedAreaPixels) {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedImage);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[30000] flex flex-col bg-black"
      >
        <div className="flex justify-between items-center p-4 bg-black/50 text-white relative z-10">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={24} />
          </button>
          <h2 className="font-bold text-lg">Кадрирование</h2>
          <button onClick={handleConfirm} className="p-2 hover:bg-white/10 rounded-full transition-colors text-emerald-400">
            <Check size={24} />
          </button>
        </div>
        <div className="relative flex-1">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={0.1}
            maxZoom={5}
            aspect={1}
            cropShape="round"
            showGrid={false}
            restrictPosition={false}
            onCropChange={setCrop}
            onCropComplete={onCropCompleteEvent}
            onZoomChange={setZoom}
          />
        </div>
        <div className="p-6 bg-black/50 relative z-10 pb-10">
          <input
            type="range"
            value={zoom}
            min={0.1}
            max={5}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => {
              setZoom(Number(e.target.value));
            }}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

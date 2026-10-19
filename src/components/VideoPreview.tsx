import React, { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { getFileFromFirestore } from '../lib/fileStorage';

interface VideoPreviewProps {
  url: string;
  fileName?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  controls?: boolean;
  autoPlay?: boolean;
  showPlayOverlay?: boolean;
}

// In-memory cache for generated thumbnail data URLs
const thumbnailCache = new Map<string, string>();
const durationCache = new Map<string, number>();

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  url,
  fileName,
  className = '',
  onClick,
  controls = false,
  autoPlay = false,
  showPlayOverlay = true
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() => thumbnailCache.get(url) || null);
  const [duration, setDuration] = useState<number | null>(() => durationCache.get(url) || null);
  const [isLoading, setIsLoading] = useState(!thumbnailCache.has(url));
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 1. Resolve storage URL if needed
  useEffect(() => {
    let isMounted = true;

    const resolve = async () => {
      if (!url) {
        setHasError(true);
        setIsLoading(false);
        return;
      }

      let fileId: string | null = null;
      if (url.startsWith('firestore://')) {
        fileId = url.replace('firestore://', '');
      } else if (!url.includes('/') && !url.startsWith('data:') && !url.startsWith('http')) {
        fileId = url;
      }

      if (!fileId) {
        if (isMounted) setResolvedUrl(url);
        return;
      }

      try {
        const fileData = await getFileFromFirestore(fileId);
        if (isMounted) {
          if (fileData) setResolvedUrl(fileData.url);
          else setHasError(true);
        }
      } catch {
        if (isMounted) setHasError(true);
      }
    };

    resolve();
    return () => { isMounted = false; };
  }, [url]);

  // 2. Generate crisp frame thumbnail using hidden video & canvas
  useEffect(() => {
    if (!resolvedUrl || thumbnailUrl) {
      if (thumbnailUrl) setIsLoading(false);
      return;
    }

    let isMounted = true;
    const tempVideo = document.createElement('video');
    tempVideo.crossOrigin = 'anonymous';
    tempVideo.preload = 'auto';
    tempVideo.muted = true;
    tempVideo.playsInline = true;

    const src = resolvedUrl.startsWith('data:') || resolvedUrl.includes('#') 
      ? resolvedUrl 
      : `${resolvedUrl}#t=0.001`;
    tempVideo.src = src;

    const captureFrame = () => {
      try {
        if (!isMounted) return;
        const w = tempVideo.videoWidth || 320;
        const h = tempVideo.videoHeight || 240;

        if (tempVideo.duration && !isNaN(tempVideo.duration)) {
          setDuration(tempVideo.duration);
          durationCache.set(url, tempVideo.duration);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.min(w, 640);
        canvas.height = Math.min(h, Math.round(canvas.width * (h / w)));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          thumbnailCache.set(url, dataUrl);
          if (isMounted) {
            setThumbnailUrl(dataUrl);
            setIsLoading(false);
          }
        }
      } catch (e) {
        // Cross-origin canvas security or codec error -> fallback to direct video element
        if (isMounted) setIsLoading(false);
      }
    };

    tempVideo.addEventListener('loadeddata', () => {
      // Seek slightly past 0 to ensure decoded frame
      tempVideo.currentTime = 0.05;
    });

    tempVideo.addEventListener('seeked', captureFrame);

    tempVideo.addEventListener('error', () => {
      if (isMounted) setIsLoading(false);
    });

    // Timeout fallback after 2.5s if frame capture hasn't completed
    const timer = setTimeout(() => {
      if (isMounted && !thumbnailUrl) {
        setIsLoading(false);
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      tempVideo.pause();
      tempVideo.src = '';
      tempVideo.load();
    };
  }, [resolvedUrl, thumbnailUrl, url]);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  if (hasError) {
    return (
      <div className={`flex items-center justify-center bg-slate-800 text-slate-400 rounded-xl p-4 text-xs ${className}`}>
        <span>Видео недоступно</span>
      </div>
    );
  }

  // If user requested active video playback with controls
  if (controls || autoPlay) {
    return (
      <video
        ref={videoRef}
        src={resolvedUrl || undefined}
        className={className}
        controls={controls}
        autoPlay={autoPlay}
        playsInline
        preload="metadata"
        onClick={onClick}
      />
    );
  }

  return (
    <div 
      className={`relative overflow-hidden rounded-xl bg-slate-900 group/video select-none ${className}`}
      onClick={onClick}
    >
      {thumbnailUrl ? (
        <img 
          src={thumbnailUrl} 
          alt={fileName || 'Видео'} 
          className="w-full h-full object-cover transition-transform duration-300 group-hover/video:scale-105" 
        />
      ) : resolvedUrl ? (
        <video
          src={resolvedUrl.startsWith('data:') || resolvedUrl.includes('#') ? resolvedUrl : `${resolvedUrl}#t=0.001`}
          preload="metadata"
          playsInline
          muted
          className="w-full h-full object-cover transition-transform duration-300 group-hover/video:scale-105 pointer-events-none"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Play Overlay */}
      {showPlayOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover/video:bg-black/35 transition-colors">
          <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg transition-transform group-hover/video:scale-110">
            <Play size={20} className="fill-white translate-x-0.5" />
          </div>
        </div>
      )}

      {/* Duration badge if known */}
      {duration !== null && duration > 0 && (
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-bold text-white tracking-wide">
          {formatDuration(duration)}
        </div>
      )}
    </div>
  );
};

export default VideoPreview;

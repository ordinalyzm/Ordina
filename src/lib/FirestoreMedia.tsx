import React, { useState, useEffect } from 'react';
import { getFileFromFirestore } from './fileStorage';
import { VideoPreview } from '../components/VideoPreview';

interface FirestoreMediaProps {
  url: string;
  type: 'image' | 'video' | 'file';
  fileName?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  controls?: boolean;
  autoPlay?: boolean;
}

export const FirestoreMedia: React.FC<FirestoreMediaProps> = (props) => {
  const { url, type, fileName, className, onClick } = props;
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  if (type === 'video') {
    return (
      <VideoPreview
        url={url}
        fileName={fileName}
        className={className}
        onClick={onClick}
        controls={props.controls}
        autoPlay={props.autoPlay}
      />
    );
  }

  useEffect(() => {
    let isMounted = true;
    
    const loadMedia = async () => {
      if (!url) {
        if (isMounted) {
          setError('URL не указан');
          setIsLoading(false);
        }
        return;
      }

      let fileId: string | null = null;
      if (url.startsWith('firestore://')) {
        fileId = url.replace('firestore://', '');
      } else if (!url.includes('/') && !url.startsWith('data:') && !url.startsWith('http')) {
        // It's likely a legacy firestore ID
        fileId = url;
      }
      
      if (!fileId) {
        setResolvedUrl(url);
        setIsLoading(false);
        return;
      }
      
      try {
        const fileData = await getFileFromFirestore(fileId);
        if (isMounted) {
          if (fileData) {
            setResolvedUrl(fileData.url);
          } else {
            setError('Файл не найден');
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError('Ошибка загрузки');
          setIsLoading(false);
        }
      }
    };
    
    loadMedia();
    
    return () => {
      isMounted = false;
    };
  }, [url]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 rounded-xl ${className || ''}`} style={{ minHeight: '100px' }}>
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !resolvedUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 text-slate-500 rounded-xl p-3 text-xs ${className || ''}`} style={{ minHeight: '80px' }}>
        <span className="font-medium text-[11px] truncate max-w-[160px]">{fileName || 'Медиафайл'}</span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setIsLoading(true);
            setError(null);
            setResolvedUrl(url);
          }}
          className="mt-1 text-[10px] text-blue-600 hover:underline font-semibold"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <img 
        src={resolvedUrl} 
        alt={fileName || 'Image'} 
        className={className} 
        onClick={onClick}
        loading="lazy"
        decoding="async"
        onError={() => {
          if (resolvedUrl !== url) {
            setResolvedUrl(url);
          } else {
            setError('Не удалось отобразить');
          }
        }}
      />
    );
  }

  return null;
};

const CHUNK_SIZE = 500 * 1024; // 500KB per chunk

export async function uploadFileToFirestore(file: File, uploaderId: string, onProgress?: (progress: number) => void): Promise<string> {
  // High-fidelity image compression (comparable to Telegram/WhatsApp HD)
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') || file.type.includes('svg') || file.type.includes('gif')) {
      const reader = new FileReader();
      reader.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      reader.onload = () => {
        if (onProgress) onProgress(100);
        resolve(reader.result as string);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        // Telegram HD image limit: 2048px on longest side, preserves crisp text & detail
        const max = 2048;
        
        if (width > max || height > max) {
          if (width > height) {
            height = Math.round((height * max) / width);
            width = max;
          } else {
            width = Math.round((width * max) / height);
            height = max;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Enable high quality bicubic interpolation
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // 0.85 quality gives ideal balance: sharp text/details and 80%+ size compression
          let format = 'image/webp';
          let dataUrl = canvas.toDataURL(format, 0.85);
          if (!dataUrl.startsWith('data:image/webp')) {
            format = 'image/jpeg';
            dataUrl = canvas.toDataURL(format, 0.85);
          }

          if (onProgress) onProgress(100);
          resolve(dataUrl);
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function getFileFromFirestore(fileId: string): Promise<{ url: string, fileName: string } | null> {
  if (fileId.startsWith('data:')) {
    return { url: fileId, fileName: 'file' };
  }
  return null;
}

export async function deleteFileFromFirestore(fileId: string) {
  // No-op
}

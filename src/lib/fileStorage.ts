const CHUNK_SIZE = 500 * 1024; // 500KB per chunk

export async function uploadFileToFirestore(file: File, uploaderId: string, onProgress?: (progress: number) => void): Promise<string> {
  // Compress image
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
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
        const max = 512;
        
        if (width > height && width > max) {
          height = Math.round((height * max) / width);
          width = max;
        } else if (height > max) {
          width = Math.round((width * max) / height);
          height = max;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/webp', 0.8);
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

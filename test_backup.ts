import admin from 'firebase-admin';
import zlib from 'zlib';
import fs from 'fs';
import config from './firebase-applet-config.json' assert { type: 'json' };

(async () => {
  admin.initializeApp({
    projectId: config.projectId,
  });
  const db = admin.firestore();
  db.settings({ databaseId: config.firestoreDatabaseId });
  
  // Save DB test
  const dbBuffer = fs.readFileSync('database.sqlite');
  const compressed = zlib.gzipSync(dbBuffer);
  const base64 = compressed.toString('base64');
  console.log('Original size:', dbBuffer.length);
  console.log('Compressed size:', compressed.length);
  const CHUNK_SIZE = 800000;
  
  const batch = db.batch();
  
  // Clear old backup first (optional, but good if chunks reduce)
  const existing = await db.collection('sqlite_backup').get();
  existing.forEach(doc => batch.delete(doc.ref));
  
  let chunkIndex = 0;
  for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
    const chunk = base64.slice(i, i + CHUNK_SIZE);
    batch.set(db.collection('sqlite_backup').doc(`chunk_${chunkIndex}`), { chunk, index: chunkIndex });
    chunkIndex++;
  }
  
  await batch.commit();
  console.log('Saved to Firestore in chunks:', chunkIndex);
  
})();

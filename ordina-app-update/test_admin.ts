import admin from 'firebase-admin';
import config from './firebase-applet-config.json' assert { type: 'json' };

try {
  admin.initializeApp();
  console.log('Firebase Admin initialized with default credentials.');
  const bucket = admin.storage().bucket(config.storageBucket);
  await bucket.getFiles();
  console.log('Successfully accessed bucket:', config.storageBucket);
} catch (error) {
  console.error('Error:', error);
}

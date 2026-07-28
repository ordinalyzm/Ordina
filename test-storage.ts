import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString } from 'firebase/storage';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

async function test() {
  try {
    const storageRef = ref(storage, 'test.txt');
    await uploadString(storageRef, 'Hello World');
    console.log('Upload successful');
    process.exit(0);
  } catch (e) {
    console.error('Upload failed:', e);
    process.exit(1);
  }
}
test();

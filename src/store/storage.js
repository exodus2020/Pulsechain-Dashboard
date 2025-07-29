// Storage.js
const DB_NAME = 'plsdashboard';
const STORE_NAME = 'config';
const DB_VERSION = 1;

// Open or create database
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// Save data
export async function saveFile(key, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(data, key);

    request.onsuccess = () => {
      resolve(true);
      db.close();
    };

    request.onerror = (event) => {
      reject(event.target.error);
      db.close();
    };
  });
}

// Load data
export async function loadFile(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = (event) => {
      resolve(event.target.result ?? null);
      db.close();
    };

    request.onerror = (event) => {
      reject(event.target.error);
      db.close();
    };
  });
}

// Delete data
export async function deleteFile(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onsuccess = () => {
      resolve(true);
      db.close();
    };

    request.onerror = (event) => {
      reject(event.target.error);
      db.close();
    };
  });
}

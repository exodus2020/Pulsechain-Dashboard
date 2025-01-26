import { keccak256 } from "js-sha3";

/**
 * Hashes a string using the SHA-256 algorithm.
 * @param {string} input - The string to hash.
 * @returns {Promise<string>} - The resulting hashed string in hexadecimal format.
 */
export async function hashString(input) {
  const encoder = new TextEncoder(); // Encode the string as UTF-8
  const data = encoder.encode(input); // Convert the string into a Uint8Array
  const hashBuffer = await crypto.subtle.digest('SHA-256', data); // Generate the hash
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert the buffer to an array of bytes
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join(''); // Convert bytes to a hexadecimal string
}

/**
 * Encrypts a string using a hashed key.
 * @param {string} keyString - The key string to be hashed and used as the encryption key.
 * @param {string} plainText - The text to encrypt.
 * @returns {Promise<string>} - The encrypted string in Base64 format.
 */
export async function encryptWithHashedKey(keyString, plainText) {
  // Hash the key string to generate a cryptographic key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString); // Convert key string to bytes
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData); // Hash the key string
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Convert plainText to bytes
  const plainTextBytes = encoder.encode(plainText);

  // Generate a random initialization vector (IV)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the plainText
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plainTextBytes
  );

  // Combine IV and encrypted data into a single buffer
  const combinedBuffer = new Uint8Array(iv.byteLength + encryptedBuffer.byteLength);
  combinedBuffer.set(iv, 0); // First part is the IV
  combinedBuffer.set(new Uint8Array(encryptedBuffer), iv.byteLength); // Second part is the encrypted data

  // Convert to Base64 for easier storage/transfer
  return btoa(String.fromCharCode(...combinedBuffer));
}

/**
 * Decrypts an encrypted string using a hashed key.
 * @param {string} keyString - The key string to be hashed and used as the decryption key.
 * @param {string} encryptedText - The encrypted string in Base64 format.
 * @returns {Promise<string>} - The decrypted plain text.
 */
export async function decryptWithHashedKey(keyString, encryptedText) {
  // Hash the key string to generate a cryptographic key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decode the Base64 string
  const encryptedBuffer = Uint8Array.from(atob(encryptedText), char => char.charCodeAt(0));

  // Extract the IV and encrypted data
  const iv = encryptedBuffer.slice(0, 12); // First 12 bytes are the IV
  const encryptedData = encryptedBuffer.slice(12); // Remaining bytes are the encrypted data

  // Decrypt the data
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encryptedData
  );

  // Decode and return the plain text
  return new TextDecoder().decode(decryptedBuffer);
}

export function toChecksumAddress(address) {
  // Ensure the address is lowercase and remove the 0x prefix
  const lowercaseAddress = address.toLowerCase().replace(/^0x/, "");

  // Hash the lowercase address using Keccak-256
  const hash = keccak256(lowercaseAddress);

  // Apply checksum: capitalize letters based on the hash
  let checksumAddress = "0x";
  for (let i = 0; i < lowercaseAddress.length; i++) {
      if (parseInt(hash[i], 16) >= 8) {
          checksumAddress += lowercaseAddress[i].toUpperCase();
      } else {
          checksumAddress += lowercaseAddress[i];
      }
  }

  return checksumAddress;
}
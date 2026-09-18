// src/utils/meshCrypto.ts

export class MeshCrypto {
  private static keyPair: CryptoKeyPair | null = null;

  /** Инициализация или получение ключевой пары ECDH P-256 */
  static async getOrCreateKeyPair(): Promise<CryptoKeyPair> {
    if (this.keyPair) return this.keyPair;

    this.keyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );
    return this.keyPair;
  }

  /** Экспорт открытого ключа в формат Base64 (SPKI) */
  static async exportPublicKey(): Promise<string> {
    const pair = await this.getOrCreateKeyPair();
    const exported = await window.crypto.subtle.exportKey('spki', pair.publicKey);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  /** Импорт чужого открытого ключа из Base64 */
  static async importPublicKey(base64Key: string): Promise<CryptoKey> {
    const binary = atob(base64Key);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    return window.crypto.subtle.importKey(
      'spki',
      bytes.buffer,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );
  }

  /** Вычисление общего секрета и симметричного ключа AES-GCM */
  private static async deriveSharedKey(theirPublicKey: CryptoKey): Promise<CryptoKey> {
    const pair = await this.getOrCreateKeyPair();
    return window.crypto.subtle.deriveKey(
      { name: 'ECDH', public: theirPublicKey },
      pair.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /** Шифрование текста сообщения с использованием публичного ключа получателя */
  static async encrypt(plainText: string, recipientPubKeyBase64: string): Promise<string> {
    const recipientPubKey = await this.importPublicKey(recipientPubKeyBase64);
    const sharedKey = await this.deriveSharedKey(recipientPubKey);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plainText);

    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sharedKey,
      encoded
    );

    const payload = {
      iv: btoa(String.fromCharCode(...iv)),
      data: btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)))
    };

    return JSON.stringify(payload);
  }

  /** Расшифровка тела сообщения открытым ключом отправителя */
  static async decrypt(encryptedJson: string, senderPubKeyBase64: string): Promise<string> {
    const { iv, data } = JSON.parse(encryptedJson);
    const senderPubKey = await this.importPublicKey(senderPubKeyBase64);
    const sharedKey = await this.deriveSharedKey(senderPubKey);

    const ivBytes = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0)));
    const cipherBytes = new Uint8Array(atob(data).split('').map(c => c.charCodeAt(0)));

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      sharedKey,
      cipherBytes
    );

    return new TextDecoder().decode(decryptedBuffer);
  }
}

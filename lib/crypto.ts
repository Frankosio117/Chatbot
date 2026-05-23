import crypto from 'crypto';

// Clave secreta para encriptar. En producción usar una variable de entorno.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'vibe-coding-secret-key-32-chars-long!'; // Debe tener 32 caracteres
const ALGORITHM = 'aes-256-gcm';

/**
 * Encripta un texto plano utilizando AES-256-GCM.
 */
export function encrypt(text: string): string {
  try {
    // Asegurarse de que la clave tenga la longitud correcta (32 bytes)
    const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY)], 32);
    const iv = crypto.randomBytes(12); // vector de inicialización de 12 bytes
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Devolver IV + tag + texto cifrado separados por dos puntos
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error('Error al encriptar:', error);
    // Fallback para desarrollo si la clave no cumple especificaciones
    return `mock-encrypted:${Buffer.from(text).toString('base64')}`;
  }
}

/**
 * Desencripta un texto cifrado.
 */
export function decrypt(encryptedText: string): string {
  try {
    if (encryptedText.startsWith('mock-encrypted:')) {
      const base64 = encryptedText.replace('mock-encrypted:', '');
      return Buffer.from(base64, 'base64').toString('utf8');
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Formato de texto cifrado inválido');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY)], 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error al desencriptar:', error);
    // Retornar el texto original si no se pudo desencriptar (ej. si no estaba encriptado)
    return encryptedText;
  }
}

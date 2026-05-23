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
    console.warn('Error al desencriptar con clave principal:', error instanceof Error ? error.message : error);
    
    // Fallback: Intentar desencriptar con la clave por defecto
    const DEFAULT_FALLBACK_KEY = 'vibe-coding-secret-key-32-chars-long!';
    try {
      const parts = encryptedText.split(':');
      if (parts.length === 3) {
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        
        const key = Buffer.concat([Buffer.from(DEFAULT_FALLBACK_KEY)], 32);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        console.log('Desencriptado exitoso usando la clave de fallback por defecto.');
        return decrypted;
      }
    } catch (fallbackError) {
      console.error('Error al desencriptar con clave de fallback:', fallbackError);
    }
    
    // Retornar el texto original si no se pudo desencriptar (ej. si no estaba encriptado)
    return encryptedText;
  }
}

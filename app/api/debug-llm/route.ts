import { NextRequest, NextResponse } from 'next/server';
import { getGlobalLLMConfig } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  try {
    const llmConfig = await getGlobalLLMConfig();
    const rawEncrypted = llmConfig.api_key_encriptada;
    
    // Check local process env keys
    const envEncryptionKey = process.env.ENCRYPTION_KEY ? 'DEFINED' : 'UNDEFINED';
    
    let decryptedKey = '';
    let decryptError = '';
    try {
      decryptedKey = decrypt(rawEncrypted);
    } catch (err: any) {
      decryptError = err.message;
    }

    const isCiphertextReturned = decryptedKey === rawEncrypted;
    
    const keyInfo = decryptedKey ? {
      length: decryptedKey.length,
      startsWithAIza: decryptedKey.startsWith('AIza'),
      preview: decryptedKey.length > 8 ? `${decryptedKey.substring(0, 4)}...${decryptedKey.substring(decryptedKey.length - 4)}` : 'too short',
    } : null;

    // Test calling the Google API directly using fetch with the decrypted key
    let googleApiTestStatus = 'N/A';
    let googleApiTestResult = '';
    if (decryptedKey && !isCiphertextReturned) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${decryptedKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Respond with OK' }] }]
          })
        });
        googleApiTestStatus = response.status.toString();
        const json = await response.json();
        googleApiTestResult = JSON.stringify(json);
      } catch (err: any) {
        googleApiTestResult = `Error: ${err.message}`;
      }
    }

    return NextResponse.json({
      success: true,
      env: {
        ENCRYPTION_KEY_STATUS: envEncryptionKey,
        DEFAULT_LLM_PROVIDER: process.env.DEFAULT_LLM_PROVIDER || 'not set',
        DEFAULT_LLM_MODEL: process.env.DEFAULT_LLM_MODEL || 'not set',
      },
      dbConfig: {
        proveedor: llmConfig.proveedor,
        modelo_nombre: llmConfig.modelo_nombre,
        activo: llmConfig.activo,
        encrypted_key_length: rawEncrypted?.length,
      },
      decrypt: {
        success: !decryptError && !isCiphertextReturned,
        error: decryptError,
        isCiphertextReturned,
        keyInfo,
      },
      googleApiTest: {
        status: googleApiTestStatus,
        result: googleApiTestResult,
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

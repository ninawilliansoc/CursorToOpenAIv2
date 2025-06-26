const os = require('os');
const zlib = require('zlib');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const $root = require('../proto/message.js');

function generateCursorBody(messages, modelName) {

  const instruction = messages
    .filter(msg => msg.role === 'system')
    .map(msg => msg.content)
    .join('\n')

  const formattedMessages = messages
    .filter(msg => msg.role !== 'system')
    .map(msg => ({
      content: msg.content,
      role: msg.role === 'user' ? 1 : 2,
      messageId: uuidv4(),
      ...(msg.role === 'user' ? { chatModeEnum: 1 } : {})
      //...(msg.role !== 'user' ? { summaryId: uuidv4() } : {})
    }));

  const messageIds = formattedMessages.map(msg => {
    const { role, messageId, summaryId } = msg;
    return summaryId ? { role, messageId, summaryId } : { role, messageId };
  });

  const body = {
    request:{
      messages: formattedMessages,
      unknown2: 1,
      instruction: {
        instruction: instruction
      },
      unknown4: 1,
      model: {
        name: modelName,
        empty: '',
      },
      webTool: "",
      unknown13: 1,
      cursorSetting: {
        name: "cursor\\aisettings",
        unknown3: "",
        unknown6: {
          unknwon1: "",
          unknown2: ""
        },
        unknown8: 1,
        unknown9: 1
      },
      unknown19: 1,
      //unknown22: 1,
      conversationId: uuidv4(),
      metadata: {
        os: "win32",
        arch: "x64",
        version: "10.0.22631",
        path: "C:\\Program Files\\PowerShell\\7\\pwsh.exe",
        timestamp: new Date().toISOString(),
      },
      unknown27: 0,
      //unknown29: "",
      messageIds: messageIds,
      largeContext: 0,
      unknown38: 0,
      chatModeEnum: 1,
      unknown47: "",
      unknown48: 0,
      unknown49: 0,
      unknown51: 0,
      unknown53: 1,
      chatMode: "Ask"
    }
  };

  const errMsg = $root.StreamUnifiedChatWithToolsRequest.verify(body);
  if (errMsg) throw Error(errMsg);
  const instance = $root.StreamUnifiedChatWithToolsRequest.create(body);
  let buffer = $root.StreamUnifiedChatWithToolsRequest.encode(instance).finish();
  let magicNumber = 0x00
  if (formattedMessages.length >= 3){
    buffer = zlib.gzipSync(buffer)
    magicNumber = 0x01
  }

  const finalBody = Buffer.concat([
    Buffer.from([magicNumber]),
    Buffer.from(buffer.length.toString(16).padStart(8, '0'), 'hex'),
    buffer
  ])

  return finalBody
}

function chunkToUtf8String(chunk) {
  const thinkingOutput = []
  const textOutput = []
  const buffer = Buffer.from(chunk, 'hex');
  //console.log("Chunk buffer:", buffer.toString('hex'))

  try {
    for(let i = 0; i < buffer.length; i++){
      const magicNumber = parseInt(buffer.subarray(i, i + 1).toString('hex'), 16)
      const dataLength = parseInt(buffer.subarray(i + 1, i + 5).toString('hex'), 16)
      const data = buffer.subarray(i + 5, i + 5 + dataLength)
      //console.log("Parsed buffer:", magicNumber, dataLength, data.toString('hex'))

      if (magicNumber == 0 || magicNumber == 1) {
        const gunzipData = magicNumber == 0 ? data : zlib.gunzipSync(data)
        const response = $root.StreamUnifiedChatWithToolsResponse.decode(gunzipData);

        const thinking = response?.message?.thinking?.content
        if (thinking !== undefined){
          thinkingOutput.push(thinking)
          //console.log(thinking)
        }

        const content = response?.message?.content
        if (content !== undefined){
          textOutput.push(content)
          //console.log(content)
        }
        
      }
      else if (magicNumber == 2 || magicNumber == 3) { 
        // Json message
        const gunzipData = magicNumber == 2 ? data : zlib.gunzipSync(data)
        const utf8 = gunzipData.toString('utf-8')
        const message = JSON.parse(utf8)

        if (message != null && (typeof message !== 'object' || 
          (Array.isArray(message) ? message.length > 0 : Object.keys(message).length > 0))){
            //results.push(utf8)
            console.error(utf8)
        }

      }
      else {
        //console.log('Unknown magic number when parsing chunk response: ' + magicNumber)
      }

      i += 5 + dataLength - 1
    }
  } catch (err) {
    console.log('Error parsing chunk response:', err)
  }

  return {
    thinking: thinkingOutput.join(''), 
    text: textOutput.join('') 
  }
}

function generateHashed64Hex(input, salt = '') {
  const hash = crypto.createHash('sha256');
  hash.update(input + salt);
  return hash.digest('hex');
}

function obfuscateBytes(byteArray) {
  let t = 165;
  for (let r = 0; r < byteArray.length; r++) {
    byteArray[r] = (byteArray[r] ^ t) + (r % 256);
    t = byteArray[r];
  }
  return byteArray;
}

function generateCursorChecksum(token) {
  const machineId = generateHashed64Hex(token, 'machineId');
  const macMachineId = generateHashed64Hex(token, 'macMachineId');

  const timestamp = Math.floor(Date.now() / 1e6);
  const byteArray = new Uint8Array([
    (timestamp >> 40) & 255,
    (timestamp >> 32) & 255,
    (timestamp >> 24) & 255,
    (timestamp >> 16) & 255,
    (timestamp >> 8) & 255,
    255 & timestamp,
  ]);

  const obfuscatedBytes = obfuscateBytes(byteArray);
  const encodedChecksum = Buffer.from(obfuscatedBytes).toString('base64');

  return `${encodedChecksum}${machineId}/${macMachineId}`;
}

/**
 * Obtiene el token de autenticación desde la configuración o headers
 * Prioriza API keys autenticadas, luego AUTH_COOKIE de variables de entorno, luego el header Authorization
 * @param {Object} req - Objeto request de Express
 * @param {Object} config - Configuración de la aplicación
 * @returns {string|null} Token de autenticación
 */
function getAuthToken(req, config) {
    // Si hay una API key autenticada, usar el AUTH_COOKIE configurado (esto significa que la API key es válida)
    if (req.isAPIKeyAuth && config.authCookie) {
        console.log('[AUTH] Usando AUTH_COOKIE para API key autenticada:', req.apiKey.name);
        return config.authCookie;
    }
    
    // Priorizar AUTH_COOKIE de variables de entorno (comportamiento original)
    if (config.authCookie) {
        console.log('[AUTH] Usando AUTH_COOKIE de variables de entorno');
        return config.authCookie;
    }
    
    // Fallback al header Authorization (si no es una API key válida)
    if (!req.isAPIKeyAuth) {
        const bearerToken = req.headers.authorization?.replace('Bearer ', '');
        if (bearerToken && !bearerToken.startsWith('sk-')) {
            console.log('[AUTH] Usando token del header Authorization');
            return bearerToken;
        }
    }
    
    console.log('[AUTH] No se encontró token de autenticación válido');
    return null;
}

/**
 * Procesa el token de autenticación para extraer la parte relevante
 * @param {string} authToken - Token de autenticación crudo
 * @returns {string} Token procesado
 */
function processAuthToken(authToken) {
    if (!authToken) return null;
    
    // Si es un token compuesto, extraer el primer token
    const keys = authToken.split(',').map((key) => key.trim());
    let processedToken = keys[Math.floor(Math.random() * keys.length)];
    
    // Procesar formato de token
    if (processedToken && processedToken.includes('%3A%3A')) {
        processedToken = processedToken.split('%3A%3A')[1];
    } else if (processedToken && processedToken.includes('::')) {
        processedToken = processedToken.split('::')[1];
    }
    
    return processedToken?.trim();
}

module.exports = {
  generateCursorBody,
  chunkToUtf8String,
  generateHashed64Hex,
  generateCursorChecksum,
  getAuthToken,
  processAuthToken
};

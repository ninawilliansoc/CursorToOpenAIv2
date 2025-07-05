const express = require('express');
const router = express.Router();
const { fetch, ProxyAgent, Agent } = require('undici');

const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const config = require('../config/config');
const $root = require('../proto/message.js');
const { generateCursorBody, chunkToUtf8String, generateHashed64Hex, generateCursorChecksum, getAuthToken, processAuthToken, handleRateLimitedResponse, testRateLimitedCookie } = require('../utils/utils.js');
const authCookieDB = require('../config/auth_cookies');
const { verifyAPIKey, retryOnError } = require('../middleware/auth');

// Ya no aplicamos el middleware globalmente, lo aplicaremos a cada ruta individualmente

// Ruta para obtener modelos disponibles - No cuenta como uso para el rate limit
router.get("/models", verifyAPIKey({ recordUsage: false }), async (req, res) => {
  try{
    const rawAuthToken = getAuthToken(req, config);
    if (!rawAuthToken) {
      return res.status(401).json({
        error: 'No se proporcionó token de autenticación. Configure AUTH_COOKIE en variables de entorno o envíe el token en el header Authorization.',
      });
    }
    
    const authToken = processAuthToken(rawAuthToken);

    const cursorChecksum = req.headers['x-cursor-checksum'] 
      ?? generateCursorChecksum(authToken.trim());
    const cursorClientVersion = "0.48.7"

    // Usar retryOnError para reintentar la solicitud hasta 20 veces en caso de error
    const availableModelsResponse = await retryOnError(async (currentToken) => {
      // Si se proporciona un nuevo token por rotación, usarlo
      const tokenToUse = currentToken || rawAuthToken;
      const processedToken = processAuthToken(tokenToUse);
      
      return await fetch("https://api2.cursor.sh/aiserver.v1.AiService/AvailableModels", {
      method: 'POST',
      headers: {
        'accept-encoding': 'gzip',
        'authorization': `Bearer ${processedToken}`,
        'connect-protocol-version': '1',
        'content-type': 'application/proto',
        'user-agent': 'connect-es/1.6.1',
        'x-cursor-checksum': cursorChecksum,
        'x-cursor-client-version': cursorClientVersion,
        'x-cursor-config-version': uuidv4(),
        'x-cursor-timezone': 'Asia/Shanghai',
        'x-ghost-mode': 'true',
        'Host': 'api2.cursor.sh',
      },
    })
    }, 20, rawAuthToken); // Máximo 20 reintentos, pasando el token raw para rotación
    const data = await availableModelsResponse.arrayBuffer();
    const buffer = Buffer.from(data);
    try{
      const models = $root.AvailableModelsResponse.decode(buffer).models;

      return res.json({
        object: "list",
        data: models.map(model => ({
          id: model.name,
          created: Date.now(),
          object: 'model',
          owned_by: 'cursor'
        }))
      })
    } catch (error) {
      const text = buffer.toString('utf-8');
      throw new Error(text);      
    }
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
})

// Ruta para chat completions - Sí cuenta como uso para el rate limit
router.post('/chat/completions', verifyAPIKey({ recordUsage: true }), async (req, res) => {

  try {
    const { model, messages, stream = false } = req.body;
    const rawAuthToken = getAuthToken(req, config);
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Petición inválida. Los mensajes deben ser un array no vacío.',
      });
    }

    if (!rawAuthToken) {
      return res.status(401).json({
        error: 'No se proporcionó token de autenticación. Configure AUTH_COOKIE en variables de entorno o envíe el token en el header Authorization.',
      });
    }

    const authToken = processAuthToken(rawAuthToken);

    const cursorChecksum = req.headers['x-cursor-checksum']
      ?? generateCursorChecksum(authToken.trim());

    const sessionid = uuidv5(authToken,  uuidv5.DNS);
    const clientKey = generateHashed64Hex(authToken)
    const cursorClientVersion = "0.48.7"
    const cursorConfigVersion = uuidv4();

    // Request the AvailableModels before StreamChat.
    const availableModelsResponse = retryOnError(async (currentToken) => {
      // Si se proporciona un nuevo token por rotación, usarlo
      const tokenToUse = currentToken || rawAuthToken;
      const processedToken = processAuthToken(tokenToUse);
      
      return await fetch("https://api2.cursor.sh/aiserver.v1.AiService/AvailableModels", {
      method: 'POST',
      headers: {
        'accept-encoding': 'gzip',
        'authorization': `Bearer ${processedToken}`,
        'connect-protocol-version': '1',
        'content-type': 'application/proto',
        'user-agent': 'connect-es/1.6.1',
        'x-amzn-trace-id': `Root=${uuidv4()}`,
        'x-client-key': clientKey,
        'x-cursor-checksum': cursorChecksum,
        'x-cursor-client-version': cursorClientVersion,
        'x-cursor-config-version': cursorConfigVersion,
        'x-cursor-timezone': 'Asia/Shanghai',
        'x-ghost-mode': 'true',
        "x-request-id": uuidv4(),
        "x-session-id": sessionid,
        'Host': 'api2.cursor.sh',
      },
    })
    }, 20, rawAuthToken); // Máximo 20 reintentos, pasando el token raw para rotación
    
    const cursorBody = generateCursorBody(messages, model);
    const dispatcher = config.proxy.enabled
      ? new ProxyAgent(config.proxy.url, { allowH2: true })
      : new Agent({ allowH2: true });
    
    // Usar retryOnError para reintentar la solicitud hasta 20 veces en caso de error
    const response = await retryOnError(async (currentToken) => {
      // Si se proporciona un nuevo token por rotación, usarlo
      const tokenToUse = currentToken || rawAuthToken;
      const processedToken = processAuthToken(tokenToUse);
      
      return await fetch('https://api2.cursor.sh/aiserver.v1.ChatService/StreamUnifiedChatWithTools', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${processedToken}`,
        'connect-accept-encoding': 'gzip',
        'connect-content-encoding': 'gzip',
        'connect-protocol-version': '1',
        'content-type': 'application/connect+proto',
        'user-agent': 'connect-es/1.6.1',
        'x-amzn-trace-id': `Root=${uuidv4()}`,
        'x-client-key': clientKey,
        'x-cursor-checksum': cursorChecksum,
        'x-cursor-client-version': cursorClientVersion,
        'x-cursor-config-version': cursorConfigVersion,
        'x-cursor-timezone': 'Asia/Shanghai',
        'x-ghost-mode': 'true',
        'x-request-id': uuidv4(),
        'x-session-id': sessionid,
        'Host': 'api2.cursor.sh'
      },
      body: cursorBody,
      dispatcher: dispatcher,
      timeout: {
        connect: 5000,
        read: 30000
      }
    });
    }, 20, rawAuthToken); // Máximo 20 reintentos, pasando el token raw para rotación

    if (response.status !== 200) {
      return res.status(response.status).json({ 
        error: response.statusText 
      });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const responseId = `chatcmpl-${uuidv4()}`;

      try {
        let thinkingStart = "<thinking>";
        let thinkingEnd = "</thinking>";
        let isRateLimited = false;
        let firstChunk = true;
        
        for await (const chunk of response.body) {
          const chunkResult = chunkToUtf8String(chunk);
          const { thinking, text, isRateLimited: chunkIsRateLimited } = chunkResult;
          let content = "";

          // Detectar rate limit en cualquier chunk, no solo el primero
          if (chunkIsRateLimited) {
            isRateLimited = true;
            console.log('[RATE_LIMIT] Detectado mensaje de rate limit en streaming response');
            
            // Manejar la rotación de cookies
            const { shouldRetry, newToken } = handleRateLimitedResponse(rawAuthToken, true);
            
            if (shouldRetry) {
              // Cerrar la respuesta actual
              res.write(`data: ${JSON.stringify({
                id: responseId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                  index: 0,
                  delta: {
                    content: "Rotando a otra cookie debido a rate limit...",
                  },
                }],
              })}\n\n`);
              
              // Reintentar con la siguiente cookie
              // Nota: Esto es recursivo y podría causar problemas si todas las cookies están rate-limited
              // Pero es la forma más sencilla de implementar la rotación en streaming
              return router.handle(req, res);
            }
          }
          
          firstChunk = false;

          if (thinkingStart !== "" && thinking.length > 0 ){
            content += thinkingStart + "\n";
            thinkingStart = "";
          }
          content += thinking;
          if (thinkingEnd !== "" && thinking.length === 0 && text.length !== 0 && thinkingStart === "") {
            content += "\n" + thinkingEnd + "\n";
            thinkingEnd = "";
          }

          content += text;

          if (content.length > 0) {
            res.write(
              `data: ${JSON.stringify({
                id: responseId,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                  index: 0,
                  delta: {
                    content: content,
                  },
                }],
              })}\n\n`
            );
          }
        }
        
        // Verificar si hay cookies rate-limited que necesiten ser probadas
        setTimeout(async () => {
          const cookiesForTesting = authCookieDB.getCookiesForTesting();
          if (cookiesForTesting.length > 0) {
            console.log(`[AUTH] Encontradas ${cookiesForTesting.length} cookies para probar`);
            for (const cookie of cookiesForTesting) {
              await testRateLimitedCookie(cookie.id);
            }
          }
        }, 100); // Ejecutar después de que la respuesta haya sido enviada
      } catch (streamError) {
        console.error('Stream error:', streamError);
        if (streamError.name === 'TimeoutError') {
          res.write(`data: ${JSON.stringify({ error: 'Server response timeout' })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ error: 'Stream processing error' })}\n\n`);
        }
      } finally {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } else {
      // Non-streaming response
      try {
        let thinkingStart = "<thinking>";
        let thinkingEnd = "</thinking>";
        let content = '';
        let isRateLimited = false;
        let firstChunk = true;
        
        for await (const chunk of response.body) {
          const chunkResult = chunkToUtf8String(chunk);
          const { thinking, text, isRateLimited: chunkIsRateLimited } = chunkResult;
          
          // Detectar rate limit en cualquier chunk, no solo el primero
          if (chunkIsRateLimited) {
            isRateLimited = true;
            console.log('[RATE_LIMIT] Detectado mensaje de rate limit en non-streaming response');
            
            // Manejar la rotación de cookies
            const { shouldRetry, newToken } = handleRateLimitedResponse(rawAuthToken, true);
            
            if (shouldRetry) {
              // Reintentar con la siguiente cookie
              return router.handle(req, res);
            }
          }
          
          firstChunk = false;
          
          if (thinkingStart !== "" && thinking.length > 0 ){
            content += thinkingStart + "\n";
            thinkingStart = "";
          }
          content += thinking;
          if (thinkingEnd !== "" && thinking.length === 0 && text.length !== 0 && thinkingStart === "") {
            content += "\n" + thinkingEnd + "\n";
            thinkingEnd = "";
          }

          content += text;
        }
        
        // Verificar si hay cookies rate-limited que necesiten ser probadas
        setTimeout(async () => {
          const cookiesForTesting = authCookieDB.getCookiesForTesting();
          if (cookiesForTesting.length > 0) {
            console.log(`[AUTH] Encontradas ${cookiesForTesting.length} cookies para probar`);
            for (const cookie of cookiesForTesting) {
              await testRateLimitedCookie(cookie.id);
            }
          }
        }, 100); // Ejecutar después de que la respuesta haya sido enviada

        return res.json({
          id: `chatcmpl-${uuidv4()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: content,
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
          },
        });
      } catch (error) {
        console.error('Non-stream error:', error);
        if (error.name === 'TimeoutError') {
          return res.status(408).json({ error: 'Server response timeout' });
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('Error:', error);
    if (!res.headersSent) {
      const errorMessage = {
        error: error.name === 'TimeoutError' ? 'Request timeout' : 'Internal server error'
      };

      if (req.body.stream) {
        res.write(`data: ${JSON.stringify(errorMessage)}\n\n`);
        return res.end();
      } else {
        return res.status(error.name === 'TimeoutError' ? 408 : 500).json(errorMessage);
      }
    }
  }
});

module.exports = router;

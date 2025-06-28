const express = require('express');
const router = express.Router();

const { v4: uuidv4 } = require('uuid');
const { generatePkcePair, queryAuthPoll } = require('../tool/cursorLogin.js');
const config = require('../config/config');
const { getAuthToken, processAuthToken } = require('../utils/utils.js');
const { retryOnError } = require('../middleware/auth');

// Ruta para login - No cuenta como uso para el rate limit
router.get("/loginDeepControl", verifyAPIKey({ recordUsage: false }), async (req, res) => {
  const rawAuthToken = getAuthToken(req, config);
  if (!rawAuthToken) {
    return res.status(401).json({
      error: 'No se proporcionó token de autenticación. Configure AUTH_COOKIE en variables de entorno o envíe el token en el header Authorization.',
    });
  }
  
  const bearerToken = processAuthToken(rawAuthToken);
  const { verifier, challenge } = generatePkcePair();
  const uuid = uuidv4();
  const resposne = await retryOnError(async (currentToken) => {
    // Si se proporciona un nuevo token por rotación, usarlo
    const tokenToUse = currentToken || rawAuthToken;
    const processedToken = processAuthToken(tokenToUse);
    
    return await fetch("https://www.cursor.com/api/auth/loginDeepCallbackControl", {
    method: 'POST',
    headers: {
      "Accept": "*/*",
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.6834.210 Safari/537.36',
      'Cookie': `WorkosCursorSessionToken=${processedToken}`
    },
    body: JSON.stringify({
      "uuid": uuid,
      "challenge": challenge
    })
  })
  }, 20, rawAuthToken); // Máximo 20 reintentos, pasando el token raw para rotación

  const retryAttempts = 20
  for (let i = 0; i < retryAttempts; i++) {
    const data = await queryAuthPoll(uuid, verifier);
    if (data) {
      return res.json(data)
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return res.status(500).json({
    error: 'Get cookie timeout, please try again.',
  });
})

module.exports = router;

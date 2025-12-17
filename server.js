/**
 * server.js - Servidor Express para Railway
 * API para generar postales navideñas con Pollinations
 */

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Template del prompt
const PROMPT_TEMPLATE = `High-quality Christmas greeting postcard, subtle paper grain and printed ink texture, clean cream border frame around the artwork. Cozy winter illustration in elegant watercolor + gouache style, cinematic soft lighting, rich but tasteful color palette (deep greens, warm ambers, muted reds). A beautiful Christmas tree on the left side with gentle bokeh lights and ornaments.
On the right side, include a clear, visually readable depiction of: {WISH}, as if it were the Christmas gift or wish made real (integrated naturally into the scene, not floating abstractly). Keep it tasteful, elegant, and coherent with the watercolor + gouache style. Make sure the right side stays uncluttered enough so the gift/wish is instantly recognizable.
Add exactly this text, perfectly legible, centered in the right area (over a clean, unobtrusive background), with elegant classic postcard serif typography: "Merry christmas, {NAME}"
Add a second, smaller line of text in the bottom-left corner, inside the cream border area (not over the artwork). It must be perfectly legible, in a tasteful classic postcard serif (or neat handwritten-style) typography, dark ink, aligned left, with generous margin. Use exactly this text: "{MESSAGE}". No other additional text. If the signature is long, reduce font size slightly and keep it to a single line (no wrapping). No logos. No signatures. No watermark.`;

/**
 * Limpia y valida el texto del usuario
 */
function cleanUserText(text, maxLen) {
  if (!text) return '';
  let cleaned = text.replace(/[\r\n\t]/g, ' ').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  if (cleaned.length > maxLen) {
    cleaned = cleaned.substring(0, maxLen).trim();
  }
  return cleaned;
}

/**
 * Escapa las comillas para el prompt
 */
function escapeQuotes(text) {
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Construye el prompt completo
 */
function buildPrompt(name, wish, message) {
  const cleanName = escapeQuotes(cleanUserText(name, 60));
  const cleanWish = escapeQuotes(cleanUserText(wish, 220));
  let cleanMessage = escapeQuotes(cleanUserText(message, 140));
  
  if (!cleanName) throw new Error('El nombre no puede estar vacío');
  if (!cleanWish) throw new Error('El deseo no puede estar vacío');
  if (!cleanMessage) cleanMessage = 'With love.';
  
  return PROMPT_TEMPLATE
    .replace('{NAME}', cleanName)
    .replace('{WISH}', cleanWish)
    .replace('{MESSAGE}', cleanMessage);
}

/**
 * Genera la imagen usando Pollinations API
 */
async function generateImage(prompt, apiKey, options = {}) {
  const {
    model = 'nanobanana-pro',
    width = 1536,
    height = 1024,
    seed = null,
    enhance = false,
    nologo = true,
  } = options;

  const encodedPrompt = encodeURIComponent(prompt);
  const params = new URLSearchParams({
    model,
    width: width.toString(),
    height: height.toString(),
  });
  
  if (seed !== null) params.append('seed', seed.toString());
  if (enhance) params.append('enhance', 'true');
  if (nologo) params.append('nologo', 'true');
  
  const fullUrl = `https://enter.pollinations.ai/api/generate/image/${encodedPrompt}?${params.toString()}`;
  
  console.log('[Pollinations] Iniciando generación...');
  console.log('[Pollinations] Seed:', seed);
  console.log('[Pollinations] Resolución:', `${width}x${height}`);
  
  // Railway no tiene límite estricto, pero ponemos uno razonable
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos
  
  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Christmas-Postcard-Creator/1.0',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Sin detalles');
      console.error('[Pollinations] Error:', response.status, errorText.substring(0, 200));
      throw new Error(`Error ${response.status} de Pollinations API`);
    }
    
    const buffer = await response.buffer();
    
    // Verificar que no sea HTML
    const start = buffer.toString('utf-8', 0, 500).toLowerCase();
    if (start.includes('<!doctype html') || start.includes('<html')) {
      throw new Error('La API devolvió HTML. Verifica tu API key.');
    }
    
    console.log('[Pollinations] ✅ Imagen generada:', buffer.length, 'bytes');
    return buffer;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Timeout: La generación tardó más de 60 segundos');
    }
    
    throw error;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Christmas Postcard API',
    timestamp: new Date().toISOString()
  });
});

// Endpoint principal
app.post('/api/generate', async (req, res) => {
  console.log('[API] Nueva solicitud de generación');
  
  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) {
    console.error('[API] ❌ POLLINATIONS_API_KEY no configurada');
    return res.status(500).json({ 
      error: 'Configuración del servidor incompleta' 
    });
  }
  
  try {
    const { name, wish, message, seed, model, width, height, enhance } = req.body;
    
    // Construir el prompt
    const prompt = buildPrompt(name, wish, message || 'With love.');
    
    // Generar la imagen
    const imageBuffer = await generateImage(prompt, apiKey, {
      model: model || 'nanobanana-pro',
      width: width || 1536,
      height: height || 1024,
      seed: seed || null,
      enhance: enhance || false,
      nologo: true,
    });
    
    // Detectar el tipo de imagen
    let contentType = 'image/jpeg';
    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
      contentType = 'image/png';
    } else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49) {
      contentType = 'image/gif';
    } else if (imageBuffer.toString('utf-8', 0, 4) === 'RIFF') {
      contentType = 'image/webp';
    }
    
    console.log('[API] ✅ Enviando imagen al cliente');
    
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Seed': seed ? seed.toString() : 'random',
    });
    
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('[API] ❌ Error:', error.message);
    res.status(500).json({ 
      error: error.message || 'Error al generar la postal' 
    });
  }
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════╗
║  🎄 Christmas Postcard API                 ║
║  🚀 Servidor corriendo en puerto ${PORT}     ║
║  📡 Health check: /health                  ║
║  🎨 Generate: POST /api/generate           ║
╚════════════════════════════════════════════╝
  `);
});

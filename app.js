/**
 * app.js - Cliente para Christmas Postcard Creator
 * Maneja el formulario y la llamada a la API backend
 */

(function () {
  const form = document.getElementById('form');
  const statusEl = document.getElementById('status');
  const imgEl = document.getElementById('img');
  const seedEl = document.getElementById('seed');
  const generateBtn = document.getElementById('generate');

  // URL del backend - Cambiar esta URL después de desplegar en Railway
  // Formato: https://tu-proyecto.up.railway.app
  const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'  // Desarrollo local
    : 'https://christmas-card-creator.up.railway.app';  // 🔴 CAMBIAR ESTO después de desplegar

  let currentSeed = null;

  /**
   * Actualiza el mensaje de estado
   */
  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.style.color = isError 
      ? 'rgba(255, 100, 100, 0.95)' 
      : 'rgba(255, 255, 255, 0.80)';
  }

  /**
   * Genera un seed aleatorio
   */
  function makeRandomSeed() {
    return Math.floor(Math.random() * 2147483647);
  }

  /**
   * Maneja el envío del formulario
   */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const wish = document.getElementById('wish').value.trim();
    const message = document.getElementById('message').value.trim();

    if (!name || !wish) {
      setStatus('❌ Por favor completa el nombre y el deseo', true);
      return;
    }

    // Generar un nuevo seed para cada generación
    currentSeed = makeRandomSeed();

    // Deshabilitar el botón mientras se genera
    generateBtn.disabled = true;
    setStatus('🎨 Generando tu postal navideña... (puede tardar 10-20 segundos)');

    try {
      // Llamar a la API backend
      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name,
          wish: wish,
          message: message || 'With love.',
          seed: currentSeed,
          model: 'nanobanana-pro',
          width: 1536,  // Alta resolución - Railway aguanta!
          height: 1024,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      // Obtener el seed de la respuesta
      const responseSeed = response.headers.get('X-Seed');
      if (responseSeed) {
        currentSeed = parseInt(responseSeed, 10);
      }

      // Convertir la respuesta a blob y crear una URL
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);

      // Mostrar la imagen
      imgEl.src = imageUrl;
      imgEl.alt = `Postal navideña para ${name}`;

      // Mostrar el seed
      seedEl.textContent = `Seed: ${currentSeed}`;

      setStatus('✅ ¡Postal generada con éxito!');

    } catch (error) {
      console.error('Error al generar postal:', error);
      
      if (error.message.includes('Failed to fetch')) {
        setStatus('❌ No se pudo conectar con el servidor. Verifica que el backend esté corriendo.', true);
      } else {
        setStatus(`❌ Error: ${error.message}`, true);
      }
    } finally {
      generateBtn.disabled = false;
    }
  });

  // Limpiar la URL del blob cuando se carga una nueva imagen
  let lastBlobUrl = null;
  imgEl.addEventListener('load', () => {
    if (lastBlobUrl) {
      URL.revokeObjectURL(lastBlobUrl);
    }
    lastBlobUrl = imgEl.src;
  });
})();

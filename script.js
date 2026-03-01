// === script.js (CORREGIDO) ===
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusMsg = document.getElementById("status-msg");

// --- Base de datos de series ilegales ---
const baseDatosIlegal = {
  10: [
    [67250001, 67700000], [69050001, 69500000], [69500001, 69950000],
    [69995001, 70400000], [70400001, 70850000], [70850001, 71300000],
    [76310012, 85139995], [86400001, 86850000], [90900001, 91350000],
    [91800001, 92250000]
  ],
  20: [
    [87280145, 91646549], [96650001, 97100000], [99800001, 100250000],
    [100250001, 100700000], [109250001, 109700000], [110600001, 111050000],
    [111050001, 111500000], [11950001, 112400000], [112400001, 112850000],
    [112850001, 113300000], [114200001, 114650000], [114650001, 115100000],
    [115100001, 115550000], [118700001, 119150000], [119150001, 119600000],
    [120500001, 120950000]
  ],
  50: [
    [77100001, 77550000], [78000001, 78450000], [78900001, 96350000],
    [96350001, 96800000], [96800001, 97250000], [98150001, 98600000],
    [104900001, 105350000], [105350001, 105800000], [106700001, 107150000],
    [107600001, 108050000], [108050001, 108500000], [109400001, 109850000]
  ]
};

let scanning = false;
let worker = null;
let streamRef = null;

// Inicializar el motor OCR (IA)
async function initWorker() {
  if (!worker) {
    statusMsg.innerText = "Iniciando motor OCR...";
    // Usar 'eng' es correcto para números y caracteres latinos básicos
    worker = await Tesseract.createWorker('eng'); 
    await worker.setParameters({
      // Restringir caracteres para mejorar precisión
      tessedit_char_whitelist: '0123456789AB',
      // Modo 'Single Line' (tratar imagen como una sola línea)
      tessedit_pageseg_mode: '7' 
    });
  }
}

// Evento click para iniciar escáner
document.getElementById("scanBtn").onclick = async () => {
  try {
    await initWorker();
    // Solicitar cámara trasera con buena resolución
    streamRef = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment", width: { ideal: 1280 } } 
    });
    video.srcObject = streamRef;
    // Cambiar UIs
    document.getElementById("main-ui").hidden = true;
    document.getElementById("scanner-container").hidden = false;
    scanning = true;
    // Comenzar bucle de procesamiento
    procesarFrame();
  } catch (e) { alert("Error de cámara. Asegúrese de usar HTTPS y dar permisos."); }
};

// --- FUNCIÓN CRÍTICA CORREGIDA ---
// Captura, recorta y procesa la imagen para la IA
async function procesarFrame() {
  if (!scanning) return;
  
  const vW = video.videoWidth;
  const vH = video.videoHeight;
  
  // Evitar procesar si el video no ha cargado
  if (vW === 0 || vH === 0) { 
    requestAnimationFrame(procesarFrame); 
    return; 
  }

  // 1. Configurar lienzo de captura (OCR canvas)
  canvas.width = 800; // Ancho fijo para consistencia
  canvas.height = 160; // Alto fijo para la franja

  // 2. RECORTAR LA IMAGEN (AJUSTADO PARA SERIE SUPERIOR)
  // Basado en tus fotos, la serie está arriba.
  // sx (start x): 10% desde la izquierda
  // sy (start y): 5% desde arriba (ANTES ERA 40%) - ESTA ES LA CORRECCIÓN
  // sw (width): 80% del ancho del video
  // sh (height): 25% del alto del video (captura una franja más alta)
  ctx.drawImage(video, 
    vW * 0.10, vH * 0.05,  // Recortar desde Y=5% (Arriba)
    vW * 0.80, vH * 0.25,  // Tamaño del recorte
    0, 0, // Posición en canvas
    800, 160 // Tamaño en canvas
  );

  // 3. Pre-procesamiento de imagen (Binarización para OCR)
  let imgData = ctx.getImageData(0, 0, 800, 160);
  let d = imgData.data;
  // Binarización simple (convertir a blanco y negro puro)
  for (let i = 0; i < d.length; i += 4) {
    let gray = (d[i] + d[i+1] + d[i+2]) / 3;
    // Si es oscuro (texto), hacerlo negro puro. Si es claro, blanco puro.
    let v = gray < 128 ? 0 : 255; 
    d[i] = d[i+1] = d[i+2] = v;
  }
  ctx.putImageData(imgData, 0, 0);

  try {
    // 4. EJECUTAR RECONOCIMIENTO (IA)
    const { data: { text } } = await worker.recognize(canvas);
    
    // Limpiar texto: Solo números y letras A o B
    const limpio = text.toUpperCase().replace(/[^0-9AB]/g, "");
    
    // Buscar patrón: 8 o 9 dígitos seguidos de A o B
    // Ejemplo real: "314342221A"
    const match = limpio.match(/(\d{8,9})([AB])/);

    if (match) {
      // Si hay coincidencia, verificar ilegalidad
      verificar(match[1] + match[2], parseInt(match[1]), match[2]);
    } else {
      // Si no, reintentar rápido
      setTimeout(procesarFrame, 250); 
    }
  } catch (err) {
    console.error("Error OCR:", err);
    setTimeout(procesarFrame, 500); // Reintentar tras error
  }
}

// Verificar la serie contra la base de datos
function verificar(serieFull, numero, letra) {
  scanning = false; // Detener bucle
  const denom = document.getElementById("denominacion").value;
  
  // Apagar la cámara inmediatamente
  if (streamRef) {
    streamRef.getTracks().forEach(t => t.stop());
  }

  // Lógica de validación
  let esIlegal = false;
  // Solo verificar si la letra es 'B' y existe la denominación en BD
  if (letra === "B" && baseDatosIlegal[denom]) {
    // Comprobar si el número cae en algún rango ilegal
    esIlegal = baseDatosIlegal[denom].some(([min, max]) => numero >= min && numero <= max);
  }

  // Mostrar Modal de resultado
  const modal = document.getElementById("custom-modal");
  document.getElementById("modal-title").innerText = esIlegal ? "⚠️ SERIE NO VÁLIDA" : "✅ SERIE VÁLIDA";
  document.getElementById("modal-title").style.color = esIlegal ? "#ff4444" : "#00ff88";
  document.getElementById("modal-text").innerHTML = `Serie Escaneada: <strong>${serieFull}</strong><br>Billete: Bs. ${denom}`;
  
  modal.hidden = false;
}

// --- FUNCIONALIDAD DE REINICIO AÑADIDA ---
// Esta función recarga la página completamente al cerrar el modal o el escáner
function reiniciarPagina() {
  location.reload(); // Recarga la URL actual (resetea todo)
}

// Asignar evento de reinicio a los botones
const modalCloseBtn = document.getElementById("modal-close");
if (modalCloseBtn) modalCloseBtn.onclick = reiniciarPagina;

const overlayCloseBtn = document.getElementById("closeBtn");
if (overlayCloseBtn) overlayCloseBtn.onclick = reiniciarPagina;
// =============================

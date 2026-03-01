const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusMsg = document.getElementById("status-msg");

const baseDatosIlegal = {
  10: [[67250001, 67700000], [69050001, 69500000], [69500001, 69950000], [69995001, 70400000], [70400001, 70850000], [70850001, 71300000], [76310012, 85139995], [86400001, 86850000], [90900001, 91350000], [91800001, 92250000]],
  20: [[87280145, 91646549], [96650001, 97100000], [99800001, 100250000], [100250001, 100700000], [109250001, 109700000], [110600001, 111050000], [111050001, 111500000], [111950001, 112400000], [112400001, 112850000], [112850001, 113300000], [114200001, 114650000], [114650001, 115100000], [115100001, 115550000], [118700001, 119150000], [119150001, 119600000], [120500001, 120950000]],
  50: [[77100001, 77550000], [78000001, 78450000], [78900001, 96350000], [96350001, 96800000], [96800001, 97250000], [98150001, 98600000], [104900001, 105350000], [105350001, 105800000], [106700001, 107150000], [107600001, 108050000], [108050001, 108500000], [109400001, 109850000]]
};

let scanning = false;
let worker = null;
let streamRef = null;
let isProcessing = false; // Nueva bandera para evitar saturación

// Inicialización única del Worker
async function initWorker() {
  if (!worker) {
    statusMsg.innerText = "Cargando IA...";
    worker = await Tesseract.createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789AB',
      tessedit_pageseg_mode: '7', // Tratar como una sola línea
    });
    statusMsg.innerText = "IA Lista";
  }
}

document.getElementById("scanBtn").onclick = async () => {
  try {
    await initWorker();
    streamRef = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment", width: { ideal: 1280 } } 
    });
    video.srcObject = streamRef;
    document.getElementById("main-ui").hidden = true;
    document.getElementById("scanner-container").hidden = false;
    scanning = true;
    procesarFrame();
  } catch (e) { alert("Error al acceder a la cámara."); }
};

async function procesarFrame() {
  if (!scanning || isProcessing) return;
  
  const vW = video.videoWidth;
  const vH = video.videoHeight;
  if (vW === 0) { requestAnimationFrame(procesarFrame); return; }

  isProcessing = true; // Bloqueamos nuevas capturas hasta terminar esta
  statusMsg.innerText = "Escaneando...";

  // Canvas de alta resolución para Tesseract
  canvas.width = 1000;
  canvas.height = 200;

  // Ajuste de área: capturamos el 80% ancho y 20% alto donde está el cuadro guía
  ctx.drawImage(video, vW * 0.1, vH * 0.25, vW * 0.8, vH * 0.2, 0, 0, 1000, 200);

  // Pre-procesamiento: Mejora drástica de contraste
  let imgData = ctx.getImageData(0, 0, 1000, 200);
  let d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    let brightness = (d[i] + d[i+1] + d[i+2]) / 3;
    let v = brightness < 120 ? 0 : 255; // Blanco y negro puro
    d[i] = d[i+1] = d[i+2] = v;
  }
  ctx.putImageData(imgData, 0, 0);

  try {
    const { data: { text } } = await worker.recognize(canvas);
    const limpio = text.toUpperCase().replace(/[^0-9AB]/g, "");
    const match = limpio.match(/(\d{8,9})([AB])/);

    if (match) {
      verificar(match[1] + match[2], parseInt(match[1]), match[2]);
    } else {
      isProcessing = false;
      setTimeout(procesarFrame, 200); // Pequeña pausa para no calentar el procesador
    }
  } catch (err) {
    isProcessing = false;
    setTimeout(procesarFrame, 500);
  }
}

function verificar(serieFull, numero, letra) {
  scanning = false;
  isProcessing = false;
  detenerCamara();

  const denom = document.getElementById("denominacion").value;
  let esIlegal = letra === "B" && baseDatosIlegal[denom]?.some(([min, max]) => numero >= min && numero <= max);

  const modal = document.getElementById("custom-modal");
  document.getElementById("modal-title").innerText = esIlegal ? "⚠️ SERIE NO VÁLIDA" : "✅ SERIE VÁLIDA";
  document.getElementById("modal-title").style.color = esIlegal ? "#ff4444" : "#00ff88";
  document.getElementById("modal-text").innerHTML = `Serie: <strong>${serieFull}</strong><br>Billete: Bs. ${denom}`;
  modal.hidden = false;
}

// Función robusta para apagar cámara y resetear UI
function reiniciarTodo() {
  scanning = false;
  isProcessing = false;
  detenerCamara();
  document.getElementById("custom-modal").hidden = true;
  document.getElementById("scanner-container").hidden = true;
  document.getElementById("main-ui").hidden = false;
}

function detenerCamara() {
  if (streamRef) {
    streamRef.getTracks().forEach(track => track.stop());
    streamRef = null;
  }
  video.srcObject = null;
}

// ASIGNACIÓN DE BOTONES (Corregido)
document.getElementById("modal-close").onclick = reiniciarTodo;
document.getElementById("closeBtn").onclick = reiniciarTodo;

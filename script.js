const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusMsg = document.getElementById("status-msg");

// Base de datos de series
const baseDatosIlegal = {
  10: [[67250001, 67700000], [69050001, 69500000], [69500001, 69950000], [69995001, 70400000], [70400001, 70850000], [70850001, 71300000], [76310012, 85139995], [86400001, 86850000], [90900001, 91350000], [91800001, 92250000]],
  20: [[87280145, 91646549], [96650001, 97100000], [99800001, 100250000], [100250001, 100700000], [109250001, 109700000], [110600001, 111050000], [111050001, 111500000], [111950001, 112400000], [112400001, 112850000], [112850001, 113300000], [114200001, 114650000], [114650001, 115100000], [115100001, 115550000], [118700001, 119150000], [119150001, 119600000], [120500001, 120950000]],
  50: [[77100001, 77550000], [78000001, 78450000], [78900001, 96350000], [96350001, 96800000], [96800001, 97250000], [98150001, 98600000], [104900001, 105350000], [105350001, 105800000], [106700001, 107150000], [107600001, 108050000], [108050001, 108500000], [109400001, 109850000]]
};

let scanning = false;
let worker = null;
let streamRef = null;

async function initWorker() {
  if (!worker) {
    statusMsg.innerText = "Sincronizando visor...";
    worker = await Tesseract.createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789AB',
      tessedit_pageseg_mode: '7'
    });
  }
}

document.getElementById("scanBtn").onclick = async () => {
  try {
    await initWorker();
    streamRef = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
    });
    video.srcObject = streamRef;
    document.getElementById("main-ui").hidden = true;
    document.getElementById("scanner-container").hidden = false;
    scanning = true;
    procesarFrame();
  } catch (e) { alert("Error de cámara. Use HTTPS."); }
};

async function procesarFrame() {
  if (!scanning) return;
  const vW = video.videoWidth;
  const vH = video.videoHeight;
  if (vW === 0) { requestAnimationFrame(procesarFrame); return; }

  // CALIBRACIÓN DE CENTRADO DINÁMICO
  // Calculamos el área de lectura basándonos en el centro absoluto del video
  const cropW = vW * 0.8;  // 80% del ancho del video
  const cropH = vH * 0.15; // 15% del alto del video (franja estrecha para la serie)
  const startX = (vW - cropW) / 2;
  const startY = (vH - cropH) / 2;

  canvas.width = 1000;
  canvas.height = 200;

  // Dibujar el recorte centrado en el canvas
  ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, 1000, 200);

  // Pre-procesamiento para mejorar contraste
  let imgData = ctx.getImageData(0, 0, 1000, 200);
  let d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    let brightness = (d[i] + d[i+1] + d[i+2]) / 3;
    let v = brightness < 125 ? 0 : 255;
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
      setTimeout(procesarFrame, 250);
    }
  } catch (err) {
    setTimeout(procesarFrame, 500);
  }
}

function verificar(serieFull, numero, letra) {
  scanning = false;
  if (streamRef) streamRef.getTracks().forEach(t => t.stop());

  const denom = document.getElementById("denominacion").value;
  let esIlegal = letra === "B" && baseDatosIlegal[denom]?.some(([min, max]) => numero >= min && numero <= max);

  document.getElementById("modal-title").innerText = esIlegal ? "⚠️ SERIE NO VÁLIDA" : "✅ SERIE VÁLIDA";
  document.getElementById("modal-title").style.color = esIlegal ? "#ff4444" : "#00ff88";
  document.getElementById("modal-text").innerHTML = `Serie: <strong>${serieFull}</strong><br>Billete: Bs. ${denom}`;
  document.getElementById("custom-modal").hidden = false;
}

// Reseteo total al cerrar
const reset = () => location.reload();
document.getElementById("modal-close").onclick = reset;
document.getElementById("closeBtn").onclick = reset;

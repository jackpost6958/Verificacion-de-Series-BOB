const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const statusMsg = document.getElementById("status-msg");

// BASE DE DATOS ACTUALIZADA SEGÚN TUS RANGOS
const baseDatosIlegal = {
  10: [
    [67250001, 67700000], [69050001, 69500000], [69500001, 69950000],
    [69950001, 70400000], [70400001, 70850000], [70850001, 71300000],
    [76310012, 85139995], [86400001, 86850000], [90900001, 91350000],
    [91800001, 92250000]
  ],
  20: [
    [87280145, 91646549], [96650001, 97100000], [99800001, 100250000],
    [100250001, 100700000], [109250001, 109700000], [110600001, 111050000],
    [111050001, 111500000], [111950001, 112400000], [112400001, 112850000],
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
let track = null;

document.getElementById("scanBtn").onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment", width: { ideal: 1920 } } 
    });
    video.srcObject = stream;
    track = stream.getVideoTracks()[0];

    // ENCENDER FLASH AUTOMÁTICO
    const capabilities = track.getCapabilities();
    if (capabilities.torch) {
      await track.applyConstraints({ advanced: [{ torch: true }] });
    }

    document.getElementById("main-ui").hidden = true;
    document.getElementById("scanner-container").hidden = false;
    scanning = true;
    procesarFrame();
  } catch (e) { alert("Error: Use HTTPS y permita la cámara."); }
};

async function procesarFrame() {
  if (!scanning) return;

  const vW = video.videoWidth;
  const vH = video.videoHeight;
  if (vW === 0) { requestAnimationFrame(procesarFrame); return; }

  // Canvas de alta definición para el recorte
  canvas.width = 1000;
  canvas.height = 200;

  // RECORTE ENFOCADO: Zoom al margen central
  ctx.drawImage(video, vW * 0.1, vH * 0.42, vW * 0.8, vH * 0.15, 0, 0, 1000, 200);

  // FILTRO DE NITIDEZ (Binarización agresiva)
  let imgData = ctx.getImageData(0, 0, 1000, 200);
  let d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    let gray = (d[i] + d[i+1] + d[i+2]) / 3;
    let v = gray < 120 ? 0 : 255; // Números negros, fondo blanco
    d[i] = d[i+1] = d[i+2] = v;
  }
  ctx.putImageData(imgData, 0, 0);

  // RECONOCIMIENTO CON TESSERACT
  const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
    tessedit_char_whitelist: '0123456789AB',
    tessedit_pageseg_mode: '7'
  });

  const limpio = text.toUpperCase().replace(/[^0-9AB]/g, "");
  const match = limpio.match(/(\d{8,9})([AB])/); // Acepta 8 o 9 dígitos por si hay cortes

  if (match) {
    ejecutarVerificacion(match[1] + match[2], parseInt(match[1]), match[2]);
  } else {
    setTimeout(procesarFrame, 300);
  }
}

function ejecutarVerificacion(serieFull, numero, letra) {
  scanning = false;
  const denominacion = document.getElementById("denominacion").value;
  
  // Apagar Flash
  if (track && track.getCapabilities().torch) {
    track.applyConstraints({ advanced: [{ torch: false }] });
  }

  // REGLA DE ORO: Solo es ilegal si es serie "B" y está en el rango
  let ilegal = false;
  if (letra === "B") {
    ilegal = baseDatosIlegal[denominacion].some(([min, max]) => numero >= min && numero <= max);
  }

  if (navigator.vibrate) navigator.vibrate(ilegal ? [200, 100, 200] : 100);

  const mensaje = ilegal 
    ? `⚠️ BILLETE NO VÁLIDO\n\nSerie: ${serieFull}\nEste billete pertenece a una serie reportada como ilegal.`
    : `✅ BILLETE VÁLIDO\n\nSerie: ${serieFull}\nEsta serie es legal y no presenta reportes de falsificación.`;

  alert(mensaje);
  location.reload();
}

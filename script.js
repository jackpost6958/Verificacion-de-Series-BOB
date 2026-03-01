const scanBtn = document.getElementById("scanBtn");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

/* =========================
   RANGOS DE SERIES ERRÓNEAS
   ========================= */

const rangos10 = [
  [67250001, 67700000],
  [69050001, 69500000],
  [69500001, 69950000],
  [69950001, 70400000],
  [70400001, 70850000],
  [70850001, 71300000],
  [76310012, 85139995],
  [86400001, 86850000],
  [90900001, 91350000],
  [91800001, 92250000]
];

const rangos20 = [
  [87280145, 91646549],
  [96650001, 97100000],
  [99800001, 100250000],
  [100250001, 100700000],
  [109250001, 109700000],
  [110600001, 111050000],
  [111050001, 111500000],
  [111950001, 112400000],
  [112400001, 112850000],
  [112850001, 113300000],
  [114200001, 114650000],
  [114650001, 115100000],
  [115100001, 115550000],
  [118700001, 119150000],
  [119150001, 119600000],
  [120500001, 120950000]
];

const rangos50 = [
  [77100001, 77550000],
  [78000001, 78450000],
  [78900001, 96350000],
  [96350001, 96800000],
  [96800001, 97250000],
  [98150001, 98600000],
  [104900001, 105350000],
  [105350001, 105800000],
  [106700001, 107150000],
  [107600001, 108050000],
  [108050001, 108500000],
  [109400001, 109850000]
];

/* ========================= */

scanBtn.addEventListener("click", iniciarCamara);

async function iniciarCamara() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });

  video.srcObject = stream;
  video.hidden = false;

  setTimeout(() => capturarImagen(stream), 2000);
}

function capturarImagen(stream) {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  stream.getTracks().forEach(track => track.stop());
  video.hidden = true;

  reconocerTexto();
}

async function reconocerTexto() {
  const { data: { text } } = await Tesseract.recognize(
    canvas,
    "eng",
    { logger: () => {} }
  );

  const limpio = text.replace(/\s/g, "").toUpperCase();
  const regex = /\d{8,9}B|\d{8,9}[A-Z]/;
  const match = limpio.match(regex);

  if (!match) {
    alert("❌ No se detectó un número de serie válido");
    return;
  }

  const serie = match[0];
  preguntarBillete(serie);
}

function preguntarBillete(serie) {
  const opcion = prompt(
    `Serie detectada: ${serie}\n\n¿De qué billete es?\nEscribe: 10, 20 o 50`
  );

  if (!opcion) return;

  const billete = parseInt(opcion);

  if (![10, 20, 50].includes(billete)) {
    alert("❌ Opción inválida");
    return;
  }

  const resultado = validarSerie(serie, billete);
  alert(resultado ? "✅ Serie verdadera" : "❌ Serie errónea");
}

function estaEnRango(numero, rangos) {
  return rangos.some(([min, max]) => numero >= min && numero <= max);
}

function validarSerie(serie, billete) {
  // Si NO termina en B, es válida automáticamente
  if (!serie.endsWith("B")) return true;

  const numero = parseInt(serie.slice(0, -1));
  if (isNaN(numero)) return false;

  if (billete === 10) return !estaEnRango(numero, rangos10);
  if (billete === 20) return !estaEnRango(numero, rangos20);
  if (billete === 50) return !estaEnRango(numero, rangos50);

  return false;
}
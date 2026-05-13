/* ═══════════════════════════════════════════════
   PORTAL SST — PORTAL PROVEEDORES
═══════════════════════════════════════════════ */

let archivos = {};   // { index: File }

/* ── INIT ──────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  // Mostrar loading mientras se cargan las áreas de Google Sheets
  Loading.show();
  await cargarAreas();
  Loading.hide();

  cargarSelectAreas();
  // Sync áreas (cada 5 minutos para no saturar la red)
  setInterval(sincronizarAreas, 300000);
});

/* ── CARGAR ÁREAS EN SELECT ─────────────────── */
function cargarSelectAreas() {
  const areas = obtenerAreas();
  const select = document.getElementById("areaSelect");
  const actual = select.value;

  select.innerHTML = '<option value="">— Selecciona un área —</option>';
  Object.keys(areas).forEach(a => {
    const opt = document.createElement("option");
    opt.value = a; opt.textContent = a;
    select.appendChild(opt);
  });

  if (actual && areas[actual]) select.value = actual;
}

/* ── SYNC ÁREAS ────────────────────────────── */
let _lastAreas = "";
async function sincronizarAreas() {
  const oldKeys = JSON.stringify(obtenerAreas());
  await cargarAreas();
  const current = JSON.stringify(obtenerAreas());

  if (current !== oldKeys) {
    cargarSelectAreas();
    if (document.getElementById("areaSelect").value) {
      cargarRequisitos();
    }
  }
}

/* ── CARGAR REQUISITOS ──────────────────────── */
function cargarRequisitos() {
  const area = document.getElementById("areaSelect").value;
  const wrap = document.getElementById("requisitosWrap");
  archivos = {};

  if (!area) { wrap.style.display = "none"; return; }

  const reqs = obtenerAreas()[area] || [];
  const list = document.getElementById("requisitosList");

  list.innerHTML = reqs.map((req, i) => `
    <div class="req-item" id="reqItem_${i}">
      <label>
        <span class="req-num">${i + 1}</span>${req}
        <span class="req" style="color:var(--danger);margin-left:4px;">*</span>
      </label>
      <input
        type="file"
        class="file-input"
        id="file_${i}"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onchange="onFileChange(${i}, '${req.replace(/'/g, "\\'")}')">
      <div class="file-confirm" id="confirm_${i}">
        <span>✓</span><span id="fname_${i}"></span>
      </div>
    </div>
  `).join("");

  wrap.style.display = "block";
  document.getElementById("submitWrap").style.display = "block";
}

/* ── ARCHIVO SELECCIONADO ───────────────────── */
function onFileChange(idx, reqName) {
  const input = document.getElementById(`file_${idx}`);
  const file = input.files[0];
  const reqItem = document.getElementById(`reqItem_${idx}`);
  const confirmBlock = document.getElementById(`confirm_${idx}`);
  
  if (!file) {
    reqItem.classList.remove("ok");
    confirmBlock.classList.remove("show");
    delete archivos[idx];
    return;
  }
  
  // 1. Validar el tamaño del archivo (Máximo 5MB)
  const MAX_SIZE_MB = 5;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    alert(`❌ El archivo pesa demasiado (${(file.size/1024/1024).toFixed(1)}MB).\nEl tamaño máximo permitido es ${MAX_SIZE_MB}MB.`);
    input.value = ""; // Limpiar el input
    return;
  }
  
  // 2. Validar qué tipo de archivo es (Extensiones permitidas)
  const extensionesPermitidas = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
  const fileNameMinusculas = file.name.toLowerCase();
  const extensionSoportada = extensionesPermitidas.some(ext => fileNameMinusculas.endsWith(ext));
  
  if (!extensionSoportada) {
    alert(`❌ Formato de archivo no permitido.\nSolo se aceptan: ${extensionesPermitidas.join(', ')}`);
    input.value = ""; // Limpiar el input
    return;
  }
  
  archivos[idx] = file;
  document.getElementById(`fname_${idx}`).textContent = file.name;
  confirmBlock.classList.add("show");
  reqItem.classList.add("ok");
}

/* ── ENVIAR ─────────────────────────────────── */
async function enviarFormulario() {
  const area = document.getElementById("areaSelect").value;
  const proveedor = document.getElementById("fProveedor").value.trim();
  const responsable = document.getElementById("fResponsable").value.trim();
  const documento = document.getElementById("fDocumento").value.trim();
  const empresa = document.getElementById("fEmpresa").value.trim();
  const msgEl = document.getElementById("msgPortal");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");
  const btnEnviar = document.getElementById("btnEnviar");

  // Ocultar mensaje anterior
  msgEl.className = "msg"; msgEl.style.display = "none";

  // Validar proveedor
  if (!proveedor || !responsable || !documento || !empresa || !area) {
    msgEl.textContent = "❌ Completa todos los campos obligatorios";
    msgEl.className = "msg error show"; msgEl.style.display = "block";
    msgEl.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const reqs = obtenerAreas()[area] || [];

  // Validar archivos
  for (let i = 0; i < reqs.length; i++) {
    if (!archivos[i]) {
      msgEl.textContent = `❌ Falta el documento: "${reqs[i]}"`;
      msgEl.className = "msg error show"; msgEl.style.display = "block";
      document.getElementById(`reqItem_${i}`).scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
  }

  btnEnviar.disabled = true;
  progressWrap.classList.add("show");
  let enviados = 0, errores = [];

  for (let i = 0; i < reqs.length; i++) {
    const pct = Math.round((i / reqs.length) * 100);
    progressFill.style.width = pct + "%";

    msgEl.textContent = `⏳ Enviando ${i + 1} de ${reqs.length}: ${reqs[i]}...`;
    msgEl.className = "msg info show"; msgEl.style.display = "block";

    try {
      const base64 = await SSTApi.fileToBase64(archivos[i]);

      await SSTApi.guardarDocumento({
        proveedor, responsable, 
        documento: SSTApi.encrypt(documento), // ENCRIPTAR DOCUMENTO
        empresa, area,
        requisito: reqs[i],
        nombreArchivo: archivos[i].name,
        base64
      });

      enviados++;
    } catch (err) {
      errores.push(`"${reqs[i]}": ${err.message}`);
      console.error("Error doc " + i, err);
    }
  }

  progressFill.style.width = "100%";
  setTimeout(() => { progressWrap.classList.remove("show"); progressFill.style.width = "0%"; }, 1200);

  if (enviados === reqs.length) {
    msgEl.textContent = `✅ ¡${enviados} documento(s) enviados! El equipo SST revisará y actualizará el estado.`;
    msgEl.className = "msg exito show"; msgEl.style.display = "block";
    Toast.ok(`${enviados} documentos enviados correctamente`);
    setTimeout(() => {
      document.getElementById("formPrincipal").reset();
      document.getElementById("requisitosWrap").style.display = "none";
      document.getElementById("submitWrap").style.display = "none";
      archivos = {};
      msgEl.style.display = "none";
    }, 3500);
  } else if (enviados > 0) {
    msgEl.textContent = `⚠️ ${enviados} de ${reqs.length} enviados. Errores: ${errores.join(" | ")}`;
    msgEl.className = "msg advertencia show"; msgEl.style.display = "block";
  } else {
    msgEl.textContent = `❌ No se pudo enviar. Verifica tu conexión y vuelve a intentarlo.`;
    msgEl.className = "msg error show"; msgEl.style.display = "block";
    Toast.err("Error al enviar los documentos");
  }

  btnEnviar.disabled = false;
}

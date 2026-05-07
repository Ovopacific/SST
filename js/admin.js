/* ═══════════════════════════════════════════════
   PORTAL SST — PANEL ADMINISTRATIVO
═══════════════════════════════════════════════ */

let registros   = [];   // todos los registros
let filtrados   = [];   // registros filtrados
let editandoDoc = null; // { idx, registro }
let editandoArea = null;

let currentUser = null; // { usuario, rol, permisos }

/* ── LOGIN ─────────────────────────────────── */
document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const usuario = document.getElementById("userInput").value.trim();
  const pwd = document.getElementById("pwdInput").value;
  const btn = e.target.querySelector('button');
  const errorEl = document.getElementById("loginError");
  
  if (!pwd) return;
  
  btn.disabled = true;
  btn.textContent = "Verificando...";
  errorEl.style.display = "none";
  
  const respuesta = await SSTApi.verificarPassword(usuario, pwd);
  
  if (respuesta && respuesta.success) {
    if (respuesta.token) {
      sessionStorage.setItem("sst_token", respuesta.token);
    }
    
    currentUser = {
      usuario: usuario || 'admin',
      rol: respuesta.rol || 'admin',
      permisos: respuesta.permisos || []
    };
    
    document.getElementById("loginPage").style.display  = "none";
    document.getElementById("appLayout").style.display  = "grid";
    iniciarAdmin();
  } else {
    errorEl.style.display = "block";
    errorEl.textContent   = "❌ " + (respuesta.error || "Error de conexión");
  }
  
  btn.disabled = false;
  btn.textContent = "Ingresar →";
});

function logout() {
  document.getElementById("appLayout").style.display = "none";
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("pwdInput").value = "";
  document.getElementById("userInput").value = "";
  document.getElementById("loginError").style.display = "none";
  sessionStorage.removeItem("sst_token");
  registros = []; filtrados = [];
  currentUser = null;
}

/* ── INICIAR ────────────────────────────────── */
function iniciarAdmin() {
  aplicarPermisosUI();
  cargarDatos();
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
  // Auto-refresh cada 90s
  setInterval(() => {
    if (document.getElementById("tabDashboard").classList.contains("active")) cargarDatos();
  }, 90000);
  
  // Seleccionar primera tab permitida
  if (tienePermiso('dashboard')) mostrarTab('dashboard');
  else if (tienePermiso('documentos')) mostrarTab('documentos');
  else if (tienePermiso('areas')) mostrarTab('areas');
  else if (tienePermiso('proveedores')) mostrarTab('proveedores');
  else if (tienePermiso('usuarios')) mostrarTab('usuarios');
}

function actualizarReloj() {
  const el = document.getElementById("topbarTime");
  if (el) el.textContent = new Date().toLocaleTimeString("es-CO");
}

/* ── PERMISOS ──────────────────────────────── */
function tienePermiso(permiso) {
  if (!currentUser) return false;
  if (currentUser.rol === 'admin') return true;
  return currentUser.permisos.includes(permiso);
}

function aplicarPermisosUI() {
  const tabs = ['dashboard', 'documentos', 'areas', 'proveedores', 'usuarios'];
  tabs.forEach(t => {
    const btn = document.getElementById("navBtn" + capitalizar(t));
    if (btn) {
      if (tienePermiso(t)) btn.style.display = 'flex';
      else btn.style.display = 'none';
    }
  });
}

/* ── TABS ──────────────────────────────────── */
function mostrarTab(nombre) {
  if (!tienePermiso(nombre)) return; // Acceso denegado

  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  document.getElementById("tab" + capitalizar(nombre)).classList.add("active");
  document.getElementById("navBtn" + capitalizar(nombre)).classList.add("active");

  const titles = { dashboard: "Dashboard", documentos: "Gestión de Documentos", areas: "Gestionar Áreas", proveedores: "Proveedores", usuarios: "Gestión de Usuarios" };
  document.getElementById("pageTitle").textContent = titles[nombre] || nombre;

  if (nombre === "documentos")  renderTablaDocumentos();
  if (nombre === "areas")       actualizarUIAreas();
  if (nombre === "proveedores") renderProveedores();
  if (nombre === "usuarios")    if(typeof renderUsuarios === 'function') renderUsuarios();
  if (nombre === "dashboard")   cargarDatos();
}

function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ── CARGAR DATOS ───────────────────────────── */
async function cargarDatos() {
  Loading.show();
  try {
    registros = await SSTApi.getRegistros();
    filtrados = [...registros];
    renderDashboard();
    renderTablaDocumentos();
    renderFiltroAreas();
    document.getElementById("lastUpdate").textContent =
      "Actualizado: " + new Date().toLocaleTimeString("es-CO");
  } catch(err) {
    console.error("[SST]", err);
    const esConexion = !err.message || err.message.includes("fetch") || err.message.includes("conectar") || err.message.includes("Failed");
    const guia = esConexion
      ? "❌ Sin conexión con el servidor.<br><small>Causas más comunes:<br>① URL incorrecta en js/config.js<br>② Script desplegado como «Solo yo» — debe ser «Cualquier persona»<br>③ Después de editar el script, debes crear un NUEVO despliegue</small>"
      : "❌ " + err.message;
    setTextoTabla("tablaUltimos",  7, guia);
    setTextoTabla("tablaDocumentos", 8, guia);
    Toast.err(esConexion ? "Sin conexión — revisa la config del script (ver tabla para detalles)" : err.message, 8000);
  } finally {
    Loading.hide();
  }
}

function setTextoTabla(id, cols, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<tr><td colspan="${cols}" class="empty"><div class="empty-icon">⚠️</div>${msg}</td></tr>`;
}

/* ── DASHBOARD ──────────────────────────────── */
function renderDashboard() {
  const total     = registros.length;
  const pendientes= registros.filter(r => r.Estado === "Pendiente").length;
  const aprobados = registros.filter(r => r.Estado === "Aprobado").length;
  const rechazados= registros.filter(r => r.Estado === "Rechazado").length;

  document.getElementById("statTotal").textContent    = total;
  document.getElementById("statPend").textContent     = pendientes;
  document.getElementById("statApro").textContent     = aprobados;
  document.getElementById("statRech").textContent     = rechazados;

  const ultimos = [...registros].reverse().slice(0, 10);
  const tbody   = document.getElementById("tablaUltimos");

  if (!ultimos.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty"><div class="empty-icon">📭</div>No hay documentos aún</td></tr>`;
    return;
  }

  tbody.innerHTML = ultimos.map((r, i) => {
    const idx = registros.indexOf(r);
    return filaTR(r, idx, false);
  }).join("");
}

/* ── TABLA DOCUMENTOS (ACORDEÓN POR PROVEEDOR) ───────────────────────── */
function renderTablaDocumentos() {
  const tbody = document.getElementById("tablaDocumentos");
  if (!filtrados.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty"><div class="empty-icon">📭</div>No hay documentos</td></tr>`;
    return;
  }

  // 1. Agrupar por proveedor
  const proveedorGroups = {};
  filtrados.forEach(r => {
    const provName = r.Proveedor || "Sin Proveedor";
    if (!proveedorGroups[provName]) {
      proveedorGroups[provName] = {
        empresa: r.Empresa || "",
        responsable: r.Nombre || "—",
        documentos: [],
        stats: { Pendiente: 0, Aprobado: 0, Rechazado: 0 }
      };
    }
    const estado = r.Estado || "Pendiente";
    proveedorGroups[provName].stats[estado] = (proveedorGroups[provName].stats[estado] || 0) + 1;
    proveedorGroups[provName].documentos.push(r);
  });

  // 2. Generar HTML (Fila principal + Fila desplegable oculta)
  let html = "";
  Object.keys(proveedorGroups).forEach((provName, pIdx) => {
    const data = proveedorGroups[provName];
    const totalDocs = data.documentos.length;
    
    // Calcular estado general visual
    let badgeHtml = "";
    if (data.stats.Rechazado > 0) badgeHtml += `<span class="badge rechazado" style="margin-right:4px;" title="Rechazados">${data.stats.Rechazado} ❌</span>`;
    if (data.stats.Pendiente > 0) badgeHtml += `<span class="badge pendiente" style="margin-right:4px;" title="Pendientes">${data.stats.Pendiente} ⏳</span>`;
    if (data.stats.Aprobado > 0)  badgeHtml += `<span class="badge aprobado" title="Aprobados">${data.stats.Aprobado} ✅</span>`;
    
    // Fila Principal (Acordeón)
    html += `
      <tr class="prov-row" onclick="toggleProveedor('provDetail_${pIdx}')" style="cursor: pointer; background: var(--off-white); transition: background 0.2s;">
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <span id="icon_provDetail_${pIdx}" style="font-size:0.8rem; color:var(--gray-500); transition: transform 0.3s;">▶</span>
            <div>
              <strong>${SSTApi.escapeHTML(provName)}</strong>
              <div style="font-size: 0.8rem; color: var(--gray-500);">${SSTApi.escapeHTML(data.empresa)}</div>
            </div>
          </div>
        </td>
        <td>${SSTApi.escapeHTML(data.responsable)}</td>
        <td><strong>${totalDocs}</strong> docs</td>
        <td>${badgeHtml || '<span class="badge pendiente">0</span>'}</td>
        <td style="text-align: right;">
          <button class="btn btn-ghost btn-sm">Ver Detalles ⬇</button>
        </td>
      </tr>
      
      <!-- Fila Detalles (Oculta por defecto) -->
      <tr id="provDetail_${pIdx}" style="display: none; background: #fafafa;">
        <td colspan="5" style="padding: 0; border-bottom: 2px solid var(--gray-200);">
          <div style="padding: 1rem 1.5rem 1rem 3rem; box-shadow: inset 0 3px 6px rgba(0,0,0,0.03);">
            <table style="background: white; border: 1px solid var(--gray-200); border-radius: 8px; overflow: hidden; margin: 0; min-width: 100%;">
              <thead>
                <tr style="background: var(--gray-100);">
                  <th style="padding: 8px 12px; font-size:0.85rem;">Área</th>
                  <th style="padding: 8px 12px; font-size:0.85rem;">Requisito</th>
                  <th style="padding: 8px 12px; font-size:0.85rem;">Fecha</th>
                  <th style="padding: 8px 12px; font-size:0.85rem;">Estado</th>
                  <th style="padding: 8px 12px; font-size:0.85rem; text-align:right;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${data.documentos.map(doc => {
                  const globalIdx = registros.indexOf(doc);
                  const est = (doc.Estado || "Pendiente").toLowerCase();
                  const archivoBtn = doc["URL Documento"] 
                    ? `<a class="btn btn-ghost btn-sm" href="${doc["URL Documento"]}" target="_blank" style="padding: 4px 8px; font-size: 0.8rem;">📄 Ver</a>` 
                    : "";
                    
                  return `
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 8px 12px; font-size:0.9rem;">${doc.Área || "—"}</td>
                      <td style="padding: 8px 12px; font-size:0.9rem; max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${doc.Requisito||""}">${doc.Requisito || "—"}</td>
                      <td style="padding: 8px 12px; font-size:0.9rem;">${fmtFecha(doc["Fecha Carga"])}</td>
                      <td style="padding: 8px 12px;">
                        <span class="badge ${est}" style="font-size:0.75rem; padding: 2px 6px;">${doc.Estado || "Pendiente"}</span>
                      </td>
                      <td style="padding: 8px 12px; text-align:right; display:flex; gap:0.5rem; justify-content:flex-end;">
                        ${archivoBtn}
                        <button class="btn btn-accent btn-sm" style="padding: 4px 8px; font-size: 0.8rem;" onclick="abrirModalEstado(${globalIdx})">✏️ Estado</button>
                        <button class="btn btn-danger btn-sm" style="padding: 4px 8px; font-size: 0.8rem;" onclick="eliminarDocumento(${globalIdx})">🗑️ Eliminar</button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Función para abrir/cerrar el acordeón de cada proveedor
window.toggleProveedor = function(rowId) {
  const detailRow = document.getElementById(rowId);
  const icon = document.getElementById("icon_" + rowId);
  
  if (detailRow.style.display === "none") {
    detailRow.style.display = "table-row";
    if(icon) icon.style.transform = "rotate(90deg)";
  } else {
    detailRow.style.display = "none";
    if(icon) icon.style.transform = "rotate(0deg)";
  }
};

// Función para eliminar un documento con confirmación
window.eliminarDocumento = async function(idx) {
  const doc = registros[idx];
  if (!doc) return;
  const nombre = doc.Requisito || "este documento";
  const proveedor = doc.Proveedor || "";
  const area = doc.Área || "";

  if (!confirm(`¿Eliminar el documento "${nombre}" del proveedor ${proveedor}?\n\nEsta acción no se puede deshacer.`)) return;
  
  try {
    Loading.show();
    // Usamos doc.Fila o doc._fila como identificador
    const filaId = doc.Fila || doc._fila || "";
    
    // NOTA: Enviamos 'Área' también por si el backend lo requiere para filtrar/validar
    const res = await SSTApi.eliminarDocumento({ 
      fila: filaId, 
      proveedor: doc.Proveedor, 
      requisito: doc.Requisito,
      area: area 
    });

    console.log("[SST] Respuesta eliminación:", res);

    // Recargar datos para verificar
    await cargarDatos();

    // Verificación de diagnóstico: ¿Sigue existiendo el documento?
    const sigoExistiendo = registros.some(r => 
      (r.Fila || r._fila) == filaId || 
      (r.Proveedor === doc.Proveedor && r.Requisito === doc.Requisito && r.Área === area)
    );

    if (sigoExistiendo) {
      if (res._isFallbackSuccess) {
        Toast.err("El servidor no confirmó la eliminación y el dato sigue apareciendo. Es posible que el script de Google no tenga permisos de escritura.");
      } else {
        Toast.err("Error: Se solicitó eliminar pero el documento persiste en la base de datos.");
      }
    } else {
      Toast.ok(`Documento eliminado correctamente`);
    }

  } catch(e) {
    Toast.err("Error al eliminar: " + e.message);
  } finally {
    Loading.hide();
  }
};


/* ── FILA PARA DASHBOARD (MANTIENE FORMA PLANA) ───────────────────────── */
function filaTR(r, idx, conArchivo) {
  const est     = (r.Estado || "Pendiente").toLowerCase();
  const archivo = conArchivo && r["URL Documento"]
    ? `<a class="btn btn-ghost btn-sm" href="${SSTApi.escapeHTML(r["URL Documento"])}" target="_blank">📄 Ver</a>`
    : (conArchivo ? "—" : "");
  const archivoCell = conArchivo ? `<td>${archivo}</td>` : "";

  return `
    <tr>
      <td><strong>${SSTApi.escapeHTML(r.Proveedor || "—")}</strong></td>
      <td>${SSTApi.escapeHTML(r.Nombre || "—")}</td>
      <td>${SSTApi.escapeHTML(r.Área   || "—")}</td>
      <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${SSTApi.escapeHTML(r.Requisito||"")}"><span class="doc-meta-item">${SSTApi.escapeHTML(r.Requisito || "—")}</span></td>
      ${archivoCell}
      <td>${fmtFecha(r["Fecha Carga"])}</td>
      <td><span class="badge ${est}">${SSTApi.escapeHTML(r.Estado || "Pendiente")}</span></td>
      <td>
        <button class="btn btn-accent btn-sm" onclick="abrirModalEstado(${idx})">✏️ Estado</button>
      </td>
    </tr>`;
}

/* ── FILTROS ────────────────────────────────── */
function renderFiltroAreas() {
  const areas  = [...new Set(registros.map(r => r.Área).filter(Boolean))];
  const select = document.getElementById("filtroArea");
  const actual = select.value;
  select.innerHTML = '<option value="">Todas las áreas</option>' +
    areas.map(a => `<option value="${SSTApi.escapeHTML(a)}">${SSTApi.escapeHTML(a)}</option>`).join("");
  if (actual) select.value = actual;
}

function filtrar() {
  const estado = document.getElementById("filtroEstado").value;
  const area   = document.getElementById("filtroArea").value;
  filtrados = registros.filter(r =>
    (!estado || r.Estado === estado) && (!area || r.Área === area)
  );
  renderTablaDocumentos();
}

/* ── MODAL ESTADO ───────────────────────────── */
function abrirModalEstado(idx) {
  const r   = registros[idx];
  if (!r) return;
  editandoDoc = { idx, r };

  const docReal = SSTApi.decrypt(r.Documento);

  document.getElementById("meProv").textContent  = r.Proveedor || "—";
  document.getElementById("meReq").textContent   = r.Requisito || "—";
  document.getElementById("meArea").textContent  = r.Área      || "—";
  
  // Mostrar documento enmascarado con botón de revelar
  const docEl = document.getElementById("meDoc");
  docEl.innerHTML = `
    <span id="meDocVal">${SSTApi.maskDocumento(docReal)}</span>
    <button class="btn btn-ghost btn-sm" onclick="toggleRevealDoc('${docReal.replace(/'/g,"\\'")}')" style="padding:2px 5px; margin-left:5px;" title="Mostrar/Ocultar">👁️</button>
  `;

  document.getElementById("meEstado").value      = r.Estado    || "Pendiente";
  document.getElementById("meComentarios").value = r.Comentarios || "";

  document.getElementById("modalEstado").classList.add("show");
}

window.toggleRevealDoc = function(realVal) {
  const el = document.getElementById("meDocVal");
  if (!el) return;
  if (el.textContent.includes("*")) {
    el.textContent = realVal;
  } else {
    el.textContent = SSTApi.maskDocumento(realVal);
  }
};

function cerrarModalEstado() {
  document.getElementById("modalEstado").classList.remove("show");
  editandoDoc = null;
}

async function guardarEstado() {
  if (!editandoDoc) return;
  const { idx, r }  = editandoDoc;
  const nuevoEstado = document.getElementById("meEstado").value;
  const comentarios = document.getElementById("meComentarios").value.trim();

  Loading.show();
  cerrarModalEstado();

  try {
    const payloadEnvio = {
      proveedor:   r.Proveedor,
      documento:   r.Documento, // Mantenemos el campo encriptado tal cual está en el objeto 'r'
      requisito:   r.Requisito,
      area:        r.Área,
      estado:      nuevoEstado,
      comentarios,
      fila:        r.Fila || r._fila || ""
    };
    console.log("Enviando actualización de estado:", payloadEnvio);
    
    await SSTApi.actualizarEstado(payloadEnvio);

    // Actualizar localmente
    registros[idx].Estado      = nuevoEstado;
    registros[idx].Comentarios = comentarios;
    filtrados = registros.filter(r2 => {
      const e = document.getElementById("filtroEstado")?.value || "";
      const a = document.getElementById("filtroArea")?.value   || "";
      return (!e || r2.Estado === e) && (!a || r2.Área === a);
    });

    renderDashboard();
    renderTablaDocumentos();
    Toast.ok(`Estado actualizado a "${nuevoEstado}"`);
  } catch(err) {
    Toast.err("Error al actualizar: " + err.message);
  } finally {
    Loading.hide();
  }
}

/* ── ÁREAS ──────────────────────────────────── */
// Utilizamos actualizarUIAreas y eliminarArea desde areas.js directamente.

async function crearNuevaArea() {
  const nombreArea = document.getElementById('inputNuevaArea').value.trim();
  
  if (!nombreArea) {
    alert('❌ Ingresa el nombre del área');
    return;
  }
  
  Loading.show();
  const resultado = await agregarArea(nombreArea, []);
  Loading.hide();
  
  if (resultado) {
    document.getElementById('inputNuevaArea').value = '';
    Toast.ok('✅ Área creada correctamente');
  }
}

function mostrarMsgAreas(txt, tipo) {
  const el = document.getElementById("msgAreas");
  if (el) {
    el.textContent = txt;
    el.className = `msg ${tipo} show`;
    el.style.display = "block";
    setTimeout(() => { el.style.display = "none"; }, 4000);
  }
}

/* ── MODAL REQUISITOS ───────────────────────── */
function abrirModalReqs(area) {
  editandoArea = area;
  document.getElementById("mRAreaNombre").textContent = area;
  document.getElementById("mRInput").value = "";
  renderListaReqs();
  document.getElementById("modalReqs").classList.add("show");
}

function cerrarModalReqs() {
  document.getElementById("modalReqs").classList.remove("show");
  editandoArea = null;
}

function renderListaReqs() {
  const areas = obtenerAreas();
  const reqs  = areas[editandoArea] || [];
  const lista = document.getElementById("mRLista");

  if (!reqs.length) {
    lista.innerHTML = `<p style="color:var(--gray-400);text-align:center;padding:1rem">Sin requisitos aún</p>`;
    return;
  }

  lista.innerHTML = reqs.map((req, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;
                padding:0.75rem 0.9rem;background:var(--off-white);border-radius:6px;margin-bottom:6px;
                border:1px solid var(--gray-100);">
      <span style="font-size:0.88rem;color:var(--navy);">${i + 1}. ${SSTApi.escapeHTML(req)}</span>
      <div style="display:flex;gap:0.4rem;">
        <button class="btn btn-ghost btn-sm" onclick="editarReq(${i})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarReq(${i})">🗑️</button>
      </div>
    </div>
  `).join("");
}

async function agregarReq() {
  const val   = document.getElementById("mRInput").value.trim();
  if (!val) { alert("Ingresa el nombre del requisito"); return; }
  const areas = obtenerAreas();
  if (!areas[editandoArea]) areas[editandoArea] = [];
  if (areas[editandoArea].includes(val)) { alert("Este requisito ya existe"); return; }
  areas[editandoArea].push(val);

  Loading.show();
  await guardarAreasEnSheets(areas);
  Loading.hide();

  document.getElementById("mRInput").value = "";
  renderListaReqs();
  actualizarUIAreas(); // actualiza la cantidad de requisitos en la tabla
}

async function editarReq(idx) {
  const areas = obtenerAreas();
  const nuevo = prompt("Editar requisito:", areas[editandoArea][idx]);
  if (nuevo && nuevo.trim()) {
    areas[editandoArea][idx] = nuevo.trim();

    Loading.show();
    await guardarAreasEnSheets(areas);
    Loading.hide();

    renderListaReqs();
  }
}

async function eliminarReq(idx) {
  if (!confirm("¿Eliminar este requisito?")) return;
  const areas = obtenerAreas();
  areas[editandoArea].splice(idx, 1);

  Loading.show();
  await guardarAreasEnSheets(areas);
  Loading.hide();

  renderListaReqs();
  actualizarUIAreas();
}

/* ── PROVEEDORES ────────────────────────────── */
function renderProveedores() {
  const grid = document.getElementById("provGrid");
  if (!grid) return;

  try {
    if (!Array.isArray(registros)) {
      grid.innerHTML = `<p style="padding:2rem;text-align:center">Error: Datos no cargados correctamente.</p>`;
      return;
    }

    const mapa = {};
    registros.forEach(r => {
      if (!r || !r.Proveedor) return;
      if (!mapa[r.Proveedor]) {
        mapa[r.Proveedor] = { 
          nombre: r.Proveedor, 
          responsable: r.Nombre, 
          empresa: r.Empresa, 
          documento: r.Documento, 
          areas: new Set(), 
          total: 0 
        };
      }
      if (r.Área) mapa[r.Proveedor].areas.add(r.Área);
      mapa[r.Proveedor].total++;
    });

    const lista = Object.values(mapa);
    if (!lista.length) {
      grid.innerHTML = `<p style="color:var(--gray-400);padding:2rem;grid-column:1/-1;text-align:center">No hay proveedores registrados</p>`;
      return;
    }

    grid.innerHTML = lista.map((p, i) => {
      try {
        let docReal = "";
        try {
          docReal = p.documento ? SSTApi.decrypt(p.documento) : "";
        } catch(e) {
          console.warn("Error desencriptando para proveedor:", p.nombre, e);
          docReal = "Error";
        }

        const idSpan = `provDoc_${i}`;
        const valEscaped = String(docReal || "").replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const areasArr = Array.from(p.areas || []).filter(Boolean);

        return `
          <div class="prov-card">
            <div class="prov-name">🏢 ${SSTApi.escapeHTML(p.nombre)}</div>
            <div class="prov-detail">👤 ${SSTApi.escapeHTML(p.responsable || "—")}</div>
            <div class="prov-detail">🏭 ${SSTApi.escapeHTML(p.empresa     || "—")}</div>
            <div class="prov-detail" style="display:flex; align-items:center; gap:5px;">
              🪪 <span id="${idSpan}">${SSTApi.maskDocumento(docReal)}</span>
              <button class="btn btn-ghost btn-sm" onclick="toggleRevealDocProv('${valEscaped}', '${idSpan}')" style="padding:2px 4px; font-size:0.7rem;">👁️</button>
            </div>
            <div class="prov-stats">
              <span class="prov-tag">📄 ${p.total} docs</span>
              ${areasArr.map(a => `<span class="prov-tag">${SSTApi.escapeHTML(a)}</span>`).join("")}
            </div>
          </div>
        `;
      } catch (itemErr) {
        console.error("Error procesando item de proveedor:", p, itemErr);
        return `<div class="prov-card error">Error en dato</div>`;
      }
    }).join("");

  } catch (err) {
    console.error("[SST] Error fatal en renderProveedores:", err);
    grid.innerHTML = `<div style="color:var(--red-500);padding:2rem;text-align:center">
      <h3>❌ Error crítico al cargar proveedores</h3>
      <p>${err.message}</p>
      <small>Por favor abre la consola (F12) para ver los detalles.</small>
    </div>`;
  }
}

window.toggleRevealDocProv = function(realVal, id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.textContent.includes("*")) {
    el.textContent = realVal;
  } else {
    el.textContent = SSTApi.maskDocumento(realVal);
  }
};

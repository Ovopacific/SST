document.getElementById("formBusqueda").addEventListener("submit", buscar);

async function buscar(e) {
  e.preventDefault();
  const nombre   = document.getElementById("bNombre").value.trim();
  const cedula   = document.getElementById("bCedula").value.trim();
  const msgEl    = document.getElementById("msgBusqueda");
  const results  = document.getElementById("resultsArea");
  const btnBuscar= document.getElementById("btnBuscar");

  if (!nombre || !cedula) {
    msgEl.textContent = "Completa los dos campos para buscar";
    msgEl.className   = "msg error show"; msgEl.style.display = "block";
    return;
  }

  msgEl.style.display = "none";
  results.classList.remove("show");
  btnBuscar.disabled  = true;
  Loading.show();

  try {
    // El backend ahora filtra la información y solo devuelve lo autorizado
    const encontrados = await SSTApi.getRegistros({
      cedula: cedula,
      proveedor: nombre
    });

    if (!encontrados || !encontrados.length) {
      msgEl.textContent = "❌ No se encontraron documentos con esos datos. Verifica el nombre exacto del proveedor y tu cédula.";
      msgEl.className   = "msg error show"; msgEl.style.display = "block";
      return;
    }

    // Filtrar para mostrar solo el MÁS RECIENTE de cada Requisito + Área
    const unicos = {};
    encontrados.forEach(doc => {
      const clave = (doc.Área || "") + "|" + (doc.Requisito || "");
      
      // Si no existe, lo agregamos. 
      // Si ya existe, lo reemplazamos con este nuevo, porque Google Sheets 
      // devuelve los registros de arriba hacia abajo (los más nuevos están al final de la lista).
      // Alternativamente, si tienen ID de Fila, el de número de fila mayor es el más nuevo.
      
      if (!unicos[clave]) {
        unicos[clave] = doc;
      } else {
        // Obtenemos el número de fila (si existe) para estar 100% seguros
        const filaActual = parseInt(doc.Fila) || 0;
        const filaGuardada = parseInt(unicos[clave].Fila) || 0;
        
        // Si el documento que estamos leyendo ahora está más abajo en el Excel (Fila mayor)
        // o si simplemente vino después en el array (comportamiento normal), lo sobreescribimos.
        if (filaActual >= filaGuardada) {
            unicos[clave] = doc;
        }
      }
    });

    const documentosFinales = Object.values(unicos);

    // Opcional: Para mantener el orden original visualmente si se desea
    documentosFinales.sort((a,b) => (parseInt(a.Fila)||0) - (parseInt(b.Fila)||0));

    renderResultados(documentosFinales, nombre, cedula);
    results.classList.add("show");
    results.scrollIntoView({ behavior: "smooth" });
    msgEl.textContent = `✓ Se encontraron ${documentosFinales.length} documento(s)`;
    msgEl.className   = "msg exito show"; msgEl.style.display = "block";

  } catch(err) {
    msgEl.textContent = "❌ Error al conectar: " + err.message;
    msgEl.className   = "msg error show"; msgEl.style.display = "block";
    console.error(err);
  } finally {
    Loading.hide();
    btnBuscar.disabled = false;
  }
}

/* ── RENDER RESULTADOS ──────────────────────── */
function renderResultados(docs, nombre, cedula) {
  const primer = docs[0];

  // Info proveedor
  document.getElementById("rNombre").textContent = primer.Proveedor || "—";
  document.getElementById("rResp").textContent   = primer.Nombre    || "—";
  document.getElementById("rEmpresa").textContent= primer.Empresa   || "—";
  const docReal = SSTApi.decrypt(primer.Documento);
  document.getElementById("rDoc").innerHTML = `
    <span id="rDocVal">${SSTApi.maskDocumento(docReal)}</span>
    <button class="btn btn-ghost btn-sm" onclick="toggleRevealDocConsulta('${docReal.replace(/'/g,"\\'")}')" style="padding:2px 5px; margin-left:5px; border:none; background:transparent; cursor:pointer;" title="Mostrar/Ocultar">👁️</button>
  `;
  const areas = [...new Set(docs.map(d => d.Área).filter(Boolean))];
  document.getElementById("rAreas").textContent  = areas.join(", ") || "—";
  document.getElementById("rFecha").textContent  = new Date().toLocaleDateString("es-CO", { year:"numeric", month:"long", day:"numeric" });

  // Tarjetas de documentos
  document.getElementById("docCards").innerHTML = docs.map(doc => {
    const est = (doc.Estado || "Pendiente").toLowerCase();
    const esRechazado = doc.Estado === "Rechazado";
    
    return `
      <div class="doc-card ${est}">
        <div class="doc-card-top">
          <div>
            <div class="doc-name">${SSTApi.escapeHTML(doc.Requisito || "Sin nombre")}</div>
            <span class="doc-area">${SSTApi.escapeHTML(doc.Área || "—")}</span>
          </div>
          <span class="badge ${est}">${SSTApi.escapeHTML(doc.Estado || "Pendiente")}</span>
        </div>
        <div class="doc-meta">
          <div class="doc-meta-item">
            <span class="lbl">Archivo:</span>
            <span class="val">${SSTApi.escapeHTML(doc["Nombre Archivo"] || "—")}</span>
          </div>
          <div class="doc-meta-item">
            <span class="lbl">Cargado:</span>
            <span class="val">${fmtFecha(doc["Fecha Carga"])}</span>
          </div>
        </div>
        ${doc.Comentarios ? `
          <div class="doc-comment">
            <strong>💬 Comentarios del equipo SST:</strong>
            ${SSTApi.escapeHTML(doc.Comentarios)}
          </div>
        ` : ""}
        <div class="doc-card-footer">
          <a href="${doc["URL Documento"]}" target="_blank" class="doc-link">🔗 Ver documento</a>
          ${esRechazado ? `
            <button type="button" class="btn-reenviar" 
              onclick="abrirModalReenvio('${doc.Requisito.replace(/'/g, "\\'")}', '${doc.Área.replace(/'/g, "\\'")}', '${nombre.replace(/'/g, "\\'")}', '${SSTApi.decrypt(cedula)}')">
              📤 Reenviar Documento
            </button>
          ` : ""}
        </div>
      </div>`;
  }).join("");

  // Estadísticas
  const total     = docs.length;
  const aprobados = docs.filter(d => d.Estado === "Aprobado").length;
  const pendientes= docs.filter(d => d.Estado === "Pendiente").length;
  const rechazados= docs.filter(d => d.Estado === "Rechazado").length;

  document.getElementById("rsTotal").textContent = total;
  document.getElementById("rsPend").textContent  = pendientes;
  document.getElementById("rsApro").textContent  = aprobados;
  document.getElementById("rsRech").textContent  = rechazados;
}

window.toggleRevealDocConsulta = function(realVal) {
  const el = document.getElementById("rDocVal");
  if (!el) return;
  if (el.textContent.includes("*")) {
    el.textContent = realVal;
  } else {
    el.textContent = SSTApi.maskDocumento(realVal);
  }
};

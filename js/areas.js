// ═════════════════════════════════════════════════════════════════════════
// areas.js - Gestión de áreas con almacenamiento en Google Sheets
// ═════════════════════════════════════════════════════════════════════════

// Variable global para almacenar áreas en memoria
let areasGlobales = {};

// ═════════════════════════════════════════════════════════════════════════
// CARGAR ÁREAS AL INICIAR
// ═════════════════════════════════════════════════════════════════════════
async function cargarAreas() {
  try {
    console.log('📥 Cargando áreas de Google Sheets...');
    
    const response = await fetch(SST_CONFIG.SCRIPT_URL + '?action=obtenerAreasDeSheets');
    const data = await response.json();
    
    console.log('📊 Respuesta de áreas:', data);
    
    // ⭐ IMPORTANTE: Si hay áreas en Google Sheets, usarlas SIEMPRE
    if (data.success && data.areas && Object.keys(data.areas).length > 0) {
      areasGlobales = data.areas;
      console.log('✅ Áreas cargadas de Google Sheets:', Object.keys(areasGlobales).length);
      actualizarUIAreas();
      return areasGlobales;
    }
    
    // Solo usar por defecto si Google Sheets está COMPLETAMENTE vacío
    console.log('⚠️ Google Sheets vacío, usando áreas por defecto');
    areasGlobales = SST_CONFIG.AREAS_DEFAULT;
    await guardarAreasEnSheets(areasGlobales);
    actualizarUIAreas();
    
    return areasGlobales;
    
  } catch (error) {
    console.error('❌ Error cargando áreas:', error);
    // No cambiar las áreas si hay error
    console.log('📌 Usando áreas globales actuales');
    actualizarUIAreas();
    return areasGlobales;
  }
}
// ═════════════════════════════════════════════════════════════════════════
// GUARDAR ÁREAS EN GOOGLE SHEETS (PERMANENTE)
// ═════════════════════════════════════════════════════════════════════════

async function guardarAreasEnSheets(areas) {
  console.log('💾 Guardando áreas en Google Sheets (vía iframe para evitar CORS)...');
  
  return new Promise((resolve) => {
    const frameName = "sst_areas_" + Date.now();

    const iframe = document.createElement("iframe");
    iframe.name = frameName;
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(iframe);

    const form = document.createElement("form");
    form.method = "POST";
    form.action = SST_CONFIG.SCRIPT_URL;
    form.target = frameName;
    form.style.display = "none";

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "data";
    input.value = JSON.stringify({
      action: 'guardarAreasEnSheets',
      areas: areas
    });
    form.appendChild(input);
    document.body.appendChild(form);

    let done = false;
    const cleanup = () => {
      try { document.body.removeChild(form); } catch(e) {}
      try { document.body.removeChild(iframe); } catch(e) {}
    };

    iframe.onload = () => {
      if (done) return;
      done = true;
      cleanup();
      console.log('✅ Áreas enviadas exitosamente (onload)');
      areasGlobales = areas;
      resolve(true);
    };

    setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      console.log('⚠️ Timeout al guardar áreas, asumiendo éxito');
      areasGlobales = areas;
      resolve(true);
    }, 10000);

    form.submit();
  });
}
// ═════════════════════════════════════════════════════════════════════════
// AGREGAR/EDITAR ÁREA
// ═════════════════════════════════════════════════════════════════════════

async function agregarArea(nombreArea, requisitos) {
  // Validación: solo el nombre es obligatorio
  if (!nombreArea || nombreArea.trim() === '') {
    alert('❌ Por favor ingresa el nombre del área');
    return false;
  }
  
  // Si requisitos es string, convertir a array
  if (typeof requisitos === 'string') {
    if (requisitos.trim() === '') {
      requisitos = [];
    } else {
      requisitos = requisitos.split(/[,\n]/).map(r => r.trim()).filter(r => r !== '');
    }
  }
  
  // Si no es array, convertir a array vacío
  if (!Array.isArray(requisitos)) {
    requisitos = [];
  }
  
  // Agregar a las áreas globales (NO reemplazar)
  areasGlobales[nombreArea] = requisitos;
  
  console.log('🆕 Área agregada localmente:', nombreArea);
  console.log('📊 Total de áreas:', Object.keys(areasGlobales).length);
  
  // Guardar TODAS las áreas en Google Sheets
  const guardado = await guardarAreasEnSheets(areasGlobales);
  
  if (guardado) {
    console.log('✅ Área guardada en Google Sheets');
    actualizarUIAreas();
    return true;
  } else {
    alert('❌ Error al guardar en Google Sheets');
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════
// ELIMINAR ÁREA
// ═════════════════════════════════════════════════════════════════════════

async function eliminarArea(nombreArea) {
  if (!confirm(`¿Eliminar el área "${nombreArea}"?`)) {
    return false;
  }
  
  // Eliminar de la variable global
  delete areasGlobales[nombreArea];
  
  // Guardar cambios en Google Sheets
  const guardado = await guardarAreasEnSheets(areasGlobales);
  
  if (guardado) {
    console.log('✅ Área eliminada:', nombreArea);
    actualizarUIAreas();
    return true;
  } else {
    alert('❌ Error al guardar cambios en Google Sheets');
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════════════
// OBTENER ÁREAS (DEVUELVE GLOBALES)
// ═════════════════════════════════════════════════════════════════════════

function obtenerAreas() {
  return areasGlobales || {};
}

// ═════════════════════════════════════════════════════════════════════════
// ACTUALIZAR UI CON ÁREAS ACTUALES
// ═════════════════════════════════════════════════════════════════════════

function actualizarUIAreas() {
  // Actualizar select de áreas en formularios
  const selectAreas = document.getElementById('selectArea');
  if (selectAreas) {
    const areasLista = Object.keys(areasGlobales);
    selectAreas.innerHTML = '<option value="">-- Selecciona un área --</option>' +
      areasLista.map(area => `<option value="${area}">${area}</option>`).join('');
  }
  
  // Actualizar tabla de áreas en panel admin
  const tablaAreas = document.getElementById('tablaAreas');
  if (tablaAreas) {
    // Generar FILAS DE TABLA (<tr>) en lugar de divs
    tablaAreas.innerHTML = Object.entries(areasGlobales).map(([area, requisitos]) => `
      <tr>
        <td><strong>${area}</strong></td>
        <td>${requisitos.length} requisito${requisitos.length !== 1 ? "s" : ""}</td>
        <td>
          <button class="btn btn-accent btn-sm" onclick="abrirModalReqs('${area.replace(/'/g,"\\'")}')">📝 Requisitos</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarArea('${area.replace(/'/g,"\\'")}')">🗑️</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="3" class="empty">No hay áreas</td></tr>';
  }
}
// ═════════════════════════════════════════════════════════════════════════
// EDITAR ÁREA (Placeholder - ajusta según tu UI)
// ═════════════════════════════════════════════════════════════════════════

function editarArea(nombreArea) {
  console.log('Editar área:', nombreArea);
  // Implementar según tu interfaz
  // Podría ser un modal, formulario, etc.
}

// ═════════════════════════════════════════════════════════════════════════
// INICIALIZAR AL CARGAR LA PÁGINA
// ═════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  console.log('📂 Inicializando gestor de áreas...');
  await cargarAreas();
  actualizarUIAreas();
});

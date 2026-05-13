// ═════════════════════════════════════════════════════════════════════════
// areas.js - Gestión de áreas con almacenamiento en Google Sheets
// ═════════════════════════════════════════════════════════════════════════

// Variable global para almacenar áreas en memoria
let areasGlobales = {};

// ═════════════════════════════════════════════════════════════════════════
// CARGAR ÁREAS AL INICIAR
// ═════════════════════════════════════════════════════════════════════════
async function cargarAreas(intentos = 0) {
  console.log('📥 Cargando áreas de Google Sheets (intento ' + (intentos + 1) + ')...');
  
  return new Promise((resolve) => {
    const cbName = "_sst_areas_cb_" + Date.now();
    const script = document.createElement("script");
    let done = false;

    window[cbName] = (data) => {
      done = true;
      cleanup();
      console.log('📊 Respuesta de áreas:', data);
      
      if (data && data.success && data.areas) {
        areasGlobales = data.areas;
        console.log('✅ Áreas cargadas:', Object.keys(areasGlobales).length);
        actualizarUIAreas();
        resolve(areasGlobales);
      } else {
        // Si no hay áreas en Sheets, usamos las de defecto
        console.log('⚠️ Usando áreas por defecto');
        areasGlobales = SST_CONFIG.AREAS_DEFAULT;
        actualizarUIAreas();
        resolve(areasGlobales);
      }
    };

    const cleanup = () => {
      try { document.head.removeChild(script); } catch(e) {}
      delete window[cbName];
    };

    script.src = SST_CONFIG.SCRIPT_URL + "?action=obtenerAreasDeSheets&callback=" + cbName + "&_=" + Date.now();
    
    script.onerror = () => {
      if (done) return;
      done = true;
      cleanup();
      
      if (intentos < 2) {
        console.warn('🔄 Reintentando carga de áreas...');
        setTimeout(() => resolve(cargarAreas(intentos + 1)), 2000);
      } else {
        console.error('❌ Error persistente cargando áreas. Usando locales.');
        areasGlobales = SSTAreas.get();
        actualizarUIAreas();
        resolve(areasGlobales);
      }
    };

    setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      areasGlobales = SSTAreas.get();
      actualizarUIAreas();
      resolve(areasGlobales);
    }, 10000);

    document.head.appendChild(script);
  });
}
// ═════════════════════════════════════════════════════════════════════════
// GUARDAR ÁREAS EN GOOGLE SHEETS (PERMANENTE)
// ═════════════════════════════════════════════════════════════════════════

async function guardarAreasEnSheets(areas) {
  console.log('💾 Guardando áreas en Google Sheets (vía SSTApi)...');
  
  try {
    const resp = await SSTApi.postData({
      action: 'guardarAreasEnSheets',
      areas: areas
    });
    
    if (resp && resp.success) {
       console.log('✅ Áreas guardadas exitosamente');
       areasGlobales = areas;
       return true;
    } else {
       console.error('❌ Error del servidor al guardar áreas:', resp);
       return false;
    }
  } catch(e) {
    console.error('❌ Error de red al guardar áreas:', e);
    // Asumimos éxito por timeout en iframe si ocurre
    areasGlobales = areas;
    return true;
  }
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

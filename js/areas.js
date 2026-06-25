// areas.js - Gestión de áreas con almacenamiento en Base de Datos (Supabase)

// Variable global para almacenar áreas en memoria
let areasGlobales = {};

// ═════════════════════════════════════════════════════════════════════════
// CARGAR ÁREAS AL INICIAR
// ═════════════════════════════════════════════════════════════════════════
async function cargarAreas(intentos = 0) {
  console.log('📥 Cargando áreas (intento ' + (intentos + 1) + ')...');
  
  if (SST_CONFIG.DEMO_MODE) {
    areasGlobales = SSTAreas.get();
    actualizarUIAreas();
    return areasGlobales;
  }
  
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("areas")
      .select("*")
      .eq("estado", "Activo")
      .order("id", { ascending: true });
      
    if (error) throw error;
    
    // Si no hay áreas en la base de datos, inicializamos con los valores por defecto
    if (!data || data.length === 0) {
      console.log('⚠️ No hay áreas en Supabase. Inicializando con valores por defecto...');
      areasGlobales = SST_CONFIG.AREAS_DEFAULT;
      await guardarAreasEnBaseDatos(areasGlobales);
    } else {
      const areasObj = {};
      data.forEach(row => {
        areasObj[row.area] = row.requisitos;
      });
      areasGlobales = areasObj;
    }
    
    console.log('✅ Áreas cargadas:', Object.keys(areasGlobales).length);
    actualizarUIAreas();
    return areasGlobales;
  } catch (err) {
    console.error('❌ Error cargando áreas de Supabase:', err);
    if (intentos < 2) {
      console.warn('🔄 Reintentando carga de áreas...');
      return new Promise(resolve => {
        setTimeout(async () => {
          resolve(await cargarAreas(intentos + 1));
        }, 2000);
      });
    } else {
      console.error('❌ Error persistente cargando áreas. Usando locales por defecto.');
      areasGlobales = SSTAreas.get();
      actualizarUIAreas();
      return areasGlobales;
    }
  }
}
// ═════════════════════════════════════════════════════════════════════════
// GUARDAR ÁREAS EN SUPABASE (PERMANENTE)
// ═════════════════════════════════════════════════════════════════════════

async function guardarAreasEnBaseDatos(areas) {
  console.log('💾 Guardando áreas en Supabase...');
  
  if (SST_CONFIG.DEMO_MODE) {
    SSTAreas.save(areas);
    areasGlobales = areas;
    return true;
  }
  
  try {
    const client = getSupabaseClient();
    
    // 1. Obtener todas las áreas existentes
    const { data: dbAreas, error: fetchErr } = await client.from("areas").select("id, area");
    if (fetchErr) throw fetchErr;
    
    const areasNombres = Object.keys(areas);
    
    // 2. Encontrar áreas para eliminar
    const idsToDelete = dbAreas
      .filter(row => !areasNombres.includes(row.area))
      .map(row => row.id);
      
    if (idsToDelete.length > 0) {
      const { error: deleteErr } = await client
        .from("areas")
        .delete()
        .in("id", idsToDelete);
      if (deleteErr) throw deleteErr;
    }
    
    // 3. Upsert de las áreas actuales
    const upsertRows = areasNombres.map(name => ({
      area: name,
      requisitos: areas[name],
      estado: 'Activo'
    }));
    
    if (upsertRows.length > 0) {
      const { error: upsertErr } = await client
        .from("areas")
        .upsert(upsertRows, { onConflict: 'area' });
        
      if (upsertErr) throw upsertErr;
    }
    
    console.log('✅ Áreas guardadas exitosamente en Supabase');
    areasGlobales = areas;
    return true;
  } catch (err) {
    console.error('❌ Error al guardar áreas en Supabase:', err);
    return false;
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
  
  // Guardar TODAS las áreas en la Base de Datos
  const guardado = await guardarAreasEnBaseDatos(areasGlobales);
  
  if (guardado) {
    console.log('✅ Área guardada en la Base de Datos');
    actualizarUIAreas();
    return true;
  } else {
    alert('❌ Error al guardar en la Base de Datos');
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
  
  // Guardar cambios en la Base de Datos
  const guardado = await guardarAreasEnBaseDatos(areasGlobales);
  
  if (guardado) {
    console.log('✅ Área eliminada:', nombreArea);
    actualizarUIAreas();
    return true;
  } else {
    alert('❌ Error al guardar cambios en la Base de Datos');
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

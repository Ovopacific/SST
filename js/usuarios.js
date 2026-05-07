/* ═══════════════════════════════════════════════
   PORTAL SST — GESTIÓN DE USUARIOS
═══════════════════════════════════════════════ */

let listaUsuarios = [];
let editandoUsuario = null;

async function renderUsuarios() {
  const tbody = document.getElementById("tablaUsuarios");
  tbody.innerHTML = `<tr><td colspan="4" class="empty">⏳ Cargando usuarios...</td></tr>`;

  try {
    listaUsuarios = await SSTApi.obtenerUsuarios();
    
    if (!listaUsuarios.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty">No hay usuarios registrados (solo admin)</td></tr>`;
      return;
    }

    tbody.innerHTML = listaUsuarios.map(u => {
      const perms = u.permisos.length > 0 ? u.permisos.map(p => capitalizar(p)).join(", ") : "<em>Sin permisos</em>";
      return `
        <tr>
          <td><strong>${u.usuario}</strong></td>
          <td>${perms}</td>
          <td>${fmtFecha(u.fecha)}</td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="editarUsuario('${u.usuario}')">✏️ Editar</button>
            <button class="btn btn-danger btn-sm" onclick="eliminarUsuario('${u.usuario}')">🗑️</button>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">❌ Error al cargar usuarios: ${err.message}</td></tr>`;
  }
}

function abrirModalUsuario() {
  editandoUsuario = null;
  document.getElementById("muTitulo").textContent = "👤 Nuevo Usuario";
  document.getElementById("muNombre").value = "";
  document.getElementById("muNombre").disabled = false;
  document.getElementById("muPassword").value = "";
  document.getElementById("muPassword").required = true;
  document.getElementById("muPwdHint").style.display = "none";
  
  // Limpiar checkboxes
  document.querySelectorAll(".cb-permiso").forEach(cb => cb.checked = false);

  document.getElementById("modalUsuario").classList.add("show");
}

function cerrarModalUsuario() {
  document.getElementById("modalUsuario").classList.remove("show");
  editandoUsuario = null;
}

function editarUsuario(usuarioStr) {
  const u = listaUsuarios.find(us => us.usuario === usuarioStr);
  if (!u) return;

  editandoUsuario = u.usuario;
  document.getElementById("muTitulo").textContent = "✏️ Editar Usuario";
  document.getElementById("muNombre").value = u.usuario;
  document.getElementById("muNombre").disabled = true; // No permitir cambiar nombre de usuario
  document.getElementById("muPassword").value = "";
  document.getElementById("muPassword").required = false; // Contraseña opcional al editar
  document.getElementById("muPwdHint").style.display = "block";

  // Marcar checkboxes según permisos
  document.querySelectorAll(".cb-permiso").forEach(cb => {
    cb.checked = u.permisos.includes(cb.value);
  });

  document.getElementById("modalUsuario").classList.add("show");
}

async function guardarUsuario() {
  const nombre = document.getElementById("muNombre").value.trim();
  let pwd = document.getElementById("muPassword").value;
  
  if (!nombre) {
    Toast.warn("Ingresa un nombre de usuario");
    return;
  }
  
  if (!editandoUsuario && !pwd) {
    Toast.warn("Ingresa una contraseña para el nuevo usuario");
    return;
  }
  
  if (editandoUsuario && !pwd) {
    // Si estamos editando y no se proporciona contraseña, enviamos un marcador para que el backend no la cambie.
    pwd = "***";
  }

  // Recopilar permisos
  const permisos = [];
  document.querySelectorAll(".cb-permiso:checked").forEach(cb => permisos.push(cb.value));

  Loading.show();
  try {
    const res = await SSTApi.guardarUsuarioBackend(nombre, pwd, permisos);
    if (res.success) {
      Toast.ok(res.mensaje || "Usuario guardado exitosamente");
      cerrarModalUsuario();
      renderUsuarios(); // Recargar tabla
    } else {
      Toast.err("Error: " + res.error);
    }
  } catch (err) {
    Toast.err("Error de conexión");
  } finally {
    Loading.hide();
  }
}

async function eliminarUsuario(usuario) {
  if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${usuario}"?`)) return;

  Loading.show();
  try {
    const res = await SSTApi.eliminarUsuarioBackend(usuario);
    console.log("[SST] Respuesta eliminar usuario:", res);
    
    // Recargar lista
    await renderUsuarios();
    
    // Verificación de diagnóstico
    const sigoExistiendo = listaUsuarios.some(u => u.usuario === usuario);
    
    if (sigoExistiendo) {
      if (res._isFallbackSuccess) {
        Toast.err("No se pudo confirmar la eliminación y el usuario persiste. Revisa los permisos del script.");
      } else {
        Toast.err("Error: El usuario no pudo ser eliminado del servidor.");
      }
    } else {
      Toast.ok("Usuario eliminado correctamente");
    }

  } catch (err) {
    Toast.err("Error de conexión al eliminar: " + err.message);
  } finally {
    Loading.hide();
  }
}

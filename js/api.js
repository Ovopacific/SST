

// ── AUXILIARES DE SUPABASE ──────────────────
let _supabaseInstance = null;
function getSupabaseClient() {
  if (_supabaseInstance) return _supabaseInstance;
  if (typeof supabase === "undefined") {
    throw new Error("El SDK de Supabase no está cargado. Asegúrate de incluir <script src=\"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2\"></script> en tu HTML.");
  }
  if (!SST_CONFIG.SUPABASE_URL || !SST_CONFIG.SUPABASE_KEY || SST_CONFIG.SUPABASE_URL.includes("ESCRIBE_AQUI")) {
    throw new Error("Supabase no está configurado. Por favor, edita js/config.js con tu URL y anon API Key.");
  }
  _supabaseInstance = supabase.createClient(SST_CONFIG.SUPABASE_URL, SST_CONFIG.SUPABASE_KEY);
  return _supabaseInstance;
}

function base64ToBlob(base64, mimeType = 'application/pdf') {
  try {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  } catch (e) {
    console.error("Error decodificando base64 a Blob:", e);
    throw new Error("El archivo está corrupto o no se pudo decodificar correctamente.");
  }
}

function getMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default: return 'application/octet-stream';
  }
}

const SSTApi = {

  // ── CONTROLADOR DE MODO DEMO ────────────────
  _demoHandler(action, params) {
    console.warn("Modo demo deshabilitado.");
    return { success: false, error: "Modo demo deshabilitado" };
  },

  // ── ENCRIPTACIÓN (MIGRADA AL BACKEND) ─────────────
  encrypt(texto) {
    // La encriptación ahora la maneja de forma segura el backend
    return texto;
  },

  decrypt(cifrado) {
    // El backend ahora envía los datos ya listos, no hay que desencriptar localmente
    return cifrado;
  },

  // ── LEER REGISTROS — SUPABASE ──────────────────
  async getRegistros(filtros = null) {
    if (SST_CONFIG.DEMO_MODE) {
      return this._demoHandler("getRegistros", filtros);
    }

    try {
      const client = getSupabaseClient();
      let rows = [];

      if (filtros && filtros.cedula) {
        // Consulta anónima segura mediante función RPC para evitar exposición de toda la tabla
        const { data, error } = await client.rpc("consultar_documentos_proveedor", {
          p_cedula: filtros.cedula.trim(),
          p_proveedor: filtros.proveedor ? filtros.proveedor.trim() : ""
        });
        if (error) throw error;
        rows = data || [];
      } else {
        // Consulta del panel administrativo (autenticado)
        const { data, error } = await client
          .from("registros")
          .select("*")
          .order("id", { ascending: true });
        if (error) throw error;
        rows = data || [];
      }

      // Mapear a propiedades del frontend
      return rows.map(row => ({
        Timestamp: row.created_at,
        Proveedor: row.proveedor,
        Nombre: row.nombre,
        Documento: row.documento,
        Empresa: row.empresa,
        Área: row.area,
        Requisito: row.requisito,
        "Nombre Archivo": row.nombre_archivo,
        "URL Documento": row.url_documento,
        "Fecha Carga": row.created_at,
        Estado: row.estado,
        Comentarios: row.comentarios || "",
        Fila: row.id
      }));
    } catch (err) {
      console.error("[Supabase API] Error en getRegistros:", err);
      throw err;
    }
  },

  // ── DEPRECADO — MANTENIDO PARA COMPATIBILIDAD ──
  postData(datos) {
    if (SST_CONFIG.DEMO_MODE) {
      return Promise.resolve(this._demoHandler(datos.action, datos));
    }
    console.warn("postData está deprecado. Las llamadas se dirigen ahora a Supabase.");
    return Promise.resolve({ success: false, error: "postData deprecado" });
  },

  // ── GUARDAR DOCUMENTO ───────────────────────
  async guardarDocumento(datos) {
    if (SST_CONFIG.DEMO_MODE) {
      return this._demoHandler("guardarDocumento", datos);
    }

    try {
      const client = getSupabaseClient();

      // 1. Decodificar Base64 a Blob para subir a Supabase Storage
      const base64 = datos.base64 || datos.ArchivoBase64;
      const nombreArchivo = datos.nombreArchivo || datos.NombreArchivo;

      if (!base64) {
        throw new Error("No se proporcionó el archivo en base64.");
      }

      const fileMime = getMimeType(nombreArchivo);
      const blob = base64ToBlob(base64, fileMime);

      // Crear un nombre único de archivo para evitar colisiones
      const timestamp = Date.now();
      const cleanProveedor = (datos.proveedor || datos.Proveedor || "prov").replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const storagePath = `${cleanProveedor}/${timestamp}_${nombreArchivo}`;

      // Subir archivo al bucket 'documentos_sst'
      const { data: uploadData, error: uploadError } = await client.storage
        .from("documentos_sst")
        .upload(storagePath, blob, {
          contentType: fileMime,
          upsert: true
        });

      if (uploadError) {
        console.error("[Supabase Storage] Error al subir archivo:", uploadError);
        throw uploadError;
      }

      // Obtener la URL pública del archivo subido
      const { data: urlData } = client.storage
        .from("documentos_sst")
        .getPublicUrl(storagePath);

      const urlDocumento = urlData.publicUrl;

      // 2. Insertar metadatos en la tabla 'registros'
      const registroDB = {
        proveedor: datos.proveedor || datos.Proveedor,
        nombre: datos.responsable || datos.Nombre,
        documento: datos.documento || datos.Documento,
        empresa: datos.empresa || datos.Empresa,
        area: datos.area || datos.Área,
        requisito: datos.requisito || datos.Requisito,
        nombre_archivo: nombreArchivo,
        url_documento: urlDocumento,
        estado: datos.estado || datos.Estado || "Pendiente",
        comentarios: datos.comentarios || datos.Comentarios || ""
      };

      const { data: insertData, error: insertError } = await client
        .from("registros")
        .insert([registroDB])
        .select();

      if (insertError) {
        console.error("[Supabase DB] Error al insertar registro:", insertError);
        // Intentar borrar el archivo subido si falla la base de datos
        await client.storage.from("documentos_sst").remove([storagePath]);
        throw insertError;
      }

      return { success: true, registros: insertData };
    } catch (err) {
      console.error("[Supabase API] Error en guardarDocumento:", err);
      return { success: false, error: err.message };
    }
  },

  // ── ACTUALIZAR ESTADO ───────────────────────
  async actualizarEstado(datos) {
    if (SST_CONFIG.DEMO_MODE) {
      return this._demoHandler("actualizarEstado", datos);
    }

    try {
      const client = getSupabaseClient();
      const filaId = parseInt(datos.fila || datos.Fila);

      if (isNaN(filaId)) {
        throw new Error("ID de fila inválido.");
      }

      const { error } = await client
        .from("registros")
        .update({
          estado: datos.estado || datos.Estado,
          comentarios: datos.comentarios || datos.Comentarios || ""
        })
        .eq("id", filaId);

      if (error) throw error;

      return { success: true };
    } catch (err) {
      console.error("[Supabase API] Error en actualizarEstado:", err);
      return { success: false, error: err.message };
    }
  },

  // ── ARCHIVO → BASE64 ────────────────────────
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // ── VERIFICAR PASSWORD ──────────────────────
  async verificarPassword(usuario, pwd) {
    if (SST_CONFIG.DEMO_MODE) {
      return this._demoHandler("verificarPassword", { usuario, pwd });
    }

    try {
      const client = getSupabaseClient();
      let email = usuario.trim();

      // Si ingresa solo un nombre de usuario (ej: admin), le agregamos un dominio por defecto para Supabase Auth
      if (!email.includes("@")) {
        email += "@ovopacific.com";
      }

      const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: pwd
      });

      if (error) {
        return { success: false, error: "Credenciales inválidas en Supabase Auth: " + error.message };
      }

      return {
        success: true,
        rol: "admin",
        permisos: ["dashboard", "documentos", "areas", "proveedores", "usuarios"],
        token: data.session.access_token
      };
    } catch (err) {
      console.error("[Supabase API] Error en verificarPassword:", err);
      return { success: false, error: err.message };
    }
  },

  // ── OBTENER USUARIOS ────────────────────────
  async obtenerUsuarios() {
    if (SST_CONFIG.DEMO_MODE) {
      return this._demoHandler("obtenerUsuarios", null);
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from("usuarios")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (err) {
      console.error("[Supabase API] Error en obtenerUsuarios:", err);
      throw err;
    }
  },

  // ── GUARDAR USUARIO ─────────────────────────
  async guardarUsuarioBackend(usuario, pwd, permisos) {
    if (SST_CONFIG.DEMO_MODE) {
      return this._demoHandler("guardarUsuario", { usuario, pwd, permisos });
    }

    try {
      const client = getSupabaseClient();
      const u = usuario.toLowerCase().trim();
      const per = permisos || [];

      const { data: existingUser } = await client
        .from("usuarios")
        .select("id")
        .eq("usuario", u)
        .maybeSingle();

      if (existingUser) {
        const updateData = { permisos: per };
        if (pwd && pwd.trim() !== "") {
          updateData.pwd = pwd;
        }

        const { error } = await client
          .from("usuarios")
          .update(updateData)
          .eq("usuario", u);

        if (error) throw error;
      } else {
        const { error } = await client
          .from("usuarios")
          .insert([{
            usuario: u,
            pwd: pwd || "1234",
            rol: "visor",
            permisos: per
          }]);

        if (error) throw error;
      }

      return { success: true };
    } catch (err) {
      console.error("[Supabase API] Error en guardarUsuarioBackend:", err);
      return { success: false, error: err.message };
    }
  },

  // ── ELIMINAR USUARIO ────────────────────────
  async eliminarUsuarioBackend(usuario) {
    if (SST_CONFIG.DEMO_MODE) {
      return this._demoHandler("eliminarUsuario", { usuario });
    }

    try {
      const client = getSupabaseClient();
      const u = usuario.toLowerCase().trim();

      if (u === "admin") {
        throw new Error("No se puede eliminar el usuario administrador principal.");
      }

      const { error } = await client
        .from("usuarios")
        .delete()
        .eq("usuario", u);

      if (error) throw error;

      return { success: true };
    } catch (err) {
      console.error("[Supabase API] Error en eliminarUsuarioBackend:", err);
      return { success: false, error: err.message };
    }
  },

  // ── ELIMINAR DOCUMENTO ──────────────────────
  async eliminarDocumento(datos) {
    if (SST_CONFIG.DEMO_MODE) {
      return this._demoHandler("eliminarDocumento", datos);
    }

    try {
      const client = getSupabaseClient();
      const filaId = parseInt(datos.fila || datos.Fila);

      if (isNaN(filaId)) {
        throw new Error("ID de fila inválido para eliminar.");
      }

      const { data: docData } = await client
        .from("registros")
        .select("url_documento")
        .eq("id", filaId)
        .maybeSingle();

      if (docData && docData.url_documento) {
        try {
          const parts = docData.url_documento.split('/documentos_sst/');
          if (parts.length > 1) {
            const storagePath = decodeURIComponent(parts[1]);
            await client.storage.from("documentos_sst").remove([storagePath]);
          }
        } catch (storageErr) {
          console.warn("[Supabase Storage] No se pudo borrar el archivo:", storageErr);
        }
      }

      const { error } = await client
        .from("registros")
        .delete()
        .eq("id", filaId);

      if (error) throw error;

      return { success: true };
    } catch (err) {
      console.error("[Supabase API] Error en eliminarDocumento:", err);
      return { success: false, error: err.message };
    }
  },


  // ── SANITIZACIÓN HTML (PREVENIR XSS) ────────
  escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  // ── ENMASCARAMIENTO ─────────────────────────
  maskDocumento(texto) {
    if (!texto) return "—";
    const s = String(texto).trim();
    if (s.length <= 4) return s; // muy corto para mascarear
    return s.substring(0, 3) + "****" + s.substring(s.length - 2);
  }
};

/* ── ÁREAS ──────────────────────────────────── */
const SSTAreas = {
  get() {
    try {
      const s = localStorage.getItem("areasSST");
      return s ? JSON.parse(s) : JSON.parse(JSON.stringify(SST_CONFIG.AREAS_DEFAULT));
    } catch (e) {
      return JSON.parse(JSON.stringify(SST_CONFIG.AREAS_DEFAULT));
    }
  },
  save(areas) { localStorage.setItem("areasSST", JSON.stringify(areas)); },
  init() { if (!localStorage.getItem("areasSST")) this.save(JSON.parse(JSON.stringify(SST_CONFIG.AREAS_DEFAULT))); }
};

/* ── TOAST ──────────────────────────────────── */
const Toast = {
  _wrap: null,
  init() {
    this._wrap = document.createElement("div");
    this._wrap.className = "toast-wrap";
    document.body.appendChild(this._wrap);
  },
  show(msg, tipo = "info", ms = 4000) {
    if (!this._wrap) this.init();
    const el = document.createElement("div");
    el.className = "toast-item " + tipo;
    el.innerHTML = msg;
    this._wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(100%)";
      el.style.transition = "all 0.3s ease";
      setTimeout(() => el.remove(), 300);
    }, ms);
  },
  ok(msg) { this.show(msg, "success"); },
  err(msg, ms = 6000) { this.show(msg, "error", ms); },
  info(msg) { this.show(msg, "info"); },
  warn(msg) { this.show(msg, "warning"); }
};

/* ── LOADING ────────────────────────────────── */
const Loading = {
  _el: null,
  init() { this._el = document.getElementById("overlayLoading"); },
  show() { if (this._el) this._el.classList.add("show"); },
  hide() { if (this._el) this._el.classList.remove("show"); }
};

/* ── FECHA ──────────────────────────────────── */
function fmtFecha(val) {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleDateString("es-CO", {
      year: "numeric", month: "short", day: "numeric"
    });
  } catch (e) { return String(val); }
}

/* ── INIT ───────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  Toast.init();
  Loading.init();
  SSTAreas.init();
});

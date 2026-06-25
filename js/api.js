/* ═══════════════════════════════════════════════
   PORTAL SST — CAPA DE API
   
   ⚠️ CORS con GitHub Pages + GAS:
   - fetch() → BLOQUEADO por CORS (GAS redirige)
   - XHR     → BLOQUEADO igual
   - JSONP (script tag) → ✅ FUNCIONA siempre
   - Form + iframe      → ✅ FUNCIONA para POST
═══════════════════════════════════════════════ */

const SSTApi = {

  // ── CONTROLADOR DE MODO DEMO ────────────────
  _demoHandler(action, params) {
    if (!localStorage.getItem("sst_demo_registros")) {
      localStorage.setItem("sst_demo_registros", JSON.stringify([
        {
          Timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
          Proveedor: "Servicios Hidráulicos SAS",
          Nombre: "Juan Carlos Pérez",
          Documento: "10203040",
          Empresa: "Hidra SAS",
          Área: "Caldera",
          Requisito: "Certificado de capacitación en calderas",
          "Nombre Archivo": "certificado_juan.pdf",
          "URL Documento": "#",
          "Fecha Carga": new Date(Date.now() - 3600000 * 2).toISOString(),
          Estado: "Pendiente",
          Comentarios: "",
          Fila: 2
        },
        {
          Timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
          Proveedor: "Eléctricos del Pacífico",
          Nombre: "María Camila Díaz",
          Documento: "98765432",
          Empresa: "Díaz Eléctricos",
          Área: "Mantenimiento",
          Requisito: "Licencia técnica actualizada",
          "Nombre Archivo": "licencia_tecnica.pdf",
          "URL Documento": "#",
          "Fecha Carga": new Date(Date.now() - 3600000 * 5).toISOString(),
          Estado: "Aprobado",
          Comentarios: "Documento al día.",
          Fila: 3
        }
      ]));
    }
    if (!localStorage.getItem("sst_demo_usuarios")) {
      localStorage.setItem("sst_demo_usuarios", JSON.stringify([
        { usuario: "admin", rol: "admin", permisos: ["dashboard", "documentos", "areas", "proveedores", "usuarios"] },
        { usuario: "visor", rol: "visor", permisos: ["dashboard", "documentos"] }
      ]));
    }
    
    if (action === "getRegistros") {
      let regs = JSON.parse(localStorage.getItem("sst_demo_registros"));
      if (params && params.cedula) {
        regs = regs.filter(r => r.Documento === params.cedula);
      }
      return regs;
    }
    
    if (action === "guardarDocumento") {
      let regs = JSON.parse(localStorage.getItem("sst_demo_registros"));
      let nuevo = {
        Timestamp: new Date().toISOString(),
        Proveedor: params.proveedor || params.Proveedor,
        Nombre: params.responsable || params.Nombre,
        Documento: params.documento || params.Documento,
        Empresa: params.empresa || params.Empresa,
        Área: params.area || params.Área,
        Requisito: params.requisito || params.Requisito,
        "Nombre Archivo": params.nombreArchivo || params.NombreArchivo,
        "URL Documento": "#",
        "Fecha Carga": new Date().toISOString(),
        Estado: "Pendiente",
        Comentarios: "",
        Fila: regs.length + 2
      };
      regs.push(nuevo);
      localStorage.setItem("sst_demo_registros", JSON.stringify(regs));
      return { success: true };
    }
    
    if (action === "actualizarEstado") {
      let regs = JSON.parse(localStorage.getItem("sst_demo_registros"));
      let filaNum = parseInt(params.fila || params.Fila);
      let encontrado = false;
      for (let i = 0; i < regs.length; i++) {
        if (regs[i].Fila === filaNum) {
          regs[i].Estado = params.estado || params.Estado;
          regs[i].Comentarios = params.comentarios || params.Comentarios || "";
          encontrado = true;
          break;
        }
      }
      localStorage.setItem("sst_demo_registros", JSON.stringify(regs));
      return { success: encontrado, error: encontrado ? "" : "Registro no encontrado" };
    }
    
    if (action === "eliminarDocumento") {
      let regs = JSON.parse(localStorage.getItem("sst_demo_registros"));
      let filaNum = parseInt(params.fila || params.Fila);
      regs = regs.filter(r => r.Fila !== filaNum);
      regs.forEach((r, idx) => r.Fila = idx + 2);
      localStorage.setItem("sst_demo_registros", JSON.stringify(regs));
      return { success: true };
    }
    
    if (action === "verificarPassword") {
      let usrs = JSON.parse(localStorage.getItem("sst_demo_usuarios"));
      let u = params.usuario.toLowerCase().trim();
      if (u === "admin" && params.pwd === "admin") {
        return { success: true, rol: "admin", permisos: ["dashboard", "documentos", "areas", "proveedores", "usuarios"], token: "demo-token" };
      }
      let found = usrs.find(x => x.usuario.toLowerCase() === u && params.pwd === "1234");
      if (found) {
        return { success: true, rol: found.rol, permisos: found.permisos, token: "demo-token" };
      }
      return { success: false, error: "Usuario/pwd demo incorrecto. Usa admin/admin o 1234" };
    }
    
    if (action === "obtenerUsuarios") {
      return JSON.parse(localStorage.getItem("sst_demo_usuarios"));
    }
    
    if (action === "guardarUsuario") {
      let usrs = JSON.parse(localStorage.getItem("sst_demo_usuarios"));
      let u = params.usuario.toLowerCase().trim();
      let per = params.permisos || [];
      let index = usrs.findIndex(x => x.usuario.toLowerCase() === u);
      if (index !== -1) {
        usrs[index].permisos = per;
      } else {
        usrs.push({ usuario: params.usuario, rol: "visor", permisos: per });
      }
      localStorage.setItem("sst_demo_usuarios", JSON.stringify(usrs));
      return { success: true };
    }
    
    if (action === "eliminarUsuario") {
      let usrs = JSON.parse(localStorage.getItem("sst_demo_usuarios"));
      usrs = usrs.filter(x => x.usuario.toLowerCase() !== params.usuario.toLowerCase());
      localStorage.setItem("sst_demo_usuarios", JSON.stringify(usrs));
      return { success: true };
    }
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

  // ── LEER REGISTROS — JSONP ──────────────────
  // La única técnica que funciona desde GitHub Pages / cualquier dominio.
  // Inyecta un <script src="GAS_URL?callback=fn"> — el navegador
  // lo carga sin restricciones CORS y GAS envuelve la respuesta en fn({...}).
  getRegistros(filtros = null) {
    if (SST_CONFIG.DEMO_MODE) {
      return Promise.resolve(this._demoHandler("getRegistros", filtros));
    }
    return new Promise((resolve, reject) => {
      const cbName = "_sst_cb_" + Date.now();
      const script = document.createElement("script");
      let done = false;

      // GAS llamará esta función con los datos
      window[cbName] = (data) => {
        if (done) {
          // Si ya terminó (por timeout), simplemente nos limpiamos
          delete window[cbName];
          return;
        }
        done = true;
        cleanup();
        if (data && (data.success || data.registros)) {
          resolve(data.registros || []);
        } else {
          reject(new Error(data?.error || "Respuesta inválida del servidor"));
        }
      };

      const cleanup = () => {
        try { document.head.removeChild(script); } catch(e) {}
        // No borramos window[cbName] aquí para evitar ReferenceError si el script llega tarde
      };

      let urlParams = "?action=obtenerRegistros"
        + "&callback=" + cbName
        + "&_=" + Date.now();
        
      if (filtros && filtros.cedula) {
        urlParams += "&cedula=" + encodeURIComponent(filtros.cedula) 
                   + "&proveedor=" + encodeURIComponent(filtros.proveedor || "");
      }

      script.src = SST_CONFIG.SCRIPT_URL + urlParams;
      script.onerror = () => {
        if (done) return;
        done = true;
        cleanup();
        delete window[cbName]; // Aquí sí podemos borrarlo
        reject(new Error(
          "No se pudo cargar el script de GAS.\n" +
          "Verifica que el despliegue tenga acceso: 'Cualquier persona'."
        ));
      };

      // Timeout 30 segundos (a veces GAS es lento si hay muchos datos)
      setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        // Dejamos una función vacía que se auto-elimine para evitar ReferenceError
        const originalCb = window[cbName];
        window[cbName] = () => { delete window[cbName]; };
        reject(new Error("Tiempo de espera agotado (30s). El servidor no respondió."));
      }, 30000);

      document.head.appendChild(script);
    });
  },

  // ── ENVIAR DATOS — Form + Iframe ────────────
  // GAS redirige → fetch/XHR falla por CORS.
  // Form nativo al iframe: el navegador envía sin restricciones.
  postData(datos) {
    if (SST_CONFIG.DEMO_MODE) {
      return Promise.resolve(this._demoHandler(datos.action, datos));
    }
    return new Promise((resolve) => {
      // Inyectar el token de sesión si existe
      const token = sessionStorage.getItem("sst_token");
      if (token) datos.token = token;

      const frameName = "sst_" + Date.now();
      console.group("[SST API] Enviando POST");
      console.log("Acción:", datos.action);
      console.log("Datos:", datos);

      const iframe = document.createElement("iframe");
      iframe.name  = frameName;
      iframe.id    = frameName;
      iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden;";
      document.body.appendChild(iframe);

      const form  = document.createElement("form");
      form.method = "POST";
      form.action = SST_CONFIG.SCRIPT_URL;
      form.target = frameName;
      form.style.display = "none";

      const input = document.createElement("input");
      input.type  = "hidden";
      input.name  = "data";
      input.value = JSON.stringify(datos);
      form.appendChild(input);
      document.body.appendChild(form);

      let done = false;
      const cleanup = () => {
        try { document.body.removeChild(form);   } catch(e) {}
        try { document.body.removeChild(iframe); } catch(e) {}
        console.groupEnd();
      };

      iframe.onload = () => {
        if (done) return;
        done = true;
        let respuesta = null;
        try {
          // Intentamos leer la respuesta del iframe
          // Si el script está en el mismo dominio o si GAS responde con HTML simple,
          // a veces se puede leer el innerText.
          const doc = iframe.contentDocument || iframe.contentWindow.document;
          const txt = doc.body.innerText || "";
          const m   = txt.match(/\{[\s\S]*\}/);
          if (m) respuesta = JSON.parse(m[0]);
        } catch(e) {
          // Cross-origin: No podemos leer la respuesta, pero el onload
          // significa que el servidor respondió (incluso si fue un error).
          console.log("[SST API] Respuesta recibida (sin acceso por CORS)");
        }
        cleanup();
        
        if (respuesta) {
          console.log("[SST API] Respuesta parseada:", respuesta);
          resolve(respuesta);
        } else {
          // Si no podemos leer la respuesta, asumimos éxito pero marcamos como fallback
          console.warn("[SST API] Resolviendo con Fallback Success");
          resolve({ success: true, éxito: true, _isFallbackSuccess: true });
        }
      };

      // Timeout 30s (GAS puede ser lento con archivos o locks)
      setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        console.warn("[SST API] Timeout en postData, asumiendo éxito por precaución");
        resolve({ success: true, éxito: true, _timeout: true, _isFallbackSuccess: true });
      }, 30000);

      form.submit();
    });
  },

  // ── GUARDAR DOCUMENTO ───────────────────────
  async guardarDocumento(datos) {
    return await this.postData({
      action:         "guardarDocumento",
      nombreProveedor: datos.proveedor,
      area:            datos.area,
      Proveedor:       datos.proveedor,
      Nombre:          datos.responsable,
      Documento:       datos.documento || datos.Documento,
      Empresa:         datos.empresa,
      Área:            datos.area,
      Requisito:       datos.requisito,
      NombreArchivo:   datos.nombreArchivo,
      ArchivoBase64:   datos.base64,
      FechaCarga:      new Date().toISOString(),
      Estado:          "Pendiente"
    });
  },

  // ── ACTUALIZAR ESTADO ───────────────────────
  async actualizarEstado(datos) {
    return await this.postData({
      action:      "actualizarEstado",
      Proveedor:   datos.proveedor,
      Documento:   datos.documento,
      Requisito:   datos.requisito,
      Área:        datos.area,
      Estado:      datos.estado,
      Comentarios: datos.comentarios || "",
      Fila:        datos.fila || ""
    });
  },

  // ── ARCHIVO → BASE64 ────────────────────────
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // ── VERIFICAR PASSWORD (LOGIN SECRETO) ──────
  verificarPassword(usuario, pwd) {
    if (SST_CONFIG.DEMO_MODE) {
      return Promise.resolve(this._demoHandler("verificarPassword", { usuario, pwd }));
    }
    return new Promise((resolve) => {
      const cbName = "_sst_login_" + Date.now();
      const script = document.createElement("script");
      let done = false;

      window[cbName] = (data) => {
        done = true;
        cleanup();
        resolve(data);
      };

      const cleanup = () => {
        try { document.head.removeChild(script); } catch(e) {}
        delete window[cbName];
      };

      script.src = SST_CONFIG.SCRIPT_URL
        + "?action=verificarPassword"
        + "&usuario=" + encodeURIComponent(usuario)
        + "&pwd=" + encodeURIComponent(pwd)
        + "&callback=" + cbName
        + "&_=" + Date.now();
      
      script.onerror = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve({ success: false, error: "Error de red al conectar" });
      };

      setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        resolve({ success: false, error: "Tiempo de espera agotado" });
      }, 10000);

      document.head.appendChild(script);
    });
  },

  // ── OBTENER USUARIOS ────────────────────────
  obtenerUsuarios() {
    if (SST_CONFIG.DEMO_MODE) {
      return Promise.resolve(this._demoHandler("obtenerUsuarios", null));
    }
    return new Promise((resolve, reject) => {
      const cbName = "_sst_usr_" + Date.now();
      const script = document.createElement("script");
      let done = false;

      window[cbName] = (data) => {
        done = true;
        cleanup();
        if (data && data.success) {
          resolve(data.usuarios || []);
        } else {
          reject(new Error(data?.error || "Error al obtener usuarios"));
        }
      };

      const cleanup = () => {
        try { document.head.removeChild(script); } catch(e) {}
        delete window[cbName];
      };

      script.src = SST_CONFIG.SCRIPT_URL
        + "?action=obtenerUsuarios"
        + "&callback=" + cbName
        + "&_=" + Date.now();
      
      script.onerror = () => reject(new Error("Error de red"));
      setTimeout(() => reject(new Error("Timeout")), 15000);
      document.head.appendChild(script);
    });
  },

  // ── GUARDAR USUARIO ─────────────────────────
  async guardarUsuarioBackend(usuario, pwd, permisos) {
    return await this.postData({
      action: "guardarUsuario",
      usuario: usuario,
      pwd: pwd,
      permisos: permisos
    });
  },

  // ── ELIMINAR USUARIO ────────────────────────
  async eliminarUsuarioBackend(usuario) {
    return await this.postData({
      action: "eliminarUsuario",
      usuario: usuario
    });
  },

  // ── ELIMINAR DOCUMENTO ──────────────────────
  async eliminarDocumento(datos) {
    return await this.postData({
      action:    "eliminarDocumento",
      Fila:      datos.fila      || "",
      Proveedor: datos.proveedor || "",
      Requisito: datos.requisito || "",
      Área:      datos.area      || ""
    });
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
    } catch(e) {
      return JSON.parse(JSON.stringify(SST_CONFIG.AREAS_DEFAULT));
    }
  },
  save(areas) { localStorage.setItem("areasSST", JSON.stringify(areas)); },
  init()      { if (!localStorage.getItem("areasSST")) this.save(JSON.parse(JSON.stringify(SST_CONFIG.AREAS_DEFAULT))); }
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
    el.className   = "toast-item " + tipo;
    el.innerHTML   = msg;
    this._wrap.appendChild(el);
    setTimeout(() => {
      el.style.opacity   = "0";
      el.style.transform = "translateX(100%)";
      el.style.transition = "all 0.3s ease";
      setTimeout(() => el.remove(), 300);
    }, ms);
  },
  ok(msg)   { this.show(msg, "success"); },
  err(msg, ms=6000) { this.show(msg, "error", ms); },
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
  } catch(e) { return String(val); }
}

/* ── INIT ───────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  Toast.init();
  Loading.init();
  SSTAreas.init();
});

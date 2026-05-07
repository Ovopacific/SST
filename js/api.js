/* ═══════════════════════════════════════════════
   PORTAL SST — CAPA DE API
   
   ⚠️ CORS con GitHub Pages + GAS:
   - fetch() → BLOQUEADO por CORS (GAS redirige)
   - XHR     → BLOQUEADO igual
   - JSONP (script tag) → ✅ FUNCIONA siempre
   - Form + iframe      → ✅ FUNCIONA para POST
═══════════════════════════════════════════════ */

const SSTApi = {

  // ── ENCRIPTACIÓN (CryptoJS AES) ─────────────
  encrypt(texto) {
    if (!texto) return "";
    try {
      return CryptoJS.AES.encrypt(String(texto), SST_CONFIG.ENCRYPTION_KEY).toString();
    } catch (e) {
      console.error("Encryption error:", e);
      return texto;
    }
  },

  decrypt(cifrado) {
    if (!cifrado) return "";
    try {
      const bytes = CryptoJS.AES.decrypt(String(cifrado), SST_CONFIG.ENCRYPTION_KEY);
      const original = bytes.toString(CryptoJS.enc.Utf8);
      return original || cifrado; // fallback si falla la llave
    } catch (e) {
      console.error("Decryption error:", e);
      return cifrado;
    }
  },

  // ── LEER REGISTROS — JSONP ──────────────────
  // La única técnica que funciona desde GitHub Pages / cualquier dominio.
  // Inyecta un <script src="GAS_URL?callback=fn"> — el navegador
  // lo carga sin restricciones CORS y GAS envuelve la respuesta en fn({...}).
  getRegistros() {
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

      script.src = SST_CONFIG.SCRIPT_URL
        + "?action=obtenerRegistros"
        + "&callback=" + cbName
        + "&_=" + Date.now(); // evitar caché
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
    return new Promise((resolve) => {
      const frameName = "sst_" + Date.now();
      console.log("[SST API] Enviando POST:", datos);

      const iframe = document.createElement("iframe");
      iframe.name  = frameName;
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
      };

      iframe.onload = () => {
        if (done) return;
        done = true;
        let respuesta = null;
        try {
          const txt = iframe.contentDocument.body.innerText || "";
          const m   = txt.match(/\{[\s\S]*\}/);
          if (m) respuesta = JSON.parse(m[0]);
        } catch(e) {
          // cross-origin: no podemos leer → el dato sí llegó (probablemente)
        }
        cleanup();
        if (respuesta) {
          resolve(respuesta);
        } else {
          // Si no podemos leer la respuesta, devolvemos éxito con un flag de advertencia
          resolve({ success: true, éxito: true, _isFallbackSuccess: true });
        }
      };

      // Timeout 16s
      setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        console.warn("[SST API] Timeout en postData, asumiendo éxito (fallback)");
        resolve({ success: true, éxito: true, _timeout: true, _isFallbackSuccess: true });
      }, 16000);

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
      Documento:       datos.documento,
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

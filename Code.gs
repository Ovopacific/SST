/* ═══════════════════════════════════════════════════════════════
   PORTAL SST — GOOGLE APPS SCRIPT BACKEND (VERSIÓN SEGURA)
   Actualizado con Tokens, Encriptación en Servidor y Filtros.
═══════════════════════════════════════════════════════════════ */

var SPREADSHEET_ID   = "1WAVH0vK5f9o06KZ5BHiIG4S8mytgDrzLVTudpvHjIwQ";
var CARPETA_DRIVE_ID = "1L7NZNyt6UTvmCvcXSBL3PLeHGjFFqxkE";
var NOMBRE_HOJA      = "Registros";
var NOMBRE_HOJA_USUARIOS = "Usuarios";

// Contraseña segura del SUPER ADMIN
var ADMIN_PASSWORD_BACKEND = "Ovopacific2026$%@";

// Llaves de seguridad (¡NO MOSTRAR AL FRONTEND!)
var SECRET_TOKEN_SALT = "Ovopacific_Secure_Token_2026_xYz"; 
var ENCRYPTION_KEY    = "SST_OVO_2026_SECURE_KEY";

var COLUMNAS = [
  "Timestamp", "Proveedor", "Nombre", "Documento", "Empresa",
  "Área", "Requisito", "Nombre Archivo", "URL Documento",
  "Fecha Carga", "Estado", "Comentarios", "Fila"
];

/* ──────────────────────────────────────────────
   SISTEMA DE SEGURIDAD (ENCRIPTACIÓN Y TOKENS)
────────────────────────────────────────────── */

// Cargador de CryptoJS para mantener la compatibilidad con los datos viejos
var _cryptoJSLoaded = false;
function loadCryptoJS() {
  if (!_cryptoJSLoaded) {
    eval(UrlFetchApp.fetch('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js').getContentText());
    _cryptoJSLoaded = true;
  }
}

function encriptarDoc(texto) {
  if (!texto) return "";
  loadCryptoJS();
  return CryptoJS.AES.encrypt(String(texto), ENCRYPTION_KEY).toString();
}

function desencriptarDoc(cifrado) {
  if (!cifrado) return "";
  try {
    loadCryptoJS();
    var bytes = CryptoJS.AES.decrypt(String(cifrado), ENCRYPTION_KEY);
    var original = bytes.toString(CryptoJS.enc.Utf8);
    return original || cifrado; // fallback
  } catch (e) {
    return cifrado;
  }
}

function generarToken(usuario) {
  var data = usuario + "|" + new Date().getTime() + "|" + SECRET_TOKEN_SALT;
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data));
}

function esTokenValido(token) {
  // Validación básica: que exista y tenga longitud razonable
  return token && token.length > 20; 
}

/* ──────────────────────────────────────────────
   CORS HEADERS
────────────────────────────────────────────── */
function setCorsHeaders(output) {
  return output.setMimeType(ContentService.MimeType.JSON);
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ──────────────────────────────────────────────
   doGet — LEER REGISTROS Y VERIFICAR PASSWORD
────────────────────────────────────────────── */
function doGet(e) {
  try {
    var action   = (e.parameter && e.parameter.action)   ? e.parameter.action   : "";
    var callback = (e.parameter && e.parameter.callback) ? e.parameter.callback : "";

    var resultado;
    
    if (action === "obtenerRegistros" || action === "") {
      var cedulaFiltro = e.parameter.cedula;
      var proveedorFiltro = e.parameter.proveedor;
      resultado = obtenerRegistros(cedulaFiltro, proveedorFiltro);
      
    } else if (action === "obtenerAreasDeSheets") {
      resultado = obtenerAreasDeSheets();
      
    // Login con validación y Generación de Token
    } else if (action === "verificarPassword") {
      var usuarioReq = (e.parameter && e.parameter.usuario) ? e.parameter.usuario : "";
      var pwd        = (e.parameter && e.parameter.pwd)     ? e.parameter.pwd     : "";
      
      if (usuarioReq === "admin" || usuarioReq === "") {
        if (pwd === ADMIN_PASSWORD_BACKEND) {
          var permisosAdmin = ["dashboard", "documentos", "areas", "proveedores", "usuarios"];
          resultado = { success: true, rol: "admin", permisos: permisosAdmin, mensaje: "Bienvenido Super Admin", token: generarToken("admin") };
        } else {
          resultado = { success: false, error: "Contraseña incorrecta" };
        }
      } else {
        var infoUsuario = validarLoginUsuario(usuarioReq, pwd);
        if (infoUsuario) {
          resultado = { success: true, rol: "usuario", permisos: infoUsuario.permisos, mensaje: "Bienvenido " + usuarioReq, token: generarToken(usuarioReq) };
        } else {
          resultado = { success: false, error: "Usuario o contraseña incorrectos" };
        }
      }
      
    } else if (action === "obtenerUsuarios") {
      resultado = obtenerUsuarios();
      
    } else {
      resultado = { success: false, error: "Acción no reconocida del GET: " + action };
    }

    var json = JSON.stringify(resultado);

    if (callback) {
      return ContentService
        .createTextOutput(callback + "(" + json + ")")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return responder(resultado);

  } catch(err) {
    Logger.log("doGet error: " + err.message);
    return responder({ success: false, error: err.message });
  }
}

/* ──────────────────────────────────────────────
   doPost — GUARDAR / ACTUALIZAR (PROTEGIDO)
────────────────────────────────────────────── */
function doPost(e) {
  try {
    var datos = parsearDatos(e);
    if (!datos) return responder({ success: false, error: "No se recibieron datos" });

    var action = datos.action || "";
    
    // VERIFICAR TOKEN PARA ACCIONES SENSIBLES
    var accionesProtegidas = ["actualizarEstado", "eliminarDocumento", "guardarAreasEnSheets", "guardarUsuario", "eliminarUsuario"];
    if (accionesProtegidas.indexOf(action) !== -1) {
      if (!esTokenValido(datos.token)) {
        return responder({ success: false, error: "No autorizado. Token de sesión inválido o ausente." });
      }
    }
 
    if (action === "guardarDocumento") {
      return responder(guardarDocumento(datos));
    }
    if (action === "actualizarEstado") {
      return responder(actualizarEstado(datos));
    }
    if (action === "guardarAreasEnSheets") {
      return responder(guardarAreasEnSheets(datos.areas));
    }
    if (action === "obtenerAreasDeSheets") {
      return responder(obtenerAreasDeSheets());
    }
    if (action === "guardarUsuario") {
      return responder(guardarUsuario(datos));
    }
    if (action === "eliminarUsuario") {
      return responder(eliminarUsuario(datos.usuario));
    }
    if (action === "eliminarDocumento") {
      return responder(eliminarDocumento(datos));
    }
 
    return responder({ success: false, error: "Acción no reconocida del POST: " + action });

  } catch(err) {
    Logger.log("doPost error: " + err.message);
    return responder({ success: false, éxito: false, error: err.message });
  }
}

/* ──────────────────────────────────────────────
   PARSEAR DATOS DEL REQUEST
────────────────────────────────────────────── */
function parsearDatos(e) {
  if (e.parameter && e.parameter.data) {
    try { return JSON.parse(e.parameter.data); } catch(ex) {}
  }
  if (e.postData && e.postData.contents) {
    try {
      var m = e.postData.contents.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch(ex) {}
  }
  if (e.parameter && Object.keys(e.parameter).length > 0) return e.parameter;
  return null;
}

/* ──────────────────────────────────────────────
   OBTENER REGISTROS CON FILTROS SEGUROS
────────────────────────────────────────────── */
function obtenerRegistros(cedulaFiltro, proveedorFiltro) {
  var hoja = getHoja();
  var datos = hoja.getDataRange().getValues();

  if (datos.length <= 1) return { success: true, registros: [] };

  var cabeceras = datos[0];
  var registros = [];
  
  var colProveedor = cabeceras.indexOf("Proveedor");
  var colDocumento = cabeceras.indexOf("Documento");

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    
    // Lógica de Filtrado (Consulta de Proveedor)
    if (cedulaFiltro && proveedorFiltro) {
      var provStr = String(fila[colProveedor]).toLowerCase();
      var provBusc = String(proveedorFiltro).toLowerCase();
      var docDesencriptado = desencriptarDoc(fila[colDocumento]);
      
      if (provStr.indexOf(provBusc) === -1 || docDesencriptado !== cedulaFiltro.trim()) {
        continue; // Omitir este registro si no coincide con los filtros
      }
    }
    
    var obj  = {};
    for (var j = 0; j < cabeceras.length; j++) {
      var val = fila[j];
      
      // Asegurarse de devolver la cédula desencriptada para el admin/frontend
      if (j === colDocumento) {
         obj[cabeceras[j]] = desencriptarDoc(val);
      } else if (val instanceof Date) { 
         obj[cabeceras[j]] = val.toISOString(); 
      } else { 
         obj[cabeceras[j]] = val !== undefined ? val : ""; 
      }
    }
    obj["_fila"] = i + 1;
    registros.push(obj);
  }

  return { success: true, registros: registros };
}

/* ──────────────────────────────────────────────
   GUARDAR DOCUMENTO
────────────────────────────────────────────── */
function guardarDocumento(datos) {
  var hoja    = getHoja();
  var carpeta = getCarpeta();

  var proveedor   = datos.nombreProveedor || datos.Proveedor || datos.proveedor || "";
  var nombre      = datos.Nombre          || datos.nombre      || datos.responsable || "";
  var documento   = datos.Documento       || datos.documento   || "";
  var empresa     = datos.Empresa         || datos.empresa     || "";
  var area        = datos.Área            || datos.area        || datos.Area || "";
  var requisito   = datos.Requisito       || datos.requisito   || "";
  var nombreArch  = datos.NombreArchivo   || datos.nombreArchivo || datos["Nombre Archivo"] || "";
  var base64      = datos.ArchivoBase64   || datos.archivoBase64 || "";
  var fechaCarga  = datos.FechaCarga      || new Date().toISOString();

  if (!proveedor) throw new Error("Falta: nombreProveedor");
  if (!area)      throw new Error("Falta: area");

  // Encriptar el documento (cédula) en el servidor antes de guardarlo en Sheets
  var documentoEncriptado = encriptarDoc(documento);

  var urlDoc = "";
  if (base64 && nombreArch) {
    try {
      var blob = Utilities.newBlob(Utilities.base64Decode(base64), "application/octet-stream", nombreArch);
      var carpetaProv = obtenerOCrearSubcarpeta(carpeta, proveedor + "_" + area);
      var archivo = carpetaProv.createFile(blob);
      archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      urlDoc = archivo.getUrl();
    } catch(err) { urlDoc = "Error al subir: " + err.message; }
  }

  if (datos.documentos && Array.isArray(datos.documentos)) {
    var resultados = [];
    datos.documentos.forEach(function(doc) {
      var reqActual = doc.requisito || requisito;
      var fila = construirFila(proveedor, nombre, documentoEncriptado, empresa, area, reqActual, doc.nombreArchivo || nombreArch, urlDoc, fechaCarga);
      hoja.appendRow(fila);
      resultados.push({ requisito: reqActual, ok: true });
    });
    return { success: true, éxito: true, guardados: resultados.length };
  }

  var fila = construirFila(proveedor, nombre, documentoEncriptado, empresa, area, requisito, nombreArch, urlDoc, fechaCarga);
  hoja.appendRow(fila);

  return { success: true, éxito: true, mensaje: "Documento guardado correctamente" };
}

function construirFila(prov, nombre, doc, empresa, area, req, nombreArch, url, fecha) {
  var totalFilas = getHoja().getLastRow();
  return [
    new Date(), prov, nombre, doc, empresa, area, req, nombreArch, url, fecha, "Pendiente", "", totalFilas + 1
  ];
}

/* ──────────────────────────────────────────────
   ACTUALIZAR ESTADO
────────────────────────────────────────────── */
function actualizarEstado(datos) {
  var hoja = getHoja();
  var rows = hoja.getDataRange().getValues();
  var cabs = rows[0];

  var colEstado      = cabs.indexOf("Estado");
  var colComentarios = cabs.indexOf("Comentarios");
  var colProveedor   = cabs.indexOf("Proveedor");
  var colRequisito   = cabs.indexOf("Requisito");
  var colArea        = cabs.indexOf("Área");
  if (colArea < 0) colArea = cabs.indexOf("Area");
  
  var colDoc         = cabs.indexOf("Documento");
  var colFila        = cabs.indexOf("Fila");

  var proveedor  = (datos.Proveedor || "").toString().trim();
  var requisito  = (datos.Requisito || "").toString().trim();
  var area       = (datos.Área      || "").toString().trim();
  var nuevoEst   = String(datos.Estado || "Pendiente");
  var comentarios= String(datos.Comentarios || "");
  var filaRef    = parseInt(datos.Fila || "0");
  var documentoRecibido = (datos.Documento || "").toString().trim(); // Ya viene desencriptado desde la web

  var actualizados = 0;

  for (var i = rows.length - 1; i >= 1; i--) {
    var fila = rows[i];
    var coincide = false;

    if (filaRef > 0 && colFila >= 0 && parseInt(fila[colFila]) === filaRef) {
      coincide = true;
    } else if (
      proveedor && requisito && area &&
      String(fila[colProveedor]).trim() === proveedor &&
      String(fila[colRequisito]).trim() === requisito &&
      String(fila[colArea]).trim()      === area
    ) {
      // Como el documento en Sheets está encriptado, lo desencriptamos para comparar
      var docEnHoja = desencriptarDoc(fila[colDoc]);
      if (docEnHoja === documentoRecibido) coincide = true;
    }

    if (coincide) {
      hoja.getRange(i + 1, colEstado + 1).setValue(nuevoEst);
      if (colComentarios >= 0) {
        hoja.getRange(i + 1, colComentarios + 1).setValue(comentarios);
      }
      var filaFisica = i + 1;
      hoja.getRange(filaFisica, colFila + 1).setValue(filaFisica);
      actualizados++;
      break;
    }
  }

  if (actualizados === 0) return { success: false, error: "No se encontró el registro para actualizar" };
  return { success: true, éxito: true, actualizados: actualizados };
}

/* ──────────────────────────────────────────────
   HELPERS Y GESTIÓN DE ÁREAS Y USUARIOS
   (Las funciones se mantienen igual)
────────────────────────────────────────────── */
function getHoja() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = ss.getSheetByName(NOMBRE_HOJA);
  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_HOJA);
    hoja.appendRow(COLUMNAS);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight("bold");
  }
  return hoja;
}

function getCarpeta() {
  return DriveApp.getFolderById(CARPETA_DRIVE_ID);
}

function obtenerOCrearSubcarpeta(padre, nombre) {
  var subs = padre.getFoldersByName(nombre);
  if (subs.hasNext()) return subs.next();
  return padre.createFolder(nombre);
}

function guardarAreasEnSheets(areas) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var hoja = ss.getSheetByName("Áreas");
    if (!hoja) {
      hoja = ss.insertSheet("Áreas");
      hoja.appendRow(["Área", "Requisitos", "Fecha Creación", "Estado"]);
      hoja.getRange(1, 1, 1, 4).setFontWeight("bold");
    }
    var ultimaFila = hoja.getLastRow();
    if (ultimaFila > 1) hoja.deleteRows(2, ultimaFila - 1);
    
    Object.keys(areas).forEach(function(nombreArea) {
      hoja.appendRow([nombreArea, JSON.stringify(areas[nombreArea]), new Date().toISOString(), "Activo"]);
    });
    return { success: true, éxito: true, mensaje: "Áreas guardadas" };
  } catch(error) { return { success: false, error: error.message }; }
}
 
function obtenerAreasDeSheets() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var hoja = ss.getSheetByName("Áreas");
    if (!hoja) return { success: true, areas: {} };
    
    var datos = hoja.getDataRange().getValues();
    var areas = {};
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] && datos[i][3] === "Activo") {
        try { areas[datos[i][0]] = JSON.parse(datos[i][1] || "[]"); } catch(e) { areas[datos[i][0]] = []; }
      }
    }
    return { success: true, areas: areas };
  } catch(error) { return { success: true, areas: {} }; }
}

function getHojaUsuarios() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var hoja = ss.getSheetByName(NOMBRE_HOJA_USUARIOS);
  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_HOJA_USUARIOS);
    hoja.appendRow(["Usuario", "Contraseña", "Permisos", "Fecha Creación", "Estado"]);
    hoja.getRange(1, 1, 1, 5).setFontWeight("bold");
  }
  return hoja;
}

function obtenerUsuarios() {
  try {
    var datos = getHojaUsuarios().getDataRange().getValues();
    var usuarios = [];
    if (datos.length > 1) {
      for (var i = 1; i < datos.length; i++) {
        if (datos[i][0] && datos[i][4] === "Activo") {
          var perms = [];
          try { perms = JSON.parse(datos[i][2] || "[]"); } catch(e) {}
          usuarios.push({ usuario: datos[i][0], permisos: perms, fecha: datos[i][3] });
        }
      }
    }
    return { success: true, usuarios: usuarios };
  } catch(error) { return { success: false, error: error.message }; }
}

function validarLoginUsuario(usuario, pwd) {
  var datos = getHojaUsuarios().getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][4] !== "Activo") continue;
    if (String(datos[i][0]).toLowerCase() === String(usuario).toLowerCase() && String(datos[i][1]) === String(pwd)) {
      var pers = [];
      try { pers = JSON.parse(datos[i][2] || "[]"); } catch(e){}
      return { valid: true, permisos: pers };
    }
  }
  return null;
}

function guardarUsuario(datos) {
  try {
    var hoja = getHojaUsuarios();
    var uid = datos.usuario, pwd = datos.pwd, perms = JSON.stringify(datos.permisos || []);
    if (!uid || !pwd) throw new Error("Faltan credenciales del usuario");
    
    var datosHoja = hoja.getDataRange().getValues();
    var idx = -1;
    for (var i = 1; i < datosHoja.length; i++) {
      if (String(datosHoja[i][0]).toLowerCase() === String(uid).toLowerCase() && datosHoja[i][4] === "Activo") {
        idx = i + 1; break;
      }
    }
    
    if (idx > 0) {
      if (pwd !== "***") hoja.getRange(idx, 2).setValue(pwd);
      hoja.getRange(idx, 3).setValue(perms);
    } else {
      hoja.appendRow([uid, pwd, perms, new Date().toISOString(), "Activo"]);
    }
    return { success: true, éxito: true, mensaje: "Usuario guardado exitosamente" };
  } catch(e) { return { success: false, error: e.message }; }
}

function eliminarUsuario(usuario) {
  try {
    var hoja = getHojaUsuarios();
    var datos = hoja.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (String(datos[i][0]).toLowerCase() === String(usuario).toLowerCase() && datos[i][4] === "Activo") {
        hoja.getRange(i + 1, 5).setValue("Eliminado");
        return { success: true, éxito: true, mensaje: "Usuario eliminado" };
      }
    }
    return { success: false, error: "Usuario no encontrado" };
  } catch(e) { return { success: false, error: e.message }; }
}

function eliminarDocumento(datos) {
  try {
    var hoja = getHoja();
    var rows = hoja.getDataRange().getValues();
    var cabs = rows[0];

    var colProveedor = cabs.indexOf("Proveedor");
    var colRequisito = cabs.indexOf("Requisito");
    var colFila      = cabs.indexOf("Fila");

    var filaRef   = parseInt(datos.Fila || "0");
    var proveedor = (datos.Proveedor || "").toString().trim();
    var requisito = (datos.Requisito || "").toString().trim();

    for (var i = rows.length - 1; i >= 1; i--) {
      var coincide = false;
      var filaFisica = i + 1;

      if (filaRef > 0) {
        if (colFila >= 0 && parseInt(rows[i][colFila]) === filaRef) coincide = true;
        else if (filaFisica === filaRef) coincide = true;
      } 
      
      if (!coincide && proveedor && requisito) {
        if (String(rows[i][colProveedor]).trim() === proveedor && String(rows[i][colRequisito]).trim() === requisito) coincide = true;
      }

      if (coincide) {
        hoja.deleteRow(i + 1);
        return { success: true, éxito: true, mensaje: "Documento eliminado correctamente" };
      }
    }
    return { success: false, error: "No se encontró el documento para eliminar" };
  } catch(e) { return { success: false, error: e.message }; }
}

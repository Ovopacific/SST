/* ═══════════════════════════════════════════════
   PORTAL SST — CONFIGURACIÓN CENTRAL
   Edita solo este archivo para cambiar la URL
═══════════════════════════════════════════════ */

const SST_CONFIG = {

  // ── URL del Google Apps Script ─────────────
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbw24J_RcCppJ6WxJPBY9XqY3EbSnLKFM-SwLq9hwj2-BkXsqmPTJDqJvj7EI4EEsQgO4Q/exec",

  // ── Llave de encriptación (AES) ─────────────
  ENCRYPTION_KEY: "SST_OVO_2026_SECURE_KEY",

  // ── Áreas por defecto si no hay ─────────────
  AREAS_DEFAULT: {
    "Caldera": [
      "Certificado de capacitación en calderas",
      "Licencia operativa actualizada",
      "Seguro de responsabilidad civil",
      "Certificado SGSST",
      "Constancia de no antecedentes penales"
    ],
    "Deshidratado": [
      "Certificado de operador de equipo",
      "Programa de mantenimiento preventivo",
      "Plan de seguridad en proceso",
      "Certificado SGSST",
      "Autorización sanitaria"
    ],
    "Mantenimiento": [
      "Licencia técnica actualizada",
      "Certificado de competencia",
      "Seguro de responsabilidad civil",
      "Programa de SST",
      "Certificado de capacitación"
    ],
    "Servicios Generales": [
      "Cédula de identidad",
      "Certificado laboral",
      "Constancia de afiliación a seguridad social",
      "Certificado de antecedentes",
      "Autorización de datos personales"
    ]
  }
};

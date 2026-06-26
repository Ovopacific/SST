/* ═══════════════════════════════════════════════
   PORTAL SST — CONFIGURACIÓN CENTRAL
   Edita solo este archivo para cambiar la URL
═══════════════════════════════════════════════ */

const SST_CONFIG = {

  // ── MODO DE PRUEBA / DEMO ──────────────────
  // Si está en true, la app funciona de forma 100% local (usando localStorage)
  DEMO_MODE: false,

  // ── CONFIGURACIÓN DE SUPABASE ──────────────
  SUPABASE_URL: "https://ocfvenqjucvxpnowiwgi.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jZnZlbnFqdWN2eHBub3dpd2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTE5NzAsImV4cCI6MjA5Nzk2Nzk3MH0.ChiADUJMClemPeLnRhS6SHHcoqgD0wgx8qn7_ltkl8E",

  // ── CONFIGURACIÓN DE CLOUDFLARE TURNSTILE ──
  // Reemplaza esta Site Key de prueba con tu Site Key real de Cloudflare Turnstile
  TURNSTILE_SITE_KEY: "0x4AAAAAADrgHOy2MMsEegbB",


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

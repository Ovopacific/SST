// reenvio.js - Funcionalidad de reenvío de documentos rechazados

let documentoEnReenvio = null;

// Abrir modal de reenvío
function abrirModalReenvio(requisito, area, proveedor, cedula) {
    documentoEnReenvio = {
        requisito: requisito,
        area: area,
        proveedor: proveedor,
        cedula: cedula
    };

    document.getElementById('reqNombre').textContent = SSTApi.escapeHTML(requisito);
    document.getElementById('archivoReenvio').value = '';
    document.getElementById('nombreArchivoReenvio').textContent = '';
    document.getElementById('msgReenvio').style.display = 'none';
    document.getElementById('msgReenvioError').style.display = 'none';
    
    document.getElementById('modalReenvio').classList.add('active');
}

// Cerrar modal
function cerrarModalReenvio() {
    document.getElementById('modalReenvio').classList.remove('active');
    documentoEnReenvio = null;
}

// Capturar archivo seleccionado
document.addEventListener('DOMContentLoaded', () => {
    const inputArchivo = document.getElementById('archivoReenvio');
    
    if (inputArchivo) {
        inputArchivo.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                document.getElementById('nombreArchivoReenvio').textContent = '✓ ' + e.target.files[0].name;
            }
        });
    }
});

// Enviar reenvío
async function enviarReenvio() {
    if (!documentoEnReenvio) return;

    const archivo = document.getElementById('archivoReenvio').files[0];
    if (!archivo) {
        mostrarMensajeReenvio('Por favor selecciona un archivo', 'error');
        return;
    }

    // Validar tipo de archivo
    const tiposPermitidos = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!tiposPermitidos.includes(archivo.type)) {
        mostrarMensajeReenvio('Solo se aceptan PDF, Word, JPG o PNG', 'error');
        return;
    }

    // Validar tamaño (máximo 10MB)
    if (archivo.size > 10 * 1024 * 1024) {
        mostrarMensajeReenvio('El archivo no debe exceder 10MB', 'error');
        return;
    }

    mostrarMensajeReenvio('⏳ Enviando documento...', 'info');

    try {
        const base64 = await convertirABase64(archivo);

        // Obtener datos del proveedor desde el formulario
        const nombreProveedor = document.getElementById('bNombre').value;
        const nombreResponsable = document.getElementById('rResp').textContent;
        const empresa = document.getElementById('rEmpresa').textContent;

        const datos = {
            action: 'guardarDocumento',
            Proveedor: nombreProveedor,
            Nombre: nombreResponsable,
            Documento: documentoEnReenvio.cedula,
            Empresa: empresa,
            Área: documentoEnReenvio.area,
            Requisito: documentoEnReenvio.requisito,
            NombreArchivo: archivo.name,
            ArchivoBase64: base64,
            FechaCarga: new Date().toISOString(),
            Estado: 'Pendiente',
            Comentarios: 'Reenviado por proveedor'
        };

        console.log('Enviando reenvío:', datos);

        const response = await fetch(SST_CONFIG.SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(datos)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const resultado = await response.json();

        if (resultado.success) {
            // Mostrar éxito de manera mucho más clara
            const formBody = document.querySelector('.modal-body-reenvio');
            const footer = document.querySelector('.modal-footer-reenvio');
            
            formBody.innerHTML = `
                <div style="text-align:center; padding: 2rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
                    <h3 style="color:var(--success); margin-bottom: 0.5rem;">¡Documento Reenviado!</h3>
                    <p>El archivo se ha subido correctamente y el equipo de SST ha sido notificado.</p>
                    <p style="margin-top:1rem; font-size:0.9rem; color:var(--text-light);">Actualizando página en breve...</p>
                </div>
            `;
            footer.style.display = 'none';
            
            console.log('Reenvío exitoso');
            
            // Refrescar después de 3.5 segundos para que le dé tiempo a leer
            setTimeout(() => {
                cerrarModalReenvio();
                document.getElementById('formBusqueda').dispatchEvent(new Event('submit'));
                
                // Restaurar el modal original por si abre otro reenvío en la misma sesión
                setTimeout(() => location.reload(), 500); 
            }, 3500);
            
        } else {
            mostrarMensajeReenvio('Error: ' + (resultado.message || 'No se pudo enviar el documento'), 'error');
            console.error('Error en reenvío:', resultado);
        }
    } catch (error) {
        mostrarMensajeReenvio('Error: ' + error.message, 'error');
        console.error('Error al enviar reenvío:', error);
    }
}

// Convertir archivo a Base64
function convertirABase64(archivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const resultado = reader.result.split(',')[1];
            resolve(resultado);
        };
        reader.onerror = reject;
        reader.readAsDataURL(archivo);
    });
}

// Mostrar mensaje en modal
function mostrarMensajeReenvio(texto, tipo) {
    const mensaje = document.getElementById('msgReenvio');
    mensaje.textContent = texto;
    mensaje.className = `msg ${tipo}`;
    mensaje.style.display = 'block';
    
    if (tipo === 'success') {
        setTimeout(() => {
            mensaje.style.display = 'none';
        }, 2000);
    }
}

// Cerrar modal al presionar Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modalReenvio');
        if (modal && modal.classList.contains('active')) {
            cerrarModalReenvio();
        }
    }
});

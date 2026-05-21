/**
 * Traduce errores de Supabase a mensajes en español llano.
 * Nunca expone códigos HTTP ni mensajes técnicos al usuario.
 */
export function traducirError(error) {
  if (!error) return null;

  const msg = (error.message || '').toLowerCase();
  const status = error.status || 0;

  // Problemas de red / conexión
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  ) {
    return 'Sin conexión. Verificá la red e intentá de nuevo.';
  }

  // Timeout
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return 'La operación tardó demasiado. Intentá de nuevo.';
  }

  // Auth / sesión
  if (
    msg.includes('jwt') ||
    msg.includes('token') ||
    msg.includes('session') ||
    msg.includes('not authenticated') ||
    status === 401
  ) {
    return 'Tu sesión expiró. Volvé a ingresar.';
  }

  // Permisos
  if (msg.includes('permission') || msg.includes('policy') || msg.includes('rls') || status === 403) {
    return 'No tenés permiso para hacer eso.';
  }

  // Datos duplicados / conflicto
  if (msg.includes('unique') || msg.includes('duplicate') || status === 409) {
    return 'Ya existe un registro con esos datos.';
  }

  // Datos inválidos
  if (msg.includes('violates') || msg.includes('constraint') || status === 400) {
    return 'Los datos ingresados no son válidos.';
  }

  // Error de servidor
  if (status >= 500) {
    return 'Error en el servidor. Intentá en unos minutos.';
  }

  // Fallback genérico
  return 'Algo salió mal. Intentá de nuevo.';
}

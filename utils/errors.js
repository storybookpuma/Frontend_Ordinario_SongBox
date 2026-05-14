export const getApiErrorMessage = (error, fallback = 'No se pudo completar la acción.') => {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;

  if (serverMessage) return serverMessage;
  if (status === 400) return 'La solicitud no es válida. Intenta nuevamente.';
  if (status === 403) return 'No tienes permiso para realizar esta acción.';
  if (status === 404) return 'No se encontró el recurso solicitado.';
  if (status >= 500) return 'El servidor no respondió correctamente.';
  if (error?.request) return 'No se pudo conectar con el servidor.';

  return fallback;
};

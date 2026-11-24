/**
 * `localStorage` sin romper la página: si el navegador lo bloquea (cookies de terceros o
 * de sitio bloqueadas, modo privado estricto) acceder a `window.localStorage` lanza
 * `SecurityError`. Aquí se lee `null` y escribir no hace nada.
 */
export function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: la preferencia dura lo que dure la página
  }
}

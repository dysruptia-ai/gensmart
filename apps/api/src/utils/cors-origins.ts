/** Origins allowed to call the API with credentials: the frontend, with and without "www". No imports. */
export function computeAllowedOrigins(frontendUrl: string): string[] {
  const origins = [frontendUrl];
  if (frontendUrl.includes('://www.')) {
    origins.push(frontendUrl.replace('://www.', '://'));
  } else {
    origins.push(frontendUrl.replace('://', '://www.'));
  }
  return origins;
}

/**
 * Safe JSON body parser for API routes.
 * Returns null if the request body is not valid JSON.
 */
export async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

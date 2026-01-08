export async function fetchShaderCode(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load shader code from ${path}`);
  }
  return await response.text();
}

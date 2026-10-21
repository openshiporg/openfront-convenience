export class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415,
  ) {
    super(message);
  }
}

function declaredLength(request: Request): number | null {
  const value = request.headers.get("content-length");
  if (value == null) return null;
  if (!/^\d+$/.test(value.trim())) throw new RequestBodyError("Invalid Content-Length", 400);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new RequestBodyError("Invalid Content-Length", 400);
  return parsed;
}

export async function readBoundedRequestText(request: Request, maxBytes: number): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error("Body limit must be a positive integer");
  const declared = declaredLength(request);
  if (declared != null && declared > maxBytes) throw new RequestBodyError("Request body is too large", 413);
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel("request body limit exceeded");
        throw new RequestBodyError("Request body is too large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(combined);
}

export async function readBoundedRequestJson<T = unknown>(request: Request, maxBytes: number): Promise<T> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new RequestBodyError("Content-Type must be application/json", 415);
  }
  const text = await readBoundedRequestText(request, maxBytes);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RequestBodyError("Request body must be valid JSON", 400);
  }
}

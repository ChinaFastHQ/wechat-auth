/** Encodes bytes as unpadded base64url using a runtime-provided base64 encoder. */
export function encodeBase64Url(
  bytes: Uint8Array,
  encodeBase64: (binary: string) => string
): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return encodeBase64(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

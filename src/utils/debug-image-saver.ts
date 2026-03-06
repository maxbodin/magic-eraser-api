import type { AppContext } from "../types";

/**
 * Converts an ArrayBuffer to a Base64 string.
 */
function arrayBufferToBase64( buffer: ArrayBuffer ): string {
  return Buffer.from( buffer ).toString( "base64" );
}

/**
 * Logs the image and mask as Base64 strings to the console for debugging.
 * @param c - The application context to check the IS_LOCAL environment variable.
 * @param imageArrayBuffer - The ArrayBuffer of the original image.
 * @param maskArrayBuffer - The ArrayBuffer of the mask.
 */
export function saveDebugImageAndMask( c: AppContext, imageArrayBuffer: ArrayBuffer, maskArrayBuffer: ArrayBuffer ): void {
  const isLocal = (c.env as any).IS_LOCAL === "true";
  if (!isLocal) {
    return;
  }

  try {
    console.log( `\n--- [DEBUG IMAGE DATA] ---` );
    console.log( `\n----- BEGIN IMAGE BASE64 -----` );
    console.log( arrayBufferToBase64( imageArrayBuffer ) );
    console.log( `----- END IMAGE BASE64 -----\n` );
    console.log( `\n----- BEGIN MASK BASE64 -----` );
    console.log( arrayBufferToBase64( maskArrayBuffer ) );
    console.log( `----- END MASK BASE64 -----\n` );
    console.log( `--- [END DEBUG IMAGE DATA] ---\n` );

  } catch (error) {
    console.error( "[DEBUG] Failed to process and log debug image data:", error );
  }
}
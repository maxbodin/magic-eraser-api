import { Jimp } from "jimp";

/**
 * Extracts width and height from an image buffer.
 * @param buffer - The image buffer (ArrayBuffer or Buffer)
 * @returns Object with width and height
 */
export async function getImageDimensions( buffer: ArrayBuffer | Buffer ): Promise<{ width: number; height: number }> {
  try {
    const imageBuffer = buffer instanceof ArrayBuffer ? Buffer.from( buffer ) : buffer;
    const image = await Jimp.fromBuffer( imageBuffer );
    return {
      width: image.width,
      height: image.height,
    };
  } catch (error) {
    console.error( "Error extracting image dimensions:", error );
    throw new Error( "Failed to extract image dimensions from buffer" );
  }
}

/**
 * Resizes an image to dimensions that are multiples of 8 (required by Stable Diffusion)
 * while preserving the aspect ratio. Can optionally restore to original dimensions.
 *
 * @param buffer - The image buffer (ArrayBuffer or Buffer)
 * @param originalWidth - Original image width
 * @param originalHeight - Original image height
 * @param targetWidth - (Optional) Final width to resize to after processing
 * @param targetHeight - (Optional) Final height to resize to after processing
 * @returns Object with resized buffer, width, and height
 */
export async function resizeImage(
  buffer: ArrayBuffer | Buffer,
  originalWidth: number,
  originalHeight: number,
  targetWidth?: number,
  targetHeight?: number
): Promise<{ buffer: ArrayBuffer; width: number; height: number }> {
  const imageBuffer = buffer instanceof ArrayBuffer ? Buffer.from( buffer ) : buffer;
  const image = await Jimp.fromBuffer( imageBuffer );

  const currentWidth = image.width;
  const currentHeight = image.height;

  if (currentWidth <= 0 || currentHeight <= 0) {
    throw new Error( `Invalid image dimensions: ${ currentWidth }x${ currentHeight }` );
  }

  let newWidth: number;
  let newHeight: number;

  // If target dimensions are provided, use them (for restoring original size)
  if (targetWidth && targetHeight) {
    newWidth = Math.max( 8, Math.round( targetWidth ) );
    newHeight = Math.max( 8, Math.round( targetHeight ) );
  } else {
    const aspectRatio = currentWidth / currentHeight;
    const roundTo8 = ( n: number ) => {
      const rounded = Math.round( n / 8 ) * 8;
      return Math.max( 8, rounded );
    };

    const maxDimension = 2048;
    let calculatedWidth = currentWidth;
    let calculatedHeight = currentHeight;

    if (calculatedWidth > maxDimension || calculatedHeight > maxDimension) {
      if (calculatedWidth > calculatedHeight) {
        calculatedWidth = maxDimension;
        calculatedHeight = Math.round( maxDimension / aspectRatio );
      } else {
        calculatedHeight = maxDimension;
        calculatedWidth = Math.round( maxDimension * aspectRatio );
      }
    }

    newWidth = roundTo8( calculatedWidth );
    newHeight = roundTo8( calculatedHeight );
  }

  console.log( `Resizing from ${ currentWidth }x${ currentHeight } to ${ newWidth }x${ newHeight }` );

  if (newWidth <= 0 || newHeight <= 0 || !Number.isFinite( newWidth ) || !Number.isFinite( newHeight )) {
    throw new Error( `Invalid resize dimensions: ${ newWidth }x${ newHeight }` );
  }

  const resizedImage = image.resize( {
    w: newWidth,
    h: newHeight,
  } );

  const resizedBuffer = await resizedImage.getBuffer( "image/png", {
    quality: 100,
    compression: 0
  } );

  return {
    buffer: resizedBuffer.buffer,
    width: newWidth,
    height: newHeight,
  };
}
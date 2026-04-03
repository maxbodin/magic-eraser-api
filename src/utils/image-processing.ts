import { Jimp } from "jimp";

/**
 * Composites the AI-generated image onto the original image using the mask.
 * Only the masked area (white pixels) from the AI result will be visible.
 * Optimized version using vectorized operations.
 *
 * @param originalBuffer - The original image buffer
 * @param aiResultBuffer - The AI-generated inpainted image buffer
 * @param maskBuffer - The mask buffer (white = area to replace, black = keep original)
 * @param width - Width of all images
 * @param height - Height of all images
 * @returns Composited image buffer
 */
export async function compositeImages(
	originalBuffer: ArrayBuffer | Buffer,
	aiResultBuffer: ArrayBuffer | Buffer,
	maskBuffer: ArrayBuffer | Buffer,
	width: number,
	height: number
): Promise<ArrayBuffer> {
	const originalImageBuffer = originalBuffer instanceof ArrayBuffer ? Buffer.from( originalBuffer ) : originalBuffer;
	const aiResultImageBuffer = aiResultBuffer instanceof ArrayBuffer ? Buffer.from( aiResultBuffer ) : aiResultBuffer;
	const maskImageBuffer = maskBuffer instanceof ArrayBuffer ? Buffer.from( maskBuffer ) : maskBuffer;

	const originalImage = await Jimp.fromBuffer( originalImageBuffer );
	const aiResultImage = await Jimp.fromBuffer( aiResultImageBuffer );
	const maskImage = await Jimp.fromBuffer( maskImageBuffer );

	// Use direct bitmap manipulation for optimal performance.
	const compositeWithAlpha = aiResultImage.clone();
	const compositeBitmap = compositeWithAlpha.bitmap.data;
	const originalBitmap = originalImage.bitmap.data;
	const maskBitmap = maskImage.bitmap.data;

	// Process compositing by directly manipulating bitmap data.
	for (let idx = 0; idx < compositeBitmap.length; idx += 4) {
		const pixelIdx = idx / 4;
		const maskPixelIdx = pixelIdx * 4;

		// Get mask brightness (check red channel).
		const maskBrightness = maskBitmap[maskPixelIdx];

		if (maskBrightness <= 128) {
			// Where mask is black, use original image pixel.
			compositeBitmap[idx] = originalBitmap[idx];
			compositeBitmap[idx + 1] = originalBitmap[idx + 1];
			compositeBitmap[idx + 2] = originalBitmap[idx + 2];
			compositeBitmap[idx + 3] = originalBitmap[idx + 3];
		}
		// Otherwise keep AI result pixel (already in compositeWithAlpha).
	}

	// Get the composited image as PNG
	const compositedBuffer = await compositeWithAlpha.getBuffer("image/png", {
		quality: 100,
		compression: 4
	});

	return compositedBuffer.buffer as ArrayBuffer;
}

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
 * Resizes an image to correct dimensions, while preserving the aspect ratio.
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
      quality: 75,
      compression: 6
  } );

  return {
    buffer: resizedBuffer.buffer as ArrayBuffer,
    width: newWidth,
    height: newHeight,
  };
}
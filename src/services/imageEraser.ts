import { compositeImages, getImageDimensions, resizeImage } from "../utils/image-processing";
import { Env } from "../types";

const AI_MODEL = "@cf/runwayml/stable-diffusion-v1-5-inpainting";
const INPAINT_PROMPT = "remove object, seamless empty background matching texture";
const CHUNK_SIZE = 8192;

export interface EraseInput {
	imageFile: File;
	maskFile: File;
	strength: number;
	guidance: number;
}

export interface EraseResult {
	success: true;
	strength: number;
	guidance: number;
	image: string; // Base64 PNG data URL.
}

export async function eraseObject(input: EraseInput, env: Env): Promise<EraseResult> {
	const { imageFile, maskFile, strength, guidance } = input;

	const imageArrayBuffer = await imageFile.arrayBuffer();
	const maskArrayBuffer = await maskFile.arrayBuffer();

	const { width: originalWidth, height: originalHeight } = await getImageDimensions(imageArrayBuffer);
	console.log(`Original dimensions: ${originalWidth}x${originalHeight}`);

	const { buffer: resizedImageBuffer, width: processWidth, height: processHeight } =
		await resizeImage(imageArrayBuffer, originalWidth, originalHeight);
	const { buffer: resizedMaskBuffer } =
		await resizeImage(maskArrayBuffer, originalWidth, originalHeight);

	console.log(`Processing dimensions: ${processWidth}x${processHeight}`);

	const response = await env.AI.run(AI_MODEL, {
		prompt: INPAINT_PROMPT,
		image: Array.from(new Uint8Array(resizedImageBuffer)),
		mask: Array.from(new Uint8Array(resizedMaskBuffer)),
		strength,
		guidance,
	});

	const resultBuffer = await new Response(response).arrayBuffer();

	const { buffer: restoredBuffer } = await resizeImage(
		resultBuffer,
		processWidth,
		processHeight,
		originalWidth,
		originalHeight
	);

	const compositedBuffer = await compositeImages(
		imageArrayBuffer,
		restoredBuffer,
		maskArrayBuffer,
		originalWidth,
		originalHeight
	);

	return {
		success: true,
		strength,
		guidance,
		image: `data:image/png;base64,${toBase64(compositedBuffer)}`,
	};
}

function toBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
		binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK_SIZE)));
	}
	return btoa(binary);
}
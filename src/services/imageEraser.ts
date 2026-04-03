import { compositeImages, getImageDimensions, resizeImage } from "../utils/image-processing";
import { put } from "@vercel/blob";
import { type AppContext } from "../types";

const AI_MODEL = "@cf/runwayml/stable-diffusion-v1-5-inpainting";
const INPAINT_PROMPT = "remove object, seamless empty background matching texture";
const MAX_RETRIES    = 3;
const RETRY_BASE_MS  = 100;

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
	imageUrl: string; // Vercel Blob public URL.
}

export async function eraseObject(input: EraseInput, env: AppContext["env"]): Promise<EraseResult> {
	const { imageFile, maskFile, strength, guidance } = input;
	const startTime = Date.now();

	const imageArrayBuffer = await imageFile.arrayBuffer();
	const maskArrayBuffer = await maskFile.arrayBuffer();

	const { width: originalWidth, height: originalHeight } = await getImageDimensions(imageArrayBuffer);
	console.log(`Original dimensions: ${originalWidth}x${originalHeight}`);

	const { buffer: resizedImageBuffer, width: processWidth, height: processHeight } =
		await resizeImage(imageArrayBuffer, originalWidth, originalHeight);
	const { buffer: resizedMaskBuffer } =
		await resizeImage(maskArrayBuffer, originalWidth, originalHeight);

	console.log(`Processing dimensions: ${processWidth}x${processHeight}`);

	// Retry the AI call, Cloudflare flags upstream drops as retryable.
	const aiStartTime = Date.now();
	const response = await withRetry(
		() => env.AI.run(AI_MODEL, {
			prompt:   INPAINT_PROMPT,
			image:    Array.from(new Uint8Array(resizedImageBuffer)),
			mask:     Array.from(new Uint8Array(resizedMaskBuffer)),
			strength,
			guidance,
		}),
		MAX_RETRIES,
		RETRY_BASE_MS
	);
	console.log(`AI processing took ${Date.now() - aiStartTime}ms`);

	const aiStream = response as ReadableStream<Uint8Array>;
	const resultBuffer = await new Response(aiStream).arrayBuffer();

	const { buffer: restoredBuffer } = await resizeImage(
		resultBuffer, processWidth, processHeight, originalWidth, originalHeight
	);

	const compositingStartTime = Date.now();
	const compositedBuffer = await compositeImages(
		imageArrayBuffer, restoredBuffer, maskArrayBuffer, originalWidth, originalHeight
	);
	console.log(`Compositing took ${Date.now() - compositingStartTime}ms`);

	// Upload to Vercel Blob and get the public URL.
	const { url: imageUrl } = await put(
		`erased-images/${crypto.randomUUID()}.png`,
		new Blob([compositedBuffer], { type: "image/png" }),
		{ access: "public", token: env.VERCEL_BLOB_TOKEN }
	);

	console.log(`Total processing time: ${Date.now() - startTime}ms`);

	return {
		success: true,
		strength,
		guidance,
		imageUrl,
	};
}

/**
 * Retries an async fn with exponential backoff.
 * Respects the `retryable` flag on Cloudflare AI errors.
 */
async function withRetry<T>(
	fn: () => Promise<T>,
	maxAttempts: number,
	baseDelayMs: number
): Promise<T> {
	let lastError: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (err: any) {
			lastError = err;

			const isRetryable  = err?.retryable !== false;
			const isLastAttempt = attempt === maxAttempts;

			if (!isRetryable || isLastAttempt) throw err;

			const delay = baseDelayMs * 2 ** (attempt - 1);
			console.warn(`AI attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms — ${err.message}`);
			await sleep(delay);
		}
	}

	throw lastError;
}


function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
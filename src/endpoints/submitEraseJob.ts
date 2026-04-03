import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { eraseObject } from "../services/imageEraser";
import { getImageDimensions } from "../utils/image-processing";

export class SubmitEraseJob extends OpenAPIRoute {
	schema = {
		tags: ["Jobs"],
		summary: "Submit an object-erase job, returns a jobId immediately for polling.",
		request: {
			body: {
				content: {
					"multipart/form-data": {
						schema: z.object({
							image: z.any().openapi({
								description: "The original image file (JPEG/PNG)",
								type: "string",
								format: "binary",
							}),
							mask: z.any().openapi({
								description: "Black-and-white mask (white = area to erase)",
								type: "string",
								format: "binary",
							}),
							strength: z.string().optional().openapi({ description: "Inpaint strength, e.g. 0.8" }),
							guidance: z.string().optional().openapi({ description: "Guidance scale, e.g. 8" }),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Job accepted — poll /api/job/:jobId for the result",
				content: {
					"application/json": {
						schema: z.object({
							jobId: z.string().uuid(),
						}),
					},
				},
			},
			"400": {
				description: "Missing or invalid image/mask",
				content: { "application/json": { schema: z.object({ success: z.boolean(), error: z.string() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const formData = await c.req.formData();

		const imageFile = formData.get("image");
		const maskFile  = formData.get("mask");

		if (!imageFile || !(imageFile instanceof File)) {
			return Response.json({ success: false, error: "Missing valid 'image' file" }, { status: 400 });
		}
		if (!maskFile || !(maskFile instanceof File)) {
			return Response.json({ success: false, error: "Missing valid 'mask' file" }, { status: 400 });
		}

		// Enforce size limits to prevent CPU timeouts.
		const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5 MB
		if (imageFile.size > MAX_FILE_SIZE || maskFile.size > MAX_FILE_SIZE) {
			return Response.json(
				{ success: false, error: `Files must be under ${MAX_FILE_SIZE / 1024 / 1024}MB` },
				{ status: 400 }
			);
		}

		const strength = formData.get("strength");
		const guidance = formData.get("guidance");

		const imageBuffer = await imageFile.arrayBuffer();
		const maskBuffer  = await maskFile.arrayBuffer();

		// Validate image dimensions early.
		try {
			const { width, height } = await getImageDimensions(imageBuffer);
			const MAX_DIMENSION = 2048;
			if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
				return Response.json(
					{ success: false, error: `Image dimensions must not exceed ${MAX_DIMENSION}x${MAX_DIMENSION}` },
					{ status: 400 }
				);
			}
		} catch (e) {
			return Response.json(
				{ success: false, error: "Failed to read image dimensions" },
				{ status: 400 }
			);
		}

		// saveDebugImageAndMask(c, imageBuffer, maskBuffer);

		const jobId = crypto.randomUUID();

		await c.env.JOBS_KV.put(jobId, JSON.stringify({ status: "pending" }), {
			expirationTtl: 3600,
		});

		// Reconstruct Files from buffers so background job can read them
		c.executionCtx.waitUntil(
			processInBackground(jobId, {
				imageFile: new File([imageBuffer], "image.jpg", { type: "image/jpeg" }),
				maskFile:  new File([maskBuffer],  "mask.png",  { type: "image/png" }),
				strength: strength ? parseFloat(strength as string) : 0.8,
				guidance: guidance ? parseInt(guidance as string, 10) : 8,
			}, c.env)
		);

		return Response.json({ jobId });
	}
}

async function processInBackground(
	jobId: string,
	input: { imageFile: File; maskFile: File; strength: number; guidance: number },
	env: AppContext["env"]
) {
	try {
		const result = await eraseObject(input, env);
		const payload = JSON.stringify({ status: "done", ...result });
		await env.JOBS_KV.put(jobId, payload, { expirationTtl: 3600 });

	} catch (err: any) {
		console.error(`Job ${jobId} failed:`, err);
		await env.JOBS_KV.put(jobId, JSON.stringify({
			status: "error",
			success: false,
			error: err.message ?? "Unknown error",
		}), { expirationTtl: 3600 });
	}
}
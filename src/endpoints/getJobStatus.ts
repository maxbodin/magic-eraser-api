import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

const JobResultSchema = z.discriminatedUnion("status", [
	z.object({ status: z.literal("pending") }),
	z.object({
		status: z.literal("done"),
		success: z.literal(true),
		strength: z.number(),
		guidance: z.number(),
		imageUrl: z.string().url().openapi({ description: "Vercel Blob public URL to the updated image." }),
	}),
	z.object({
		status: z.literal("error"),
		success: z.literal(false),
		error: z.string(),
	}),
]);

export class GetJobStatus extends OpenAPIRoute {
	schema = {
		tags: ["Jobs"],
		summary: "Poll the status/result of an erase job.",
		request: {
			params: z.object({
				jobId: z.string().uuid().openapi({ description: "Job ID returned by POST /api/erase-object-in-image" }),
			}),
		},
		responses: {
			"200": {
				description: "Job status: pending | done | error",
				content: { "application/json": { schema: JobResultSchema } },
			},
			"404": {
				description: "Job not found or expired",
				content: { "application/json": { schema: z.object({ error: z.string() }) } },
			},
		},
	};

	async handle(c: AppContext) {
		const { jobId } = c.req.param();
		const raw = await c.env.JOBS_KV.get(jobId);

		if (!raw) {
			return Response.json({ error: "Job not found or expired" }, { status: 404 });
		}

		return Response.json(JSON.parse(raw));
	}
}
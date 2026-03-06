import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./types";
import { SubmitEraseJob } from "./endpoints/submitEraseJob";
import { GetJobStatus } from "./endpoints/getJobStatus";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({
  origin: (origin) => {
    const allowed = [
      "https://magic-eraser.maximebodin.com",
      "http://localhost:5173",
      "http://localhost:4173",
    ];
    return allowed.includes(origin) ? origin : allowed[0]!;
  },
  allowMethods: ["POST", "GET", "OPTIONS"],
  allowHeaders: ["Content-Type"],
}));

const openapi = fromHono(app, { docs_url: "/" });

openapi.post("/api/erase-object-in-image", SubmitEraseJob);
openapi.get("/api/job/:jobId", GetJobStatus);

export default app;
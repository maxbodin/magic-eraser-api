import type { Context } from "hono";

export interface Env {
  AI: any;
  IS_LOCAL?: string;
  JOBS_KV: KVNamespace;
  VERCEL_BLOB_TOKEN?: string;
}

export type AppContext = Context<{ Bindings: Env }>;
import type { Context } from "hono";

export interface Env {
  AI: any;
}

export type AppContext = Context<{ Bindings: Env }>;

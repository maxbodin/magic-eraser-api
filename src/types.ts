import type { Context } from "hono";

export interface Env {
  AI: any;
  IS_LOCAL?: string;
}

export type AppContext = Context<{ Bindings: Env }>;

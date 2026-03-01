import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { EraseObjectInImage } from "./endpoints/eraseImage";
import { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "/api/*",
  cors( {
    origin: "*", // In production, remember to replace "*" with frontend Cloudflare Pages URL.
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  } )
);

const openapi = fromHono( app, {
  docs_url: "/",
} );

openapi.post( "/api/erase", EraseObjectInImage );

export default app;
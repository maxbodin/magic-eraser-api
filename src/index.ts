import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { EraseObjectInImage } from "./endpoints/eraseObjectInImage";
import { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "/api/*",
  cors( {
    origin: "https://magic-eraser.maximebodin.com",
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  } )
);

const openapi = fromHono( app, {
  docs_url: "/",
} );

openapi.post( "/api/erase-object-in-image", EraseObjectInImage );

export default app;
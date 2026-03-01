import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

export class EraseImage extends OpenAPIRoute {
  schema = {
    tags: ["AI Tools"],
    summary: "Erase an object from an image using AI",
    request: {
      body: {
        content: {
          "multipart/form-data": {
            schema: z.object( {
              image: z.any().openapi( {
                description: "The original image file (JPEG/PNG)",
                type: "string",
                format: "binary",
              } ),
              mask: z.any().openapi( {
                description: "The black and white mask file (JPEG/PNG)",
                type: "string",
                format: "binary",
              } ),
            } ),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Returns the modified image",
        content: {
          "image/png": {
            schema: z.any().openapi( { type: "string", format: "binary" } ),
          },
        },
      },
      "400": {
        description: "Bad Request",
        content: {
          "application/json": {
            schema: z.object( {
              success: z.boolean(),
              error: z.string(),
            } ),
          },
        },
      },
      "500": {
        description: "Server Error",
        content: {
          "application/json": {
            schema: z.object( {
              success: z.boolean(),
              error: z.string(),
            } ),
          },
        },
      },
    },
  };

  async handle( c: AppContext ) {
    try {
      const body = await c.req.parseBody();

      const imageFile = body["image"];
      const maskFile = body["mask"];
      const prompt = "Perform targeted object removal on the provided image. Remove the object entirely and reconstruct the occluded background using context-aware generative inpainting. The reconstruction must:\n" +
        "• Preserve global illumination consistency (intensity, color temperature, shadow direction, ambient occlusion).\n" +
        "• Maintain structural continuity (lines, edges, perspective geometry, vanishing points).\n" +
        "• Ensure texture coherence (grain, noise distribution, surface frequency patterns).\n" +
        "• Match depth of field, focus characteristics, and lens distortion parameters.\n" +
        "• Preserve environmental reflections and refractions if present.\n" +
        "• Maintain photometric realism with no visible seams, halos, blur patches, or repetition artifacts.\n" +
        "Use surrounding pixels as contextual priors to synthesize a statistically plausible background consistent with scene semantics.\n" +
        "Final output must appear as if the removed object never existed in the original capture.\n" +
        "Do not alter unrelated objects, framing, aspect ratio, or color grading.\n" +
        "Output a single, fully reconstructed, high-resolution image with seamless blending and no detectable manipulation artifacts.";

      if (!imageFile || !( imageFile instanceof File )) {
        return Response.json( { success: false, error: "Missing valid 'image' file" }, { status: 400 } );
      }
      if (!maskFile || !( maskFile instanceof File )) {
        return Response.json( { success: false, error: "Missing valid 'mask' file" }, { status: 400 } );
      }

      const imageArrayBuffer = await imageFile.arrayBuffer();
      const maskArrayBuffer = await maskFile.arrayBuffer();

      const imageArray = Array.from( new Uint8Array( imageArrayBuffer ) );
      const maskArray = Array.from( new Uint8Array( maskArrayBuffer ) );

      const response = await c.env.AI.run(
        "@cf/runwayml/stable-diffusion-v1-5-inpainting",
        {
          prompt: prompt,
          image: imageArray,
          mask: maskArray,
          guidance: 10,
        }
      );

      return new Response( response, {
        headers: {
          "Content-Type": "image/png",
        },
      } );

    } catch (error: any) {
      console.error( "Worker API Error:", error );
      return Response.json(
        { success: false, error: error.message || "Unknown error occurred" },
        { status: 500 }
      );
    }
  }
}
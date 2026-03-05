import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";
import { saveDebugImageAndMask } from "../utils/debug-image-saver";
import { getImageDimensions, resizeImage } from "../utils/image-processing";

export class EraseObjectInImage extends OpenAPIRoute {
  schema = {
    tags: ["AI Tools"],
    summary: "Erase an object from an image using AI. Generate erasure variations with strength and guidance combinations",
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
        description: "Returns a JSON object containing multiple image variations.",
        content: {
          "application/json": {
            schema: z.object( {
              success: z.boolean(),
              variations: z.array( z.object( {
                strength: z.number(),
                guidance: z.number(),
                image: z.string().openapi( { description: "Base64 encoded PNG" } )
              } ) )
            } )
          }
        }
      },
      "400": {
        description: "Bad Request",
        content: { "application/json": { schema: z.object( { success: z.boolean(), error: z.string() } ) } }
      },
      "500": {
        description: "Server Error",
        content: { "application/json": { schema: z.object( { success: z.boolean(), error: z.string() } ) } }
      },
    },
  };

  async handle( c: AppContext ) {
    try {
      const body = await c.req.parseBody();

      const imageFile = body["image"];
      const maskFile = body["mask"];
      const prompt = "remove object, seamless empty background matching texture";

      if (!imageFile || !( imageFile instanceof File )) {
        return Response.json( { success: false, error: "Missing valid 'image' file" }, { status: 400 } );
      }
      if (!maskFile || !( maskFile instanceof File )) {
        return Response.json( { success: false, error: "Missing valid 'mask' file" }, { status: 400 } );
      }

      const imageArrayBuffer = await imageFile.arrayBuffer();
      const maskArrayBuffer = await maskFile.arrayBuffer();

      saveDebugImageAndMask( c, imageArrayBuffer, maskArrayBuffer );

      const { width: originalWidth, height: originalHeight } = await getImageDimensions( imageArrayBuffer );
      console.log( `Original image dimensions: ${ originalWidth }x${ originalHeight }` );

      const {
        buffer: resizedImageBuffer,
        width: processWidth,
        height: processHeight
      } = await resizeImage( imageArrayBuffer, originalWidth, originalHeight );
      const { buffer: resizedMaskBuffer } = await resizeImage( maskArrayBuffer, originalWidth, originalHeight );

      console.log( `Processing dimensions: ${ processWidth }x${ processHeight }` );

      const imageArray = Array.from( new Uint8Array( resizedImageBuffer ) );
      const maskArray = Array.from( new Uint8Array( resizedMaskBuffer ) );

      const strengths = [0.8, 0.9, 1.0];
      const guidances = [7.5, 8, 9, 10, 11, 12, 13];

      // Create all combinations.
      const combinations = strengths.flatMap( s => guidances.map( g => ( { strength: s, guidance: g } ) ) );

      console.log( `Generating ${ combinations.length } variations...` );

      const aiPromises = combinations.map( async ( config ) => {
        try {
          const response = await c.env.AI.run(
            "@cf/runwayml/stable-diffusion-v1-5-inpainting",
            {
              prompt: prompt,
              image: imageArray,
              mask: maskArray,
              strength: config.strength,
              guidance: config.guidance,
            }
          );

          // Convert ArrayBuffer to Base64.
          const resultBuffer = await new Response( response ).arrayBuffer();

          // Resize result back to original dimensions to preserve aspect ratio
          const restoredBuffer = await resizeImage( resultBuffer, processWidth, processHeight, originalWidth, originalHeight );
          const bytes = new Uint8Array( restoredBuffer.buffer );

          // Worker optimization: Chunk conversion to avoid "Maximum call stack size exceeded"
          let binary = "";
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply( null, Array.from( bytes.subarray( i, i + chunkSize ) ) );
          }
          const base64String = btoa( binary );

          return {
            strength: config.strength,
            guidance: config.guidance,
            image: `data:image/png;base64,${ base64String }`,
            error: null
          };
        } catch (err: any) {
          console.error( `Failed gen (S:${ config.strength }, G:${ config.guidance })`, err );
          return {
            strength: config.strength,
            guidance: config.guidance,
            image: null,
            error: "Failed"
          };
        }
      } );

      const results = await Promise.all( aiPromises );
      const successResults = results.filter( r => r.image !== null );

      return Response.json( {
        success: true,
        count: successResults.length,
        variations: successResults
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
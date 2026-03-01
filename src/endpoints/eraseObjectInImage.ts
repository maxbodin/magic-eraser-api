import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

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
              variations: z.array(
                z.object( {
                  strength: z.number(),
                  guidance: z.number(),
                  image: z.string().openapi( { description: "Base64 encoded PNG" } ),
                } )
              ),
            } ),
          },
        },
      },
      "400": {
        description: "Bad Request",
        content: {
          "application/json": {
            schema: z.object( { success: z.boolean(), error: z.string() } ),
          },
        },
      },
      "500": {
        description: "Server Error",
        content: {
          "application/json": {
            schema: z.object( { success: z.boolean(), error: z.string() } ),
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
      const prompt = "remove object, seamless empty background matching texture";

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

      const strengths = [0.8, 0.9, 1.0];
      const guidances = [7.5, 8, 9, 10, 11, 12, 13];

      // Create all combinations.
      const combinations = [];
      for (const s of strengths) {
        for (const g of guidances) {
          combinations.push( { strength: s, guidance: g } );
        }
      }

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
          const arrayBuffer = await new Response( response ).arrayBuffer();
          const bytes = new Uint8Array( arrayBuffer );
          let binary = "";
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode( bytes[i] );
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
# Magic Eraser AI - API Worker

> Cloudflare Worker API for AI-powered object removal from images.

## Features

- **AI-Powered Inpainting**: Remove unwanted objects using Cloudflare AI's `@cf/runwayml/stable-diffusion-v1-5-inpainting` model.
- **Multiple Variations**: Generates multiple variations across different strength and guidance combinations.
- **Smart Compositing**: Masks-based compositing ensures only the selected area is replaced, the rest of the image is preserved pixel-perfect.
- **Aspect Ratio Preservation**: Images are resized before processing and restored to original dimensions afterward.
- **Retry Logic**: Automatic exponential backoff retry on network/upstream errors (up to 3 attempts per variation).
- **OpenAPI 3.1 Docs**: Auto-generated Swagger UI available at the root URL.
- **Debug Mode**: Optional local debug logging of image and mask data as Base64.

## Project Structure

```
magic-eraser-api/ 
├── src/
│   ├── endpoints/
│   │   └── eraseObjectInImage.ts   # POST /api/erase-object-in-image endpoint
│   ├── utils/
│   │   ├── debug-image-saver.ts    # Local debug logging of image/mask Base64 data
│   │   └── image-processing.ts     # Jimp-based resize, dimension extraction, and compositing
│   ├── index.ts                    # Hono app entry point with CORS and OpenAPI registration
│   └── types.ts                    # Env bindings and AppContext type definitions
├── package.json                    # Project dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── wrangler.toml                   # Cloudflare Worker configuration
└── README.md                       # This file
```

## API Reference

### `POST /api/erase-object-in-image`

Erases an object from an image using AI inpainting and returns multiple variations.

**Request** — `multipart/form-data`

| Field   | Type | Description                                                                  |
|---------|------|------------------------------------------------------------------------------|
| `image` | File | Original image (JPEG or PNG)                                                 |
| `mask`  | File | Black-and-white mask (JPEG or PNG). White pixels indicate the area to erase. |

**Response** — `application/json`

```json
{
  "success": true,
  "count": 12,
  "variations": [
    {
      "strength": 0.8,
      "guidance": 8,
      "image": "data:image/png;base64,..."
    }
  ]
}
```

Each variation is a Base64-encoded PNG of the full composited image with only the masked area replaced.

**Error Responses**

| Status | Reason                            |
|--------|-----------------------------------|
| `400`  | Missing or invalid `image`/`mask` |
| `500`  | Internal server or AI model error |

## Technology Stack

| Layer             | Technology                                                        |
|-------------------|-------------------------------------------------------------------|
| Runtime           | [Cloudflare Workers](https://workers.dev)                         |
| Web Framework     | [Hono](https://hono.dev)                                          |
| OpenAPI           | [chanfana](https://github.com/cloudflare/chanfana)                |
| Schema Validation | [Zod](https://zod.dev)                                            |
| Image Processing  | [Jimp](https://github.com/jimp-dev/jimp)                          |
| AI Model          | `@cf/runwayml/stable-diffusion-v1-5-inpainting` via Cloudflare AI |
| Language          | TypeScript                                                        |
# Magic Eraser AI - API Worker

> Cloudflare Worker API for AI-powered object removal from images.

## Features

- **AI-Powered Inpainting**: Remove unwanted objects using Cloudflare AI's `@cf/runwayml/stable-diffusion-v1-5-inpainting` model.
- **Multiple Variations**: Generates multiple variations across different strength and guidance combinations.
- **Smart Compositing**: Masks-based compositing ensures only the selected area is replaced, the rest of the image is preserved pixel-perfect.
- **Aspect Ratio Preservation**: Images are resized before processing and restored to original dimensions afterward.
- **Vercel Blob Storage**: Processed images are stored on Vercel Blob for efficient retrieval without KV bottlenecks (saving base64 image to KV in previous version).
- **Retry Logic**: Automatic exponential backoff retry on network/upstream errors (up to 3 attempts).
- **OpenAPI 3.1 Docs**: Auto-generated Swagger UI available at the root URL.
- **Debug Mode**: Optional local debug logging of image and mask data as Base64.

## Project Structure

```
magic-eraser-api/ 
├── src/
│   ├── endpoints/
│   │   ├── submitEraseJob.ts       # POST /api/erase-object-in-image endpoint
│   │   └── getJobStatus.ts         # GET /api/job/:jobId endpoint for polling results
│   ├── services/
│   │   └── imageEraser.ts          # Core AI inpainting and Vercel Blob upload logic
│   ├── utils/
│   │   └── image-processing.ts     # Jimp-based resize, dimension extraction, and compositing
│   ├── index.ts                    # Hono app entry point with CORS and OpenAPI registration
│   └── types.ts                    # Env bindings and AppContext type definitions
├── package.json                    # Project dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── wrangler.jsonc                  # Cloudflare Worker configuration
└── README.md                       # This file
```

## API Reference

### `POST /api/erase-object-in-image`

Submits an async job to erase an object from an image using AI inpainting.

**Request** — `multipart/form-data`

| Field      | Type   | Description                                                                  |
|------------|--------|------------------------------------------------------------------------------|
| `image`    | File   | Original image (JPEG or PNG)                                                 |
| `mask`     | File   | Black-and-white mask (JPEG or PNG). White pixels indicate the area to erase. |
| `strength` | string | (Optional) Inpaint strength, e.g. `0.8` (default: `0.8`)                     |
| `guidance` | string | (Optional) Guidance scale, e.g. `8` (default: `8`)                           |

**Response** — `application/json`

```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### `GET /api/job/:jobId`

Polls the status and result of an erase job.

**Request** — URL parameter

| Parameter | Type   | Description            |
|-----------|--------|------------------------|
| `jobId`   | string | Job ID from submission |

**Response** — `application/json`

**Pending Job:**
```json
{
  "status": "pending"
}
```

**Completed Job:**
```json
{
  "status": "done",
  "success": true,
  "strength": 0.8,
  "guidance": 8,
  "imageUrl": "https://blob-storage.vercel.sh/erased-images/..."
}
```

**Failed Job:**
```json
{
  "status": "error",
  "success": false,
  "error": "Error message describing what went wrong"
}
```

**Error Responses**

| Status | Reason                  |
|--------|-------------------------|
| `404`  | Job not found/expired   |

## Technology Stack

| Layer             | Technology                                                        |
|-------------------|-------------------------------------------------------------------|
| Runtime           | [Cloudflare Workers](https://workers.dev)                         |
| Web Framework     | [Hono](https://hono.dev)                                          |
| OpenAPI           | [chanfana](https://github.com/cloudflare/chanfana)                |
| Schema Validation | [Zod](https://zod.dev)                                            |
| Image Processing  | [Jimp](https://github.com/jimp-dev/jimp)                          |
| Image Storage     | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)        |
| AI Model          | `@cf/runwayml/stable-diffusion-v1-5-inpainting` via Cloudflare AI |
| Language          | TypeScript                                                        |
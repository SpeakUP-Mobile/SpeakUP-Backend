import { Application } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import { MultipartReader } from "https://deno.land/std@0.97.0/mime/multipart.ts";
import { BufReader } from "https://deno.land/std@0.97.0/io/bufio.ts";

// Helper function to convert ReadableStream to Deno.Reader
function readableStreamToReader(
  stream: ReadableStream<Uint8Array>,
): Deno.Reader {
  const reader = stream.getReader();
  return {
    async read(p: Uint8Array): Promise<number | null> {
      const { done, value } = await reader.read();
      if (done) {
        return null;
      }
      p.set(value);
      return value.length;
    },
  };
}

const app = new Application();

app.use(async (ctx) => {
  const contentType = ctx.request.headers.get("content-type");
  if (!contentType || !contentType.startsWith("multipart/form-data")) {
    ctx.response.status = 400;
    ctx.response.body = "Invalid content type";
    return;
  }

  const boundary = contentType.split("=")[1];

  // Convert the stream to a Deno.Reader
  const stream = ctx.request.body({ type: "stream" }).value;
  const reader = readableStreamToReader(stream);

  const bufReader = new BufReader(reader);
  const multipartReader = new MultipartReader(bufReader, boundary);

  try {
    // Reading form data directly from the multipart reader without temp files
    const formData = await multipartReader.readForm(); // No maxMemory option

    // Check if it's a single file or multiple files
    const uploadedFile = formData.file("file"); // Use the actual field name from the form

    if (!uploadedFile) {
      ctx.response.status = 400;
      ctx.response.body = "Missing file";
      return;
    }

    // Handle multiple file cases
    const fileToProcess = Array.isArray(uploadedFile)
      ? uploadedFile[0]
      : uploadedFile;

    // Manually check the file size
    const fileSizeInBytes = fileToProcess.content?.byteLength;

    if (fileSizeInBytes === undefined) {
      ctx.response.status = 400;
      ctx.response.body = "File content is missing";
      return;
    }

    if (fileSizeInBytes > 150 * 1024 * 1024) { // 150MB size limit
      ctx.response.status = 413; // 413 Payload Too Large
      ctx.response.body = "File is too large";
      return;
    }

    // Prepare form data for Hume API
    //const humeApiKey = Deno.env.get("HUME_API_KEY");
    const humeApiKey = "w65sR2AjOKnNPdGEgBuHCM0GH2q2Orreu3oUiXPmgFmNogJp";
    if (!humeApiKey) {
      ctx.response.status = 500;
      ctx.response.body = "HUME_API_KEY environment variable is not set";
      return;
    }

    const humeEndpoint = "https://api.hume.ai/v0/batch/jobs";
    const formDataForHume = new FormData();

    if (fileToProcess.content) {
      formDataForHume.append(
        "file",
        new Blob([fileToProcess.content]),
        fileToProcess.filename || "upload",
      );
    }

    formDataForHume.append(
      "json",
      JSON.stringify({ Models: JSON.stringify({ burst: {} }) }),
    );

    const response = await fetch(humeEndpoint, {
      method: "POST",
      headers: {
        "X-Hume-Api-Key": humeApiKey,
      },
      body: formDataForHume,
    });

    if (!response.ok) {
      const errorText = await response.text();
      ctx.response.status = response.status;
      ctx.response.body = `Failed to start Hume inference job: ${errorText}`;
      return;
    }

    // Handle successful response
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      const result = await response.json();
      ctx.response.status = 201;
      ctx.response.body = `Inference job started successfully: ${
        JSON.stringify(result)
      }`;
    } else {
      const text = await response.text();
      ctx.response.status = 201;
      ctx.response.body = `Response from Hume API: ${text}`;
    }
  } catch (error) {
    console.error(error);
    ctx.response.status = 500;
    ctx.response.body = "An error occurred while processing the request";
  }
});

await app.listen({ port: 8000 });

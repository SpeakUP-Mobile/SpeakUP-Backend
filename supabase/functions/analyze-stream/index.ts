import { Application } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import { MultipartReader } from "https://deno.land/std@0.97.0/mime/multipart.ts";
import { BufReader } from "https://deno.land/std@0.97.0/io/bufio.ts";
import type { Reader } from "jsr:@std/io/types";

// Helper function to convert ReadableStream to Deno.Reader
// Used because streaming the video file to this edge function is much faster than uploading it
function readableStreamToReader(stream: ReadableStream<Uint8Array>): Reader {
  const reader = stream.getReader(); //Gets the data from the ReadableStream
  return {
    async read(p: Uint8Array): Promise<number | null> { //p vairable acts as a buffer to store streamed data
      const { done, value } = await reader.read(); //Asynchronously reads data from ReadableStream
      if (done) return null; //Returns null if stream is over
      p.set(value); //Places read bits into the buffer to be stored
      return value.length; //Prints the number of bits read
    },
  };
}

const app = new Application(); //Creates the server

app.use(async (ctx) => {
  //Must include -H "Content-Type: multipart/form-data" in POST Request in order for file streaming to work properly
  const contentType = ctx.request.headers.get("content-type");
  if (!contentType || !contentType.startsWith("multipart/form-data")) {
    ctx.response.status = 400;
    ctx.response.body = "Invalid content type";
    return;
  }

  // Get stream from POST body (ReadableStream type) and convert it to a Reader type
  const stream = ctx.request.body({ type: "stream" }).value;
  const reader = readableStreamToReader(stream);

  // By default, the HTTP boundary is ----WebKitFormBoundaryXlKlsdfsdf.
  //The server looks for this boundary to differentiate between different pieces of data sent in the POST request
  const boundary = contentType.split("=")[1];
  const bufReader = new BufReader(reader); //BufReader uses buffers to make streaming much more efficient
  const multipartReader = new MultipartReader(bufReader, boundary); //Multipart reader parses the multipart/form-data using the BufReader and the boundary

  try {
    // Reading form data directly from the multipart reader without temp files
    const formData = await multipartReader.readForm();

    // Check if it's a single file or multiple files
    const uploadedFile = formData.file("file"); // Use the actual field name from the form

    //Error if POST request did not include a file
    if (!uploadedFile) {
      ctx.response.status = 400;
      ctx.response.body = "Missing file";
      return;
    }

    // Handle the case where POST request contains more than one file
    const fileToProcess = Array.isArray(uploadedFile)
      ? uploadedFile[0]
      : uploadedFile;

    // Manually check the file size
    const fileSizeInBytes = fileToProcess.content?.byteLength;

    //Error if file is empty
    if (fileSizeInBytes === undefined) {
      ctx.response.status = 400;
      ctx.response.body = "File content is missing";
      return;
    }

    //Error if file is too big
    if (fileSizeInBytes > 150 * 1024 * 1024) { // 150MB size limit
      ctx.response.status = 413; // 413 Payload Too Large
      ctx.response.body = "File is too large";
      return;
    }

    //Securely gets API key from .env file (local) or supabase secrets manager (production)
    const humeApiKey = Deno.env.get("HUME_API_KEY");
    if (!humeApiKey) {
      ctx.response.status = 500;
      ctx.response.body = "HUME_API_KEY environment variable is not set";
      return;
    }

    const humeEndpoint = "https://api.hume.ai/v0/batch/jobs";
    const formDataForHume = new FormData(); //Create the multipart/form-data that will be sent to Hume

    //Add extra data to Hume inference job (models, transcription, etc.)
    formDataForHume.append(
      "json",
      JSON.stringify({
        models: {
          burst: {},
          face: null,
          prosody: null,
          language: null,
          ner: null,
          facemesh: null,
        },
      }),
    );

    //Add contents of streamed file to Hume form data
    if (fileToProcess.content) {
      formDataForHume.append(
        "file",
        new Blob([fileToProcess.content]),
        fileToProcess.filename || "upload",
      );
    }

    //Sends POST request to Hume
    const response = await fetch(humeEndpoint, {
      method: "POST",
      headers: {
        "X-Hume-Api-Key": humeApiKey,
      },
      body: formDataForHume,
    });

    //Handle errors with Hume
    if (!response.ok) {
      const errorText = await response.text();
      ctx.response.status = response.status;
      ctx.response.body = `Failed to start Hume inference job: ${errorText}`;
      return;
    }

    // Handle successful Hume response
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      const result = await response.json();
      ctx.response.status = 201;
      ctx.response.body = `Inference job started successfully: ${
        JSON.stringify(result)
      }`;
    } else { //Used in case result from Hume is not in JSON
      const text = await response.text();
      ctx.response.status = 201;
      ctx.response.body = `Response from Hume API: ${text}`;
    }
  } catch (error) { //Handles errors with file streaming
    console.error(error);
    ctx.response.status = 500;
    ctx.response.body = "An error occurred while processing the request";
  }
});

await app.listen({ port: 8000 });

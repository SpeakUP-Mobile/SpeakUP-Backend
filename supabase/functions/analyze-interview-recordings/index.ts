import { Application } from "https://deno.land/x/oak@v11.1.0/mod.ts";
import "https://deno.land/x/dotenv@v3.2.0/load.ts";

//TO TEST LOCALLY
//  1. Open Docker Desktop
//  2. Run supabase start in VSCode Terminal
//  3. Run supabase functions serve
//  4. Open a second terminal and run
//      curl -X POST \
//          -F "file=@path-to-test-video.mp4" \
//          http://localhost:54321/functions/v1/analyze-interview-recordings

const MB = 1024 * 1024;

const app = new Application();

app.use(async (ctx) => {
  // Read the incoming multipart/form-data request
  const body = ctx.request.body({ type: "form-data" });
  const formData = await body.value.read({
    maxSize: 150 * MB, // Limit the file size to 10 MB
  });

  // Check if file is present in the request
  if (!formData.files || !formData.files.length) {
    ctx.response.status = 400;
    ctx.response.body = "Missing file";
    return;
  }

  //Hume API key (for testing purposes)
  const humeApiKey = Deno.env.get("HUME_API_KEY");
  if (!humeApiKey) {
    throw new Error("HUME_API_KEY environment variable is not set");
  }

  // Retrieve the file from the form data
  const file = formData.files[0];
  //const timestamp = +new Date();
  //const uploadName = `${file.name}-${timestamp}`;

  // Create a FormData object for the Hume API request
  const formDataForHume = new FormData();
  formDataForHume.append("file", new Blob([file.content!.buffer]), file.name);

  // Specify the settings for Hume inference job
  formDataForHume.append(
    "transcription",
    JSON.stringify({
      langauge: "en",
    }),
  );

  try {
    // Send the file and model to the Hume API to start the inference job
    const humeEndpoint = "https://api.hume.ai/v0/batch/jobs";
    const response = await fetch(humeEndpoint, {
      method: "POST",
      headers: {
        "X-Hume-Api-Key": humeApiKey,
        // 'Content-Type': 'multipart/form-data' - This header is usually set automatically by the FormData object
      },
      body: formDataForHume,
    });

    // Check if response status is not OK
    if (!response.ok) {
      const errorText = await response.text(); // Get the error message from the response
      console.error(`Error response: ${errorText}`);
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
      // If the response is not JSON, return the response as text
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

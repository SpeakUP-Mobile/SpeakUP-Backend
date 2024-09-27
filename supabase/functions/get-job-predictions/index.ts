import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SESSION = new Supabase.ai.Session("llama3.1");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUBASE_SERVICE_ROLE_KEY");
const SUPABASE_URL = Deno.env.get("SUBASE_URL");

console.log("Hello from the Callback Function!");

Deno.serve(async (req) => {
  if (!SUPABASE_URL) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_URL not found in environment" }),
      { status: 500 },
    );
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({
        error: "SUPABASE_SERVICE_ROLE_KEY not found in environment",
      }),
      { status: 500 },
    );
  }

  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  );

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405 },
      );
    }

    const body = await req.json();
    console.log(body);

    const formattedJson = JSON.stringify(body, null);
    const fileBlob = new Blob([formattedJson], { type: "application/json" });
    const fileName = `${body.job_id}.json`;

    const url = body.predictions[0].source.url;
    const match = url.match(/\/users\/([a-f0-9\-]+)/);
    console.log(`Saving ${fileName} to ${match[1]}/analyzed-json/${fileName}`);
    const { error } = await supabase.storage.from("users").upload(
      `${match[1]}/analyzed-json/${fileName}`,
      fileBlob,
    );
    if (error) {
      console.error("Error uploading file:", error);
      return new Response(
        JSON.stringify({ error: "File upload failed", details: error.message }),
        { status: 500 },
      );
    }

    console.log(Deno.env.get("AI_INFERENCE_API_HOST"));

    type OutputChunk = { response?: string };

    const output = await SESSION.run(
      formattedJson +
        "Take this file and read the emotions in it. This is the result of an interview. I want you to take the data from this interview's emotions and tell the user what to improve and what they exceled in. It should be a short paragraph that just contains tips. Keep in mind that lower values indicate LESS of that emotion, and higher values indicate MORE of that emotion. Do not indicate actual values or emotions in the paragraph. Do not add interjections, make it somewhat formal.",
      { stream: true },
    ) as AsyncIterable<OutputChunk>;

    const headers = new Headers({
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let combinedResponse = "";

        try {
          for await (const chunk of output) {
            combinedResponse += chunk.response ?? "";
          }
          console.log(combinedResponse);
          const outputBlob = new Blob([combinedResponse], {
            type: "text/plain",
          });
          const outputName = `${body.job_id}.txt`;
          console.log(
            `Saving ${outputName} to ${match[1]}/llama-output/${outputName}`,
          );
          const { error } = await supabase.storage.from("users").upload(
            `${match[1]}/llama-output/${outputName}`,
            outputBlob,
          );
          if (error) {
            console.error("Error uploading file:", error);
            return new Response(
              JSON.stringify({
                error: "File upload failed",
                details: error.message,
              }),
              { status: 500 },
            );
          }
          controller.enqueue(encoder.encode(combinedResponse)); // Send the combined response to the client
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers,
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred", details: error.message }),
      { status: 500 },
    );
  }
});

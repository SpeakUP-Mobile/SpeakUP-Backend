console.log("Hello from the Callback Function!");
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const session = new Supabase.ai.Session("llama3.1");

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405 },
      );
    }

    const body = await req.json();
    console.log(body);

    const formattedJson = JSON.stringify(body, null, 2);

    type OutputChunk = { response?: string };

    const output = await session.run(
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
        let combinedResponse = ""; // Store combined chunks here

        try {
          for await (const chunk of output) {
            combinedResponse += chunk.response ?? ""; // Append each chunk to the combined string
          }
          console.log(combinedResponse); // Print the combined result at the end

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

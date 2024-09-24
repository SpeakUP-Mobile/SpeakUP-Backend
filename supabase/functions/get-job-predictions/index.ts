import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const session = new Supabase.ai.Session("llama3.1");
console.log("Hello from the Callback Function!");

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405 },
      );
    }

    const body = await JSON.stringify(req.json(), null, 2);
    console.log(body);

    type OutputChunk = { response?: string };

    const output = await session.run(
      body +
        "Take this file and read the emotions in it. This is the result of an interview. I want you to take the data from this interview's emotions and tell the user what to improve and what they exceled in.",
      { stream: true },
    ) as AsyncIterable<OutputChunk>;

    const headers = new Headers({
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for await (const chunk of output) {
            console.log(chunk.response);
            controller.enqueue(encoder.encode(chunk.response ?? ""));
          }
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

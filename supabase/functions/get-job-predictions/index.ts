import LlamaAI from "npm:llamaai";

console.log("Hello from the Callback Function!");

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

    const apiToken = Deno.env.get("LLAMA_API_KEY");
    const llamaAPI = new LlamaAI(apiToken);

    return new Response(JSON.stringify({ message: "success" }), {
      status: 500,
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred", details: error.message }),
      { status: 500 },
    );
  }
});

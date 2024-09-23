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

    // Check if the response contains either results or an error message
    const { jobId, predictions, error } = body;

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "Missing jobId" }),
        { status: 400 },
      );
    }

    if (error) {
      console.error(`Error for job ${jobId}:`, error);
      return new Response(
        JSON.stringify({ success: false, message: "Error received", error }),
        { status: 400 },
      );
    }

    if (predictions) {
      console.log(`Received predictions for job ${jobId}:`, predictions);
      // Process the predictions as needed (e.g., save to database)

      return new Response(
        JSON.stringify({ success: true, message: "Predictions processed" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "No predictions or error message found" }),
      { status: 400 },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred", details: error.message }),
      { status: 500 },
    );
  }
});

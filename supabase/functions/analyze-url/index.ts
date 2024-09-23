console.log("Hello from Functions!");

Deno.serve(async (req) => {
  try {
    const { videoUrl } = await req.json();
    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "No video URL provided" }), {
        status: 400,
      });
    }

    const humeApiKey = Deno.env.get("HUME_API_KEY");
    if (!humeApiKey) {
      return new Response(
        JSON.stringify({ error: "HUME_API_KEY not found in environment" }),
        { status: 500 },
      );
    }

    const callbackUrl = Deno.env.get("CALLBACK_URL");
    if (!callbackUrl) {
      return new Response(
        JSON.stringify({ error: "CALLBACK_URL not found in environment" }),
        { status: 500 },
      );
    }

    const humeResponse = await fetch(
      "https://api.hume.ai/v0/batch/jobs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hume-Api-Key": `${humeApiKey}`,
        },
        body: JSON.stringify({
          urls: [videoUrl],
          models: { face: {}, burst: {}, language: {}, prosody: {} },
          callback_url: callbackUrl,
        }),
      },
    );

    if (!humeResponse.ok) {
      const errorData = await humeResponse.json();
      return new Response(
        JSON.stringify({
          error: "Failed to send request to Hume API",
          details: errorData,
        }),
        { status: 500 },
      );
    }

    const responseData = await humeResponse.json();
    return new Response(JSON.stringify({ success: true, data: responseData }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred", details: error.message }),
      { status: 500 },
    );
  }
});

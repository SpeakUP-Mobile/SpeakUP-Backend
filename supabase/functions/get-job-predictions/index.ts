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
    let transcription = "";
    const models =
      body["predictions"][0]["results"]["predictions"][0]["models"];
    if (models["language"] != null) {
      const prosodyData =
        models["language"]["grouped_predictions"][0]["predictions"];
      for (let i = 0; i < prosodyData.length; i++) {
        transcription += prosodyData[i]["text"] + " ";
      }
    }
    console.log(transcription);
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
      `JSON: ${formattedJson}  Transcript: ${transcription}
        Look at the transcript. I want you to use this transcript and infer what question is being answered out of these questions 

Tell me about yourself,
Why do you want to work here,
What are your greatest strengths,
What are your weaknesses,
Why should we hire you,
What are your career goals,
Where do you see yourself in five years,
How did you hear about this position,
Why did you leave your last job,
Why do you want to change careers,
What can you contribute to our company,
Tell me about a time you made a mistake and how you handled it,
How do you handle stress and pressure,
Describe a difficult work situation and how you overcame it,
What motivates you to perform well,
What do you know about our company,
What is your greatest achievement,
How do you prioritize your work,
What do you like most about your current role,
What do you dislike about your current role,
How do you define success,
Do you prefer to work independently or in a team,
What are your salary expectations,
How do you handle feedback and criticism,
Can you describe your ideal work environment,
Tell me about a time when you worked on a team,
Tell me about a time when you had a conflict with a coworker,
Tell me about a time when you showed leadership,
Tell me about a time when you had to solve a problem under pressure,
Tell me about a time when you went above and beyond,
Tell me about a time you failed and how you learned from it,
Tell me about a time you had to adapt to change,
Describe a project you led and its outcome,
Tell me about a time when you worked with a difficult client,
How do you handle tight deadlines,
How do you stay organized when managing multiple projects,
Describe a time you had to manage conflicting priorities,
Tell me about a time when you had to make a difficult decision,
Tell me about a time when you disagreed with your manager,
Describe a time when you had to learn something new quickly,
How do you handle failure,
Tell me about a time when you mentored someone,
How do you manage stress during high-pressure situations,
Describe a time when you had to persuade others,
Tell me about a time when you showed initiative,
What specific skills make you qualified for this position,
Describe a time when you solved a challenging problem at work,
How do you stay updated with industry trends,
What technologies do you have experience with,
Can you walk me through a project you’ve worked on from start to finish,
How do you ensure the quality of your work,
Tell me about a recent technical challenge you faced,
How do you prioritize technical tasks when under pressure,
How do you handle unexpected technical issues,
What tools do you use to manage your work,
Tell me about your experience working with specific technology/tool,
What is your approach to debugging,
Describe your process for problem-solving,
How do you balance technical work with non-technical work,
How do you handle technical debt in your projects,
Tell me about a time you had to learn a new tool or language quickly,
What is your approach to testing and quality assurance,
How do you collaborate with non-technical team members,
Tell me about a technical decision you made that had a significant impact,
How do you approach continuous learning and skill development,
How do you align with our company values,
How do you handle diversity in the workplace,
Describe your work style,
What excites you about working at our company,
How would you fit into our company culture,
How do you handle working in a fast-paced environment,
How do you contribute to team morale,
How do you handle remote work or hybrid work environments,
How do you maintain a work-life balance,
How do you handle collaboration in a cross-functional team,
How do you stay motivated during repetitive tasks,
What do you expect from a manager,
How do you handle office politics,
How do you approach giving and receiving feedback,
What does teamwork mean to you,
How do you handle differences of opinion in a team,
What is your preferred communication style,
What do you like to do for fun outside of work,
What makes you excited to come to work each day,
How do you maintain productivity when working from home,
Can you tell me more about the day-to-day responsibilities of this role,
How do you measure success in this position,
What are the most important skills to succeed in this role,
What are the team dynamics like,
Can you describe the company’s culture,
What are the opportunities for growth within the company,
How does the company support work-life balance,
What challenges is the company currently facing,
What do you expect the successful candidate to achieve in the first 90 days,
What are the next steps in the interview process,
Can you tell me more about the team I would be working with,
What is the company’s approach to professional development,
What are the biggest challenges for someone in this role,
What’s the company’s stance on specific issue relevant to the industry,
How would you describe the company’s leadership style,

If you do not have a high certainty that question is being answered, please tell the user that they need to be more specific with their answer. 

I want you to analyze the transcript and the JSON data and provide feedback on maintaining a serious tone. Infer different emotions as professional and unprofessional, and then give recommendations.

Make it very concise. Do not include markdown elements, ONLY plaintext. Keep it to about a short 2-4 sentence paragraph.  No list with -, * etc, just sentences. Do not include newlines. Do not include characters not on a standard keyboard. Make sure the advice is specific to the transcript and json data. Remember, do not give suggestions for the questions. We need suggestions for the person answering. Also, do not say "the transcript says" Just say what the interviewee can improve.
              `,
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

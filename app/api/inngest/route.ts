import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Create an API route handler for Inngest
// This endpoint receives events from Inngest and executes the corresponding functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});

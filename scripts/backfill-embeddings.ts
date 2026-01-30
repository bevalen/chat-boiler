/**
 * Backfill Embeddings Script
 * 
 * Run this script to generate embeddings for existing data that doesn't have them.
 * Usage: npx tsx scripts/backfill-embeddings.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Load environment variables from .env.local
config({ path: ".env.local" });

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}

async function backfillMessages() {
  console.log("\n📝 Backfilling messages...");
  
  const { data: messages, error } = await supabase
    .from("messages")
    .select("id, content")
    .is("embedding", null)
    .limit(100);

  if (error) {
    console.error("Error fetching messages:", error);
    return;
  }

  if (!messages || messages.length === 0) {
    console.log("✓ No messages need backfilling");
    return;
  }

  console.log(`  Found ${messages.length} messages without embeddings`);

  // Process in batches of 20
  const batchSize = 20;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    const texts = batch.map((m) => m.content);
    
    try {
      const embeddings = await generateEmbeddings(texts);
      
      // Update each message
      for (let j = 0; j < batch.length; j++) {
        await supabase
          .from("messages")
          .update({ embedding: embeddings[j] })
          .eq("id", batch[j].id);
      }
      
      console.log(`  ✓ Processed ${Math.min(i + batchSize, messages.length)}/${messages.length} messages`);
    } catch (err) {
      console.error(`  ✗ Error processing batch:`, err);
    }
    
    // Rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function backfillContextBlocks() {
  console.log("\n📚 Backfilling context blocks...");
  
  const { data: blocks, error } = await supabase
    .from("context_blocks")
    .select("id, title, content")
    .is("embedding", null)
    .limit(100);

  if (error) {
    console.error("Error fetching context blocks:", error);
    return;
  }

  if (!blocks || blocks.length === 0) {
    console.log("✓ No context blocks need backfilling");
    return;
  }

  console.log(`  Found ${blocks.length} context blocks without embeddings`);

  for (const block of blocks) {
    const text = block.title ? `${block.title}\n\n${block.content}` : block.content;
    
    try {
      const embedding = await generateEmbedding(text);
      await supabase
        .from("context_blocks")
        .update({ embedding })
        .eq("id", block.id);
      console.log(`  ✓ Processed context block: ${block.title || block.id}`);
    } catch (err) {
      console.error(`  ✗ Error processing block ${block.id}:`, err);
    }
    
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function backfillProjects() {
  console.log("\n📁 Backfilling projects...");
  
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, description")
    .is("embedding", null)
    .limit(100);

  if (error) {
    console.error("Error fetching projects:", error);
    return;
  }

  if (!projects || projects.length === 0) {
    console.log("✓ No projects need backfilling");
    return;
  }

  console.log(`  Found ${projects.length} projects without embeddings`);

  for (const project of projects) {
    const text = project.description 
      ? `${project.title}\n\n${project.description}` 
      : project.title;
    
    try {
      const embedding = await generateEmbedding(text);
      await supabase
        .from("projects")
        .update({ embedding })
        .eq("id", project.id);
      console.log(`  ✓ Processed project: ${project.title}`);
    } catch (err) {
      console.error(`  ✗ Error processing project ${project.id}:`, err);
    }
    
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function backfillTasks() {
  console.log("\n✅ Backfilling tasks...");
  
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title, description")
    .is("embedding", null)
    .limit(100);

  if (error) {
    console.error("Error fetching tasks:", error);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log("✓ No tasks need backfilling");
    return;
  }

  console.log(`  Found ${tasks.length} tasks without embeddings`);

  // Process in batches
  const batchSize = 20;
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const texts = batch.map((t) => 
      t.description ? `${t.title}\n\n${t.description}` : t.title
    );
    
    try {
      const embeddings = await generateEmbeddings(texts);
      
      for (let j = 0; j < batch.length; j++) {
        await supabase
          .from("tasks")
          .update({ embedding: embeddings[j] })
          .eq("id", batch[j].id);
      }
      
      console.log(`  ✓ Processed ${Math.min(i + batchSize, tasks.length)}/${tasks.length} tasks`);
    } catch (err) {
      console.error(`  ✗ Error processing batch:`, err);
    }
    
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function backfillActionLog() {
  console.log("\n🔧 Backfilling action log...");
  
  const { data: actions, error } = await supabase
    .from("action_log")
    .select("id, tool_name, action, params, result")
    .is("embedding", null)
    .limit(100);

  if (error) {
    console.error("Error fetching action log:", error);
    return;
  }

  if (!actions || actions.length === 0) {
    console.log("✓ No actions need backfilling");
    return;
  }

  console.log(`  Found ${actions.length} actions without embeddings`);

  for (const action of actions) {
    // Create a text representation of the action
    const text = `Tool: ${action.tool_name}\nAction: ${action.action}\n` +
      (action.params ? `Parameters: ${JSON.stringify(action.params)}` : "");
    
    try {
      const embedding = await generateEmbedding(text);
      await supabase
        .from("action_log")
        .update({ embedding })
        .eq("id", action.id);
      console.log(`  ✓ Processed action: ${action.tool_name} - ${action.action}`);
    } catch (err) {
      console.error(`  ✗ Error processing action ${action.id}:`, err);
    }
    
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function main() {
  console.log("🚀 Starting embedding backfill...\n");
  console.log("=".repeat(50));

  // Check environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY");
    process.exit(1);
  }

  await backfillMessages();
  await backfillContextBlocks();
  await backfillProjects();
  await backfillTasks();
  await backfillActionLog();

  console.log("\n" + "=".repeat(50));
  console.log("✅ Backfill complete!");
}

main().catch(console.error);

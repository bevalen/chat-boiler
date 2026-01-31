import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";

/**
 * GET /api/extension/download
 * 
 * Download the LinkedIn SDR Chrome extension as a zip file
 */
export async function GET() {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in to download the extension" },
        { status: 401 }
      );
    }

    // Get the extension directory path
    const extensionDir = path.join(process.cwd(), "extensions", "linkedin-sdr");
    
    // Check if extension directory exists
    if (!fs.existsSync(extensionDir)) {
      return NextResponse.json(
        { error: "Extension files not found" },
        { status: 404 }
      );
    }

    // Create a zip archive
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    // Collect all chunks into a buffer
    const chunks: Buffer[] = [];
    
    archive.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    // Add the extension files to the archive
    archive.directory(extensionDir, "maia-linkedin-sdr");

    // Finalize the archive
    await archive.finalize();

    // Wait for all data to be collected
    await new Promise<void>((resolve, reject) => {
      archive.on("end", resolve);
      archive.on("error", reject);
    });

    // Combine chunks into a single buffer
    const zipBuffer = Buffer.concat(chunks);

    // Return the zip file
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=maia-linkedin-sdr.zip",
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[extension/download] Error:", error);
    return NextResponse.json(
      { error: "Failed to create extension download" },
      { status: 500 }
    );
  }
}

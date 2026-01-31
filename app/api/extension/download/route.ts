import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as fs from "fs";
import * as path from "path";
import archiver from "archiver";
import { PassThrough } from "stream";

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

    // Create zip buffer using a promise-based approach
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      // Create a zip archive
      const archive = archiver("zip", {
        zlib: { level: 9 }, // Maximum compression
      });

      // Use a passthrough stream to collect data
      const passthrough = new PassThrough();
      
      passthrough.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      passthrough.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      archive.on("error", (err) => {
        reject(err);
      });

      // Pipe archive to passthrough
      archive.pipe(passthrough);

      // Add the extension files to the archive
      archive.directory(extensionDir, "maia-linkedin-sdr");

      // Finalize the archive
      archive.finalize();
    });

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(zipBuffer);

    // Return the zip file
    return new NextResponse(uint8Array, {
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

/**
 * Hook for handling avatar uploads (user and agent)
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function useAvatarUpload(
  userId: string,
  type: "user" | "agent",
  currentAvatarUrl: string,
  onSuccess?: (url: string) => void
) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const supabase = createClient();
    const fileExt = file.name.split(".").pop();
    const filePath =
      type === "user" ? `users/${userId}/avatar.${fileExt}` : `${userId}/avatar.${fileExt}`;

    // Delete old avatar files to prevent orphaned files
    if (avatarUrl) {
      try {
        const folderPath = type === "user" ? `users/${userId}` : userId;
        const { data: existingFiles } = await supabase.storage
          .from("avatars")
          .list(folderPath);

        if (existingFiles && existingFiles.length > 0) {
          const filesToDelete = existingFiles.map(
            (file: { name: string }) => `${folderPath}/${file.name}`
          );
          await supabase.storage.from("avatars").remove(filesToDelete);
        }
      } catch (error) {
        console.error("Error deleting old avatar:", error);
      }
    }

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      setUploading(false);
      return { success: false, error: "Failed to upload avatar" };
    }

    // Get the public URL
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const newAvatarUrl = urlData.publicUrl;

    // Update record
    const table = type === "user" ? "users" : "agents";
    const { error: updateError } = await supabase
      .from(table)
      .update({ avatar_url: newAvatarUrl })
      .eq("id", userId);

    if (updateError) {
      setUploading(false);
      return { success: false, error: "Failed to save avatar URL" };
    }

    setAvatarUrl(newAvatarUrl);
    setUploading(false);
    onSuccess?.(newAvatarUrl);
    router.refresh();

    return { success: true, url: newAvatarUrl };
  };

  const handleRemove = async () => {
    if (!avatarUrl) return { success: false, error: "No avatar to remove" };

    const supabase = createClient();
    const folderPath = type === "user" ? `users/${userId}` : userId;

    // Delete files from storage
    try {
      const { data: existingFiles } = await supabase.storage
        .from("avatars")
        .list(folderPath);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map((file: { name: string }) => `${folderPath}/${file.name}`);
        await supabase.storage.from("avatars").remove(filesToDelete);
      }
    } catch (error) {
      console.error("Error deleting avatar files:", error);
    }

    // Update record to remove avatar URL
    const table = type === "user" ? "users" : "agents";
    const { error: updateError } = await supabase
      .from(table)
      .update({ avatar_url: null })
      .eq("id", userId);

    if (updateError) {
      return { success: false, error: "Failed to remove avatar" };
    }

    setAvatarUrl("");
    router.refresh();
    return { success: true };
  };

  return {
    avatarUrl,
    uploading,
    fileInputRef,
    handleUpload,
    handleRemove,
  };
}

# Email Attachment System

Complete email attachment handling system following Resend and Supabase best practices.

## Architecture

### Storage Structure
```
Supabase Storage Bucket: email-attachments/
├── {userId}/
│   ├── {agentId}/
│   │   ├── {emailId}/
│   │   │   ├── filename1.pdf
│   │   │   ├── filename2.jpg
│   │   │   └── ...
```

### Database Schema

**email_attachments table:**
- `id` - UUID primary key
- `email_id` - Foreign key to emails table
- `resend_attachment_id` - Resend's attachment ID
- `filename` - Original filename
- `content_type` - MIME type
- `size_bytes` - File size in bytes
- `storage_path` - Path in Supabase Storage
- `download_url` - Temporary URL (for Resend URLs, expires in 1 hour)
- `download_url_expires_at` - Expiration timestamp
- `is_downloaded` - Boolean flag if stored in Supabase
- `downloaded_at` - Timestamp of download

## How It Works

### 1. Inbound Email with Attachments

When an email with attachments arrives via Resend webhook:

```typescript
// Webhook receives attachment metadata
{
  attachments: [
    { id: "att_123", filename: "document.pdf", content_type: "application/pdf" }
  ]
}

// System immediately downloads (URLs expire in 1 hour!)
await downloadEmailAttachments(supabase, {
  resendEmailId: "email_456",
  emailId: "uuid-789",
  userId: "user-id",
  agentId: "agent-id",
  attachments: [...]
});
```

### 2. Storage Process

For each attachment:
1. Fetch download URL from Resend Attachments API
2. Download file content via fetch()
3. Upload to Supabase Storage (standard upload < 6MB)
4. Update database record with storage path and metadata

### 3. Access Patterns

#### UI Access (User)
```typescript
// Get signed URL for download (valid 1 hour)
GET /api/attachments/{id}
→ Returns signed URL from Supabase Storage
→ User clicks to download
```

#### Agent Access (AI)
```typescript
// List attachments for email
await listEmailAttachments({ emailId: "..." });

// Get attachment info
await getAttachmentInfo({ attachmentId: "..." });

// Read attachment content (for text files)
await readAttachmentContent({ attachmentId: "..." });
```

## Security

### Row Level Security (RLS)

**Storage Policies:**
- Users can only view attachments in their own folder (by user_id)
- Service role has full access for webhook processing
- No public access

**Database Policies:**
- Users can only read attachments for their own emails
- Agent verification before access

### Signed URLs
- All downloads use time-limited signed URLs (1 hour default)
- No direct storage access
- URLs regenerated on each request

## Best Practices Implemented

### From Resend
✅ Download immediately before URLs expire (1 hour)
✅ Use Attachments API to get download URLs
✅ Handle large files (Resend typically limits to ~25MB)

### From Supabase
✅ Standard uploads for files < 6MB
✅ RLS policies for secure access
✅ Organized folder structure
✅ Pre-signed URLs for time-limited access
✅ File size optimization

## API Reference

### For Developers

#### Download and Store
```typescript
import { downloadAndStoreAttachment } from "@/lib/email/attachments";

const result = await downloadAndStoreAttachment(supabase, {
  attachmentId: "att_123",
  resendEmailId: "email_456",
  userId: "user-id",
  agentId: "agent-id",
  emailId: "email-uuid",
  filename: "document.pdf",
  contentType: "application/pdf",
});
```

#### Get Signed URL
```typescript
import { getAttachmentSignedUrl } from "@/lib/email/attachments";

const { url } = await getAttachmentSignedUrl(
  supabase,
  "path/to/file.pdf",
  3600 // 1 hour
);
```

#### Direct Download (Server-side)
```typescript
import { downloadAttachment } from "@/lib/email/attachments";

const { data: blob } = await downloadAttachment(
  supabase,
  "path/to/file.pdf"
);
```

### For AI Agent

The agent has access to these tools:

**listEmailAttachments** - List all attachments for an email
```typescript
{
  emailId: "email-uuid"
}
```

**getAttachmentInfo** - Get detailed info about an attachment
```typescript
{
  attachmentId: "attachment-uuid"
}
```

**readAttachmentContent** - Download and read attachment content
```typescript
{
  attachmentId: "attachment-uuid"
}
// Returns text content for text files
// Returns metadata for binary files
```

## Migration

Run the migration to set up storage:
```bash
# Creates email-attachments bucket with RLS policies
supabase migration up
```

## Monitoring

Check logs for attachment processing:
- `[attachments]` - Download/upload operations
- `[resend-webhook]` - Webhook attachment processing
- `[api/attachments]` - API endpoint access

## Limitations

- Maximum file size: 50MB (configurable in bucket settings)
- Download URLs expire after 1 hour (Resend limitation)
- Standard upload used (for files < 6MB, Resend's typical limit)
- Resumable uploads available for larger files if needed

## Troubleshooting

**Attachment not downloading:**
- Check Resend download URL hasn't expired
- Verify Supabase Storage bucket exists
- Check RLS policies are correctly set up

**User can't download:**
- Verify `is_downloaded` flag is true
- Check `storage_path` is set
- Ensure user owns the email (RLS check)

**Agent can't access:**
- Verify agent owns the email
- Check attachment exists in database
- Ensure storage path is valid

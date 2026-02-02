# Email Attachments Setup Checklist

## ✅ Completed (via Supabase MCP)

- [x] Created `email-attachments` storage bucket
  - Project: MAIA (msqhgxibcqojysttibgd)
  - Bucket ID: `email-attachments`
  - Size Limit: 50MB
  - Public: false (private)
  - Applied: February 2, 2026

- [x] Database table exists
  - Table: `email_attachments`
  - Columns verified: id, email_id, filename, content_type, size_bytes, storage_path, etc.

- [x] Code implementation complete
  - Attachment download system
  - API endpoints
  - AI agent tools
  - UI integration

## ⚠️ Action Required: Storage Policies

**You must configure RLS policies in Supabase Dashboard before the system will work.**

### Steps to Complete:

1. **Open Supabase Dashboard**
   - URL: https://supabase.com/dashboard
   - Project: MAIA
   - Navigate to: Storage → Policies

2. **Create 4 Required Policies**
   
   Follow the detailed instructions in:
   ```
   supabase/STORAGE_POLICIES_SETUP.md
   ```

   Quick summary:
   - Policy 1: Users can SELECT own attachments
   - Policy 2: Service role can INSERT attachments
   - Policy 3: Service role can UPDATE attachments
   - Policy 4: Service role can DELETE attachments

3. **Verify Setup**
   - Send test email with attachment to your agent
   - Check attachment appears in database
   - Verify file stored in Supabase Storage
   - Test download from UI
   - Test agent attachment tools

## Testing Commands

### Check bucket exists:
```sql
SELECT * FROM storage.buckets 
WHERE id = 'email-attachments';
```

### Check table structure:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'email_attachments';
```

### Check policies (after setup):
```sql
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage';
```

## Troubleshooting

**If attachments aren't downloading:**
1. Check webhook logs for errors
2. Verify Resend API key is valid
3. Check Supabase service role key

**If users can't download:**
1. Verify RLS policies are configured
2. Check user authentication
3. Verify storage path is correct

**If agent can't access:**
1. Check agent has tools registered
2. Verify attachment exists in database
3. Check storage path and download status

## Additional Resources

- **Implementation Details**: `.docs/EMAIL_ATTACHMENTS_IMPLEMENTATION.md`
- **Developer Guide**: `lib/email/ATTACHMENTS_README.md`
- **Policy Setup**: `supabase/STORAGE_POLICIES_SETUP.md`

## Status

- [x] Code implemented
- [x] Database migration applied via MCP
- [x] Storage bucket created via MCP
- [ ] **RLS policies configured** ← **ACTION REQUIRED**
- [ ] System tested end-to-end
- [ ] Ready for production

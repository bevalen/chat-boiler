# Storage Policies Setup Guide

## ⚠️ Manual Configuration Required

The `email-attachments` storage bucket has been created via migration, but **Row Level Security (RLS) policies must be configured manually** in the Supabase Dashboard.

This is because Supabase manages storage RLS policies through a special interface that requires dashboard access.

## Setup Instructions

### 1. Navigate to Storage Policies

1. Open your Supabase Dashboard: https://supabase.com/dashboard
2. Select the **MAIA** project
3. Go to **Storage** in the left sidebar
4. Click on the **Policies** tab
5. Find the `email-attachments` bucket

### 2. Create Policy: Users Can View Own Attachments

**Policy Name:** `Users can view own email attachments`

**Allowed Operation:** `SELECT`

**Target Roles:** `authenticated`

**USING Expression:**
```sql
bucket_id = 'email-attachments' 
AND (storage.foldername(name))[1] IN (
  SELECT user_id::text 
  FROM public.agents 
  WHERE user_id = auth.uid()
)
```

**What it does:** Allows users to view/download attachments only in their own user folder.

---

### 3. Create Policy: Service Role Can Insert

**Policy Name:** `Service role can insert email attachments`

**Allowed Operation:** `INSERT`

**Target Roles:** `service_role`

**WITH CHECK Expression:**
```sql
bucket_id = 'email-attachments'
AND auth.role() = 'service_role'
```

**What it does:** Allows the backend service to upload attachments during webhook processing.

---

### 4. Create Policy: Service Role Can Update

**Policy Name:** `Service role can update email attachments`

**Allowed Operation:** `UPDATE`

**Target Roles:** `service_role`

**USING Expression:**
```sql
bucket_id = 'email-attachments'
AND auth.role() = 'service_role'
```

**What it does:** Allows the backend to update attachment metadata if needed.

---

### 5. Create Policy: Service Role Can Delete

**Policy Name:** `Service role can delete email attachments`

**Allowed Operation:** `DELETE`

**Target Roles:** `service_role`

**USING Expression:**
```sql
bucket_id = 'email-attachments'
AND auth.role() = 'service_role'
```

**What it does:** Allows the backend to delete attachments when emails are deleted.

---

## Verification

After setting up the policies, verify they work correctly:

### Test User Access
```sql
-- As an authenticated user, this should work:
SELECT * FROM storage.objects 
WHERE bucket_id = 'email-attachments' 
AND name LIKE 'your-user-id/%'
LIMIT 5;
```

### Test Restrictions
```sql
-- This should return empty (can't see other users' files):
SELECT * FROM storage.objects 
WHERE bucket_id = 'email-attachments' 
AND name LIKE 'other-user-id/%'
LIMIT 5;
```

## Alternative: Supabase CLI (Advanced)

If you prefer CLI setup, you can use:

```bash
# Enable RLS on storage.objects (usually already enabled)
supabase sql "ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;"

# Create policies using supabase CLI
supabase sql "CREATE POLICY ... ON storage.objects ..."
```

However, this requires elevated permissions and is more error-prone than using the Dashboard.

## Security Notes

✅ **Correctly Configured:**
- Users isolated by user_id folder structure
- Service role has full access for automation
- No public access
- Authentication required for all operations

❌ **Common Mistakes to Avoid:**
- Don't make the bucket public
- Don't skip the user folder check in SELECT policy
- Don't allow authenticated users to INSERT (only service role should)
- Don't forget to verify policies work before going to production

## Support

If you encounter issues setting up policies, check:
1. Supabase Dashboard > Storage > Policies shows your policies
2. Test with actual file upload/download
3. Check browser console for storage errors
4. Review Supabase logs in Dashboard > Logs

## Status

- [x] Bucket created via migration
- [ ] User SELECT policy configured
- [ ] Service role INSERT policy configured
- [ ] Service role UPDATE policy configured
- [ ] Service role DELETE policy configured
- [ ] Policies tested and verified

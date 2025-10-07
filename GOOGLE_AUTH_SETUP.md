# Google Authentication Configuration for Supabase

Follow these steps to set up Google OAuth authentication in your Supabase project:

## 1. Create OAuth Credentials in Google Cloud Console

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to "APIs & Services" > "Credentials".
4. Click "Create Credentials" and select "OAuth client ID".
5. Configure the OAuth consent screen:
   - User Type: External
   - App name: BeyondChats Revision App
   - User support email: Your email
   - Developer contact information: Your email
   - Authorized domains: Add your domain or leave as is for development
6. Save and continue.
7. For Application type, select "Web application".
8. Name: BeyondChats Revision App
9. Add authorized JavaScript origins:
   - `http://localhost:5173` (for local development)
   - `https://yourdomain.com` (for production)
10. Add authorized redirect URIs:
   - `http://localhost:5173/auth/callback`
   - `https://nxrqsrlihbyytnzhfrlq.supabase.co/auth/v1/callback`
   - `https://yourdomain.com/auth/callback` (for production)
11. Click "Create" to generate your Client ID and Client Secret.

## 2. Configure Supabase Authentication

1. Go to your [Supabase Dashboard](https://app.supabase.com/).
2. Select your project (ID: nxrqsrlihbyytnzhfrlq).
3. Navigate to "Authentication" > "Providers".
4. Find "Google" in the list and click "Enable".
5. Enter the OAuth credentials from Google Cloud Console:
   - Client ID: The client ID you got from Google
   - Client Secret: The client secret you got from Google
6. Set the Redirect URL to: `https://nxrqsrlihbyytnzhfrlq.supabase.co/auth/v1/callback`
7. Save the configuration.

## 3. Update Environment Variables

1. Update your server's `.env` file with the Google Client ID and Client Secret:
   ```
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   ```

2. Get your Supabase Service Role Key:
   - In your Supabase Dashboard, go to Project Settings > API.
   - Find the "service_role" key (caution: this has admin privileges).
   - Add it to your server's `.env` file:
   ```
   SUPABASE_SERVICE_KEY=your_service_role_key_here
   ```

3. Get your JWT Secret for token verification:
   - In your Supabase Dashboard, go to Project Settings > API > JWT Settings.
   - Copy the JWT Secret.
   - Add it to your server's `.env` file:
   ```
   SUPABASE_JWT_SECRET=your_jwt_secret_here
   ```

## 4. Create User Profiles Table in Supabase

Run this SQL in your Supabase SQL Editor:

```sql
-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create a unique index on user_id
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles (user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own profile
CREATE POLICY "Users can view own profile" 
  ON user_profiles 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Create policy for users to update their own profile
CREATE POLICY "Users can update own profile" 
  ON user_profiles 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Grant permissions to authenticated users
GRANT SELECT, UPDATE ON user_profiles TO authenticated;
GRANT USAGE ON SEQUENCE user_profiles_id_seq TO authenticated;
```

## 5. Test the Authentication Flow

1. Start your client application (on port 5173).
2. Start your server application (on port 5000).
3. Visit http://localhost:5173/login.
4. Click "Sign in with Google" and complete the authentication flow.
5. You should be redirected to your application's home page after successful authentication.

## Troubleshooting

- If you see CORS errors, ensure your Supabase Site URL is configured correctly.
- If the redirect fails, check that your callback URLs are properly registered in both Google and Supabase.
- For token validation issues, verify the JWT Secret is correctly set in your server's .env file.
- Check the browser console and server logs for detailed error messages.
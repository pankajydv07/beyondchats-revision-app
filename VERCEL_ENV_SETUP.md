# Vercel Environment Variables Setup

## Frontend Project (beyondchats-revision-app)
Add these environment variables to your Vercel project settings:

- VITE_API_URL=https://beyondchats-revision-api.vercel.app
- VITE_SUPABASE_URL=https://raxggnlgcrpfzsjdppnx.supabase.co
- VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJheGdnbmxnY3JwZnpzamRwcG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTIzMzI5NzgsImV4cCI6MjAwNzkwODk3OH0.gE88mfnOXObZqI3nFDdSQF7NfRoP8WaFV7muRxiECKI
- VITE_BASE_URL=https://beyondchats-revision-app.vercel.app

## How to Add Environment Variables in Vercel:
1. Go to your Vercel dashboard
2. Select your project
3. Click on 'Settings' tab
4. Navigate to 'Environment Variables' section
5. Add each variable and its value
6. Click 'Save'
7. Redeploy your project for the changes to take effect

## Additional Notes:
- Remember to fix the CORS issue in your backend code by removing the trailing slash from the allowed origin
- Make sure your backend API is deployed and accessible at the URL you specified in VITE_API_URL
- After deployment, verify that authentication works correctly
# BeyondChats Revision App

A full-stack application for AI-powered PDF learning with chat and quiz features.

## Features

- 📄 PDF upload and viewing
- 💬 AI-powered chat about PDF content (RAG)
- 📝 Auto-generated quizzes from PDF content
- 🎨 Modern React + Tailwind UI
- 🚀 Node.js + Express backend
- 🐳 Docker support

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup & Run

1. **Clone and bootstrap:**
   ```bash
   git clone <your-repo-url>
   cd beyondchats-revision-app
   chmod +x scripts/bootstrap.sh
   ./scripts/bootstrap.sh
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### With Docker

```bash
docker-compose up --build
```

## Project Structure

```
beyondchats-revision-app/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Route components
│   │   └── ...
│   └── package.json
├── server/                # Node + Express backend
│   ├── server.js         # Main server file
│   ├── uploads/          # PDF upload directory
│   └── package.json
├── scripts/
│   └── bootstrap.sh      # Setup script
├── docker-compose.yml
└── README.md
```

## API Endpoints

- `POST /api/upload-pdf` - Upload PDF file
- `POST /api/extract-text` - Extract text from PDF
- `POST /api/generate-quiz` - Generate quiz from PDF content
- `POST /api/embeddings` - Create embeddings for RAG
- `POST /api/rag-query` - Query PDF content using RAG

## Tech Stack

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- React Router
- React PDF
- Axios

**Backend:**
- Node.js
- Express
- Multer (file uploads)
- PDF-parse
- CORS

## Environment Variables

Create a `.env` file in the root directory:

```env
NEBIUS_API_KEY=your_nebius_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here
```

## Development

### Manual Setup

**Install dependencies:**
```bash
# Install client dependencies
cd client && npm install

# Install server dependencies  
cd ../server && npm install
```

**Run in development mode:**
```bash
# Terminal 1 - Start server
cd server && npm run dev

# Terminal 2 - Start client
cd client && npm run dev
```

## TODO

- [ ] Implement actual LLM integration (Nebius/OpenAI)
- [ ] Add vector database for embeddings (Supabase/Pinecone)
- [ ] Implement user authentication
- [ ] Add PDF text highlighting
- [ ] Improve quiz functionality with scoring
- [ ] Add more robust error handling
- [ ] Add tests

## License

MIT
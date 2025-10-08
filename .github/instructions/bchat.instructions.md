---
applyTo: '**'
---


## 🧠 Setup & Project Structure

**Prompt:**

> @workspace create a full-stack web app (React + Node.js + Express + MongoDB) called “BeyondChats”.
> The app should allow students to upload PDFs, view them, generate quizzes, and chat with an AI tutor.
> Set up folders for `/client` and `/server` with proper structure.
> Also include `.env`, `README.md`, and setup scripts.

---

## 📂 Feature 1: Source Selector (Upload & Choose PDFs)

**Prompt:**

> @workspace create a React component called `SourceSelector.jsx` with two options:
> 1️⃣ View all uploaded PDFs
> 2️⃣ Select a specific PDF
> Include a file upload input that allows PDF upload to the backend (`/upload`).
> Use Axios to handle API calls and show the list of uploaded PDFs.

---

## 📄 Feature 2: PDF Viewer

**Prompt:**

> @workspace create a `PdfViewer.jsx` component that displays a selected PDF.
> Use `react-pdf` or `pdf.js` to render it.
> Allow pagination (next/previous page).
> Make it responsive and display alongside the chat section in a split layout using CSS grid or Flexbox.

---

## 🧩 Feature 3: Quiz Generator Engine

**Prompt:**

> @workspace implement a backend API `/generateQuiz` that accepts a PDF text and question type (`MCQ`, `SAQ`, `LAQ`).
> Use OpenAI API (or another LLM) to generate questions and explanations.
> Store the quiz and responses in MongoDB with fields: `userId`, `pdfId`, `questions`, `answers`, `score`.
> On the frontend, build a `Quiz.jsx` component to render questions, accept user answers, and show score and explanations after submission.

---

## 📊 Feature 4: Progress Tracking Dashboard

**Prompt:**

> @workspace create a simple dashboard component `ProgressDashboard.jsx` that shows:
>
> * Total quizzes attempted
> * Average score
> * Strengths and weaknesses by topic
>   Fetch data from `/progress` API (Node.js backend).
>   Use Chart.js or Recharts for visualization.
>   Ensure the UI is clean and mobile responsive.

---

## 💬 Nice-to-Have: Chat UI (ChatGPT-style)

**Prompt:**

> @workspace create a Chat UI inspired by ChatGPT.
> It should have:
>
> * Left sidebar listing chats
> * Main chat area
> * Input box at the bottom
> * "New Chat" button
>   Style it using Tailwind CSS.
>   Each chat should be saved in MongoDB (`chatId`, `messages`, `pdfContext`).
>   Implement `/chat` API that takes user messages + selected PDF content and returns AI responses.

---

## 📚 Nice-to-Have: RAG (Retrieval-Augmented Generation) with Citations

**Prompt:**

> @workspace implement a RAG pipeline:
>
> 1. Chunk uploaded PDF text into sections.
> 2. Generate embeddings (use OpenAI Embeddings API or local model).
> 3. Store them in a vector database (like Pinecone or Supabase Vector).
> 4. When a user asks a question, retrieve relevant chunks, cite page numbers, and generate a contextual answer.
>    Example response:
>    “According to p. 23: ‘Force is directly proportional to acceleration’.”

---

## ▶️ YouTube Recommender (Bonus Feature)

**Prompt:**

> @workspace create a `/recommendVideos` API that takes a topic or PDF chapter name and returns 5 educational YouTube videos using YouTube Data API.
> Display them below the chat or quiz section in a `VideoRecommendations.jsx` component.

---

## 🧾 README.md Generation

**Prompt:**

> @workspace generate a professional README.md for this project that includes:
>
> * Project overview
> * Features implemented
> * Tech stack
> * Setup & run instructions
> * How you used GitHub Copilot or LLMs to build it
> * Live demo link (placeholder)

---


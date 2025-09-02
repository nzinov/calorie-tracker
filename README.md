# Calorie Tracker

A modern, AI-powered calorie tracking application built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🔐 **Google OAuth Authentication** - Secure login with Google accounts (dev mode available)
- 📊 **Daily Nutrition Tracking** - Track calories, protein, carbs, fat, and fiber
- 🤖 **AI-Powered Food Logging** - Natural language food entry with OpenRouter API
- 💬 **Day-Specific Chat History** - Persistent chat sessions tied to daily logs
- 📈 **Progress Visualization** - Interactive charts and progress bars
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile
- 🗄️ **Database Support** - SQLite (dev) / PostgreSQL (prod) with Prisma ORM

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Authentication**: NextAuth.js with Google OAuth (dev mode bypass)
- **AI**: OpenRouter API (Claude 3.5 Sonnet)
- **Charts**: Recharts
- **Deployment**: Railway

## Daily Nutrition Targets

- Calories: 2000 kcal
- Protein: 156g
- Fat: 78g
- Carbohydrates: 165g
- Fiber: 37g

## Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd calorie_tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables (optional for local dev)**
   For AI chat functionality, either:
   - Create `~/.openrouter.token` file with your OpenRouter API key, or
   - Set `OPENROUTER_API_KEY` environment variable
   
   Optional `.env` file:
   ```env
   DATABASE_PROVIDER="sqlite"
   DATABASE_URL="file:./dev.db"
   ```
   
   Note: For local development, authentication is disabled and SQLite database is used by default.

4. **Set up the database (SQLite in dev)**
   ```bash
   # Generate client and sync schema to local SQLite
   npx prisma generate
   npx prisma db push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

## Railway Deployment

### Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **Google OAuth App**: Create a Google OAuth application
3. **OpenRouter Account**: Get an API key from [openrouter.ai](https://openrouter.ai)

### Deployment Steps

1. **Connect your repository to Railway**
   - Go to Railway dashboard
   - Click "New Project"
   - Connect your GitHub repository

2. **Add a PostgreSQL database**
   - In your Railway project, click "New Service"
   - Select "Database" → "PostgreSQL"
   - Railway will automatically provide a DATABASE_URL

3. **Set environment variables**
   In your Railway project settings, add these variables:
   ```
   DATABASE_PROVIDER=postgresql
   DATABASE_URL=<postgres-connection-string-from-railway>
   NEXTAUTH_SECRET=<generate-a-random-secret>
   NEXTAUTH_URL=https://your-app-name.railway.app
   GOOGLE_CLIENT_ID=<your-google-client-id>
   GOOGLE_CLIENT_SECRET=<your-google-client-secret>
   OPENROUTER_API_KEY=<your-openrouter-api-key>
   ```

4. **Deploy**
   - Railway will automatically deploy when you push to your main branch
   - The first deployment will run database migrations automatically

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Create OAuth 2.0 credentials
5. Add your Railway domain to authorized redirect URIs:
   - `https://your-app-name.railway.app/api/auth/callback/google`

### Database Migrations

- Development (SQLite): use `npx prisma db push` to sync the schema to your local SQLite file. This avoids generating SQLite-specific migrations that are not compatible with PostgreSQL.
- Production (PostgreSQL): migrations are included in the repo and will be applied during deploy. To run them manually:
  ```bash
  npx prisma migrate deploy
  ```

## Project Structure

```
src/
├── app/                 # Next.js app directory
│   ├── api/            # API routes
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # React components
├── hooks/             # Custom React hooks
├── lib/               # Utility functions
└── generated/         # Generated Prisma client

prisma/
└── schema.prisma      # Database schema
```

## API Endpoints

- `GET /api/daily-logs` - Get daily nutrition log
- `POST /api/food-entries` - Add food entry
- `PUT /api/food-entries/[id]` - Update food entry
- `DELETE /api/food-entries/[id]` - Delete food entry
- `POST /api/chat` - AI chat interface
- `GET /api/chat-sessions` - Get chat sessions for a date
- `POST /api/chat-sessions` - Create new chat session
- `POST /api/chat-sessions/[id]/messages` - Add message to chat session

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

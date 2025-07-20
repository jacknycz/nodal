# Nodal 🧠

A collaborative mindmapping app designed for creative brainstorming, note-taking, and idea mapping. Nodal combines a clean, fluid front-end with AI-driven interactions, allowing users to map thoughts visually and enhance them through AI suggestions.

## ✨ Features

- **Visual Mindmapping** - Create and organize ideas with an intuitive node-based interface
- **AI-Powered Brainstorming** - Generate ideas, expand concepts, and get suggestions from AI
- **Document Integration** - Upload and process documents (PDFs, text files) for AI context
- **Real-time Collaboration** - Multi-user support for team brainstorming sessions
- **Cloud Storage** - Save and sync your boards across devices with Supabase
- **Focus Mode** - Highlight and focus on specific parts of your mindmap
- **Beautiful UI** - Modern, responsive design with dark/light theme support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key (for AI features)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd nodal
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Add your OpenAI API key to `.env.local`:
```
VITE_OPENAI_API_KEY=your_api_key_here
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **State Management**: Zustand
- **UI Components**: Pres Start (internal design system)
- **Styling**: Tailwind CSS
- **Node Graph**: XYFlow (React Flow successor)
- **Backend**: Supabase (Auth, Database, Storage)
- **AI Integration**: OpenAI API
- **Authentication**: Google OAuth + Email/Password

## 📁 Project Structure

```
src/
├── components/          # React components
├── features/           # Feature-based modules
│   ├── ai/            # AI integration
│   ├── auth/          # Authentication
│   ├── board/         # Board management
│   ├── nodes/         # Node components
│   ├── storage/       # Data persistence
│   └── focus/         # Focus system
├── hooks/             # Custom React hooks
├── contexts/          # React contexts
└── types/             # TypeScript type definitions
```

## 🎯 Key Concepts

- **Board** - The main canvas containing nodes and edges
- **Node** - Individual content units (text, documents, AI-generated content)
- **Board Room** - Dashboard for managing saved boards
- **Focus Tree** - System for highlighting related nodes
- **AI Context** - Document processing and semantic search

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production (includes type checking)
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style

- **TypeScript**: Strict mode enabled, no `any` types
- **React**: Functional components with hooks only
- **Styling**: Tailwind CSS with Pres Start design system
- **State**: Zustand for global state, local state for UI



## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/)
- Powered by [OpenAI](https://openai.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Hosted on [Supabase](https://supabase.com/)

---

**Nodal** - Where ideas take shape 🧠✨

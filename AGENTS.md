# ScienceClaw Agent Guidelines

- Repo: https://github.com/AgentTeam-TaichuAI/ScienceClaw
- In chat replies, file references must be repo-root relative only (example: `ScienceClaw/backend/deepagent/agent.py`); never absolute paths or `~/...`.
- Do not edit files that could affect security, authentication, or production infrastructure without explicit approval. Treat those paths as restricted surfaces.

## Project Overview

ScienceClaw is a personal research assistant built with [LangChain DeepAgents](https://github.com/langchain-ai/deepagents) and [AIO Sandbox](https://github.com/agent-infra/sandbox). It offers:

- **1,900+ built-in scientific tools** spanning drug discovery, astronomy, earth science, chemistry, biodiversity, and academic literature
- **Multi-format content generation** (PDF, DOCX, PPTX, XLSX)
- **Fully local & privacy-first** - all data stays in local `./workspace` directory
- **Docker-isolated execution** - security first architecture

## Architecture Overview

```
ScienceClaw/
├── docker-compose.yml              # 10-service orchestration (developer build)
├── docker-compose-release.yml      # Pre-built image orchestration (end users)
├── docker-compose-china.yml        # China mirror acceleration
├── images/                         # Static assets
├── videos/                         # Demo videos
├── Tools/                          # Custom tools (hot-reload)
├── Skills/                         # User & community skill packages
├── workspace/                      # Local workspace (data never leaves your machine)
└── ScienceClaw/
    ├── backend/                    # FastAPI backend
    │   ├── deepagent/              # Core AI agent engine (LangGraph)
    │   ├── builtin_skills/         # 9 built-in skills (pdf, docx, pptx, xlsx, ...)
    │   ├── route/                  # REST API routes
    │   ├── im/                     # IM integrations (Feishu / Lark)
    │   ├── mongodb/                # Database access layer
    │   └── user/                   # User management
    ├── frontend/                   # Vue 3 + Tailwind frontend
    ├── sandbox/                    # Isolated code execution environment
    ├── task-service/               # Scheduled task service (cron jobs)
    └── websearch/                  # Search & crawl microservice
```

## Service Architecture

| Service | Port | Description |
|---------|------|-------------|
| `sandbox` | 18080 | AIO Sandbox - isolated code execution |
| `backend` | 12001 | FastAPI backend - agent engine |
| `frontend` | 5173 | Vue 3 frontend |
| `mongo` | 27014 | MongoDB database |
| `redis` | 6379 | Redis cache |
| `searxng` | 26080 | Meta-search engine |
| `websearch` | 8068 | Web search + crawl service |
| `scheduler_api` | 12002 | Task scheduling API |
| `celery_worker` | - | Background task worker |
| `celery_beat` | - | Scheduled task scheduler |

## Tech Stack

- **Backend**: Python 3.11+, FastAPI 0.128+, LangChain, LangGraph, DeepAgents 0.4.4
- **Frontend**: Vue 3, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Database**: MongoDB (Motor async driver), Redis
- **Agent**: LangChain DeepAgents, AIO Sandbox
- **Tools**: ToolUniverse (1,900+ scientific tools), SearXNG, Crawl4AI
- **IM**: Feishu/Lark (lark-oapi)
- **Infrastructure**: Docker, Docker Compose

## Core Modules

### DeepAgent Engine (`ScienceClaw/backend/deepagent/`)

| File | Purpose |
|------|---------|
| `agent.py` | Core agent implementation |
| `engine.py` | Agent engine orchestration |
| `runner.py` | Agent execution runner |
| `sessions.py` | Session management |
| `tools.py` | Built-in tool definitions |
| `tooluniverse_tools.py` | ToolUniverse integration |
| `diagnostic.py` | Diagnostic mode for debugging |
| `plan_types.py` | Plan type definitions |
| `sse_protocol.py` | SSE streaming protocol |
| `sse_middleware.py` | SSE middleware |

### Built-in Skills (`ScienceClaw/backend/builtin_skills/`)

| Skill | Purpose |
|-------|---------|
| `pdf` | PDF generation, OCR, merge, split |
| `docx` | Word document creation |
| `pptx` | PowerPoint generation |
| `xlsx` | Excel spreadsheet creation |
| `tool-creator` | Create custom @tool functions |
| `skill-creator` | Create custom skills |
| `find-skills` | Discover community skills |
| `tooluniverse` | Access 1,900+ scientific tools |

### Frontend (`ScienceClaw/frontend/src/`)

| Directory | Purpose |
|-----------|---------|
| `api/` | API client |
| `components/` | Vue components |
| `composables/` | Composables |
| `pages/` | Page views |
| `types/` | TypeScript types |
| `utils/` | Utilities |

## Tool Architecture (Four Layers)

| Layer | Description | Examples |
|-------|-------------|----------|
| Built-in Tools | Core search & crawl | `web_search`, `web_crawl` |
| ToolUniverse | 1,900+ scientific tools | UniProt, OpenTargets, FAERS |
| Sandbox Tools | File & code operations | `read_file`, `write_file`, `execute`, `shell` |
| Custom @tool | User-defined Python | Place in `Tools/` directory |

## Skill System

Skills are **structured instruction documents (SKILL.md)** that guide the Agent through complex, multi-step workflows.

- **Natural language creation** - Describe workflow in chat, agent creates it automatically
- **Manual installation** - Place folder with `SKILL.md` into `Skills/`
- **Hot reload** - Tools and skills auto-reload without restart

## Environment Variables

### Backend (`ScienceClaw/backend/`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SANDBOX_REST_URL` | http://sandbox:8080 | Sandbox API URL |
| `WORKSPACE_DIR` | /home/scienceclaw | Local workspace |
| `DS_API_KEY` | - | DeepSeek API key |
| `DS_URL` | https://api.deepseek.com/v1 | API base |
| `DS_MODEL` | deepseek-chat | Model name |
| `MONGODB_HOST` | mongo | MongoDB host |
| `LARK_APP_ID` | - | Feishu app ID |
| `LARK_APP_SECRET` | - | Feishu app secret |
| `DIAGNOSTIC_MODE` | 1 | Enable diagnostic logging |

### Sandbox

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBSEARCH_URL` | http://websearch:8068 | Search service URL |
| `TZ` | Asia/Shanghai | Timezone |

## Build, Test, and Development Commands

### Prerequisites

- Docker & Docker Compose (Docker Desktop includes Compose)
- Recommended system RAM >= 8 GB
- Node.js 20+ (for frontend development)

### Development Setup

```bash
# First launch - build from source
docker compose up -d --build

# Daily launch - fast startup
docker compose up -d

# Pull pre-built images (recommended for users)
docker compose -f docker-compose-release.yml up -d --pull always

# China users - build with mirror
docker compose -f docker-compose-china.yml up -d --build
```

### Service Management

```bash
# Check status
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f sandbox

# Restart single service
docker compose restart backend

# Stop services
docker compose down

# Stop single service
docker compose stop backend
```

### Frontend Development

```bash
cd ScienceClaw/frontend
npm install
npm run dev
```

### Backend Development

Backend auto-reloads with `--reload` flag in docker-compose.

```bash
# View backend logs
docker compose logs -f backend

# Backend runs at http://localhost:12001
# Frontend runs at http://localhost:5173
```

## Coding Style & Conventions

### Backend (Python)

- **Framework**: FastAPI with async/await
- **Database**: Motor (async MongoDB driver)
- **Agent**: LangChain, LangGraph, DeepAgents
- **Type hints**: Use where possible
- **Formatting**: Follow PEP 8

### Frontend (TypeScript/Vue)

- **Framework**: Vue 3 Composition API
- **State**: Pinia
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui pattern
- **Formatting**: ESLint + Prettier

### File Naming

- Python: `snake_case.py`
- TypeScript: `camelCase.ts` or `PascalCase.ts` (for components)
- Skills: `SKILL.md` (uppercase)
- Tools: `*.py` with `@tool` decorator

### Security Conventions

- Never commit real credentials or API keys
- Use environment variables for secrets
- Workspace files (`./workspace/`) are local-only
- Sandbox isolation prevents host access
- Default admin: `admin` / `admin123` (change on first login)

## Testing Guidelines

### Manual Testing

```bash
# Check all services health
docker compose ps

# Test backend API
curl http://localhost:12001/api/v1/auth/status

# Test sandbox
curl http://localhost:18080/v1/docs
```

### Diagnostic Mode

Enable `DIAGNOSTIC_MODE=1` in backend to log full LLM call context for debugging.

### Log Viewing

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f sandbox
docker compose logs -f websearch
```

## Database Schema

### MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts and authentication |
| `sessions` | Agent conversation sessions |
| `files` | File metadata and references |
| `tasks` | Scheduled task definitions |
| `skills` | Custom skill configurations |

### Redis Usage

- Session caching
- Task queue (Celery broker)
- Rate limiting

## IM Integration

### Feishu/Lark Setup

1. Create Feishu app at https://open.feishu.cn/app
2. Get `LARK_APP_ID` and `LARK_APP_SECRET`
3. Configure webhook URL in ScienceClaw settings
4. Set environment variables:

```bash
LARK_APP_ID=your_app_id
LARK_APP_SECRET=your_app_secret
IM_ENABLED=true
```

## Project Structure Details

### Custom Tools (`Tools/`)

Place Python files with `@tool` decorated functions:

```python
from deepagent import tool

@tool
def my_custom_tool(query: str) -> str:
    """Description of what the tool does."""
    return f"Result for: {query}"
```

Tools auto-reload when added to `Tools/` directory.

### Custom Skills (`Skills/`)

Create skill folder with `SKILL.md`:

```
Skills/
└── my-skill/
    └── SKILL.md
```

### Workspace (`workspace/`)

All generated files stay local:

- Session files
- Generated documents (PDF, DOCX, etc.)
- Downloaded data
- Temporary files

**Data never leaves your machine.**

## Deployment Notes

### Production Deployment

1. Use `docker-compose-release.yml` for pre-built images
2. Change default admin password immediately
3. Configure proper `DS_API_KEY`
4. Set up reverse proxy (nginx included)
5. Enable SSL/TLS

### Resource Limits

| Service | Default Limit |
|---------|--------------|
| Sandbox Memory | 8GB |
| Sandbox CPU | 4 cores |
| Shared Memory | 2GB |

Adjust via `SANDBOX_MEM_LIMIT` and `SANDBOX_CPUS` environment variables.

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Backend not starting | Check MongoDB connection, verify environment variables |
| Sandbox errors | Increase memory/shm, check Docker isolation |
| WebSearch failing | Verify SearXNG is running, check network |
| Frontend blank | Check backend is accessible, check browser console |

### Health Checks

```bash
# Backend health
curl http://localhost:12001/api/v1/auth/status

# Sandbox health
curl http://localhost:18080/v1/docs

# WebSearch health
curl http://localhost:8068/health
```

### Reset

```bash
# Stop everything and remove volumes
docker compose down -v

# Fresh start
docker compose -f docker-compose-release.yml up -d --pull always
```

## Documentation

- Main README: `README.md` / `README_zh.md`
- Project documentation in repo docs
- Online docs: https://scienceclaw.taichuai.cn

## Collaboration Notes

- **Multi-agent safety**: Each agent should work in its own session
- **Git workflow**: Use feature branches, pull before push
- **Commits**: Use clear, descriptive messages
- **Testing**: Verify changes before committing

## Release Workflow

1. Update version in relevant files
2. Test with `docker compose -f docker-compose-china.yml up -d --build`
3. Build release images
4. Tag and publish
5. Update documentation

## Security Notes

- Default credentials must be changed on first login
- Never expose MongoDB port directly
- Use strong API keys for production
- Keep Docker images updated
- Review security-related logs regularly
- Data stays local by design - no external data exfiltration

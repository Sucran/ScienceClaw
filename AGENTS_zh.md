# ScienceClaw Agent 指南

- 仓库: https://github.com/AgentTeam-TaichuAI/ScienceClaw
- 在对话回复中，文件引用必须使用相对于仓库根目录的路径 (例如: `ScienceClaw/backend/deepagent/agent.py`)；不要使用绝对路径或 `~/...`。
- 未经明确授权，不要编辑可能影响安全、认证或生产基础设施的文件。将这些路径视为受限区域。

## 项目概述

ScienceClaw 是一个基于 [LangChain DeepAgents](https://github.com/langchain-ai/deepagents) 和 [AIO Sandbox](https://github.com/agent-infra/sandbox) 构建的个人研究助手。它提供：

- **1,900+ 内置科学工具**，涵盖药物发现、天文学、地球科学、化学、生物多样性、学术文献等领域
- **多格式内容生成** (PDF、DOCX、PPTX、XLSX)
- **完全本地化 & 隐私优先** - 所有数据保留在本地 `./workspace` 目录
- **Docker 隔离执行** - 安全优先架构

## 架构概览

```
ScienceClaw/
├── docker-compose.yml              # 10 服务编排 (开发者构建)
├── docker-compose-release.yml      # 预构建镜像编排 (终端用户)
├── docker-compose-china.yml        # 中国镜像加速
├── images/                         # 静态资源
├── videos/                         # 演示视频
├── Tools/                          # 自定义工具 (热加载)
├── Skills/                         # 用户 & 社区技能包
├── workspace/                      # 本地工作空间 (数据不离开你的机器)
└── ScienceClaw/
    ├── backend/                    # FastAPI 后端
    │   ├── deepagent/              # 核心 AI Agent 引擎 (LangGraph)
    │   ├── builtin_skills/         # 9 个内置技能 (pdf, docx, pptx, xlsx, ...)
    │   ├── route/                  # REST API 路由
    │   ├── im/                     # IM 集成 (飞书 / 钉钉)
    │   ├── mongodb/                # 数据库访问层
    │   └── user/                   # 用户管理
    ├── frontend/                   # Vue 3 + Tailwind 前端
    ├── sandbox/                    # 隔离代码执行环境
    ├── task-service/               # 定时任务服务 (cron jobs)
    └── websearch/                  # 搜索 & 爬取微服务
```

## 服务架构

| 服务 | 端口 | 描述 |
|---------|------|-------------|
| `sandbox` | 18080 | AIO Sandbox - 隔离代码执行 |
| `backend` | 12001 | FastAPI 后端 - Agent 引擎 |
| `frontend` | 5173 | Vue 3 前端 |
| `mongo` | 27014 | MongoDB 数据库 |
| `redis` | 6379 | Redis 缓存 |
| `searxng` | 26080 | 元搜索引擎 |
| `websearch` | 8068 | 网页搜索 + 爬取服务 |
| `scheduler_api` | 12002 | 任务调度 API |
| `celery_worker` | - | 后台任务 worker |
| `celery_beat` | - | 定时任务调度器 |

## 技术栈

- **后端**: Python 3.11+, FastAPI 0.128+, LangChain, LangGraph, DeepAgents 0.4.4
- **前端**: Vue 3, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **数据库**: MongoDB (Motor 异步驱动), Redis
- **Agent**: LangChain DeepAgents, AIO Sandbox
- **工具**: ToolUniverse (1,900+ 科学工具), SearXNG, Crawl4AI
- **IM**: 飞书/钉钉 (lark-oapi)
- **基础设施**: Docker, Docker Compose

## 核心模块

### DeepAgent 引擎 (`ScienceClaw/backend/deepagent/`)

| 文件 | 用途 |
|------|---------|
| `agent.py` | 核心 Agent 实现 |
| `engine.py` | Agent 引擎编排 |
| `runner.py` | Agent 执行运行器 |
| `sessions.py` | 会话管理 |
| `tools.py` | 内置工具定义 |
| `tooluniverse_tools.py` | ToolUniverse 集成 |
| `diagnostic.py` | 诊断模式用于调试 |
| `plan_types.py` | 计划类型定义 |
| `sse_protocol.py` | SSE 流式协议 |
| `sse_middleware.py` | SSE 中间件 |

### 内置技能 (`ScienceClaw/backend/builtin_skills/`)

| 技能 | 用途 |
|-------|---------|
| `pdf` | PDF 生成、OCR、合并、拆分 |
| `docx` | Word 文档创建 |
| `pptx` | PowerPoint 生成 |
| `xlsx` | Excel 电子表格创建 |
| `tool-creator` | 创建自定义 @tool 函数 |
| `skill-creator` | 创建自定义技能 |
| `find-skills` | 发现社区技能 |
| `tooluniverse` | 访问 1,900+ 科学工具 |

### 前端 (`ScienceClaw/frontend/src/`)

| 目录 | 用途 |
|-----------|---------|
| `api/` | API 客户端 |
| `components/` | Vue 组件 |
| `composables/` | 组合式函数 |
| `pages/` | 页面视图 |
| `types/` | TypeScript 类型 |
| `utils/` | 工具函数 |

## 工具架构 (四层)

| 层 | 描述 | 示例 |
|-------|-------------|----------|
| 内置工具 | 核心搜索 & 爬取 | `web_search`, `web_crawl` |
| ToolUniverse | 1,900+ 科学工具 | UniProt, OpenTargets, FAERS |
| Sandbox 工具 | 文件 & 代码操作 | `read_file`, `write_file`, `execute`, `shell` |
| 自定义 @tool | 用户定义的 Python | 放入 `Tools/` 目录 |

## 技能系统

技能是**结构化指令文档 (SKILL.md)**，指导 Agent 完成复杂的多步骤工作流。

- **自然语言创建** - 在对话中描述工作流，Agent 自动创建
- **手动安装** - 将带有 `SKILL.md` 的文件夹放入 `Skills/`
- **热加载** - 工具和技能添加后自动重载，无需重启

## 环境变量

### 后端 (`ScienceClaw/backend/`)

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `SANDBOX_REST_URL` | http://sandbox:8080 | Sandbox API URL |
| `WORKSPACE_DIR` | /home/scienceclaw | 本地工作空间 |
| `DS_API_KEY` | - | DeepSeek API 密钥 |
| `DS_URL` | https://api.deepseek.com/v1 | API 基础地址 |
| `DS_MODEL` | deepseek-chat | 模型名称 |
| `MONGODB_HOST` | mongo | MongoDB 主机 |
| `LARK_APP_ID` | - | 飞书应用 ID |
| `LARK_APP_SECRET` | - | 飞书应用密钥 |
| `DIAGNOSTIC_MODE` | 1 | 启用诊断日志 |

### Sandbox

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `WEBSEARCH_URL` | http://websearch:8068 | 搜索服务 URL |
| `TZ` | Asia/Shanghai | 时区 |

## 构建、测试和开发命令

### 前置条件

- Docker & Docker Compose (Docker Desktop 包含 Compose)
- 推荐系统内存 >= 8 GB
- Node.js 20+ (用于前端开发)

### 开发设置

```bash
# 首次启动 - 从源码构建
docker compose up -d --build

# 日常启动 - 快速启动
docker compose up -d

# 拉取预构建镜像 (推荐给用户)
docker compose -f docker-compose-release.yml up -d --pull always

# 中国用户 - 使用镜像构建
docker compose -f docker-compose-china.yml up -d --build
```

### 服务管理

```bash
# 检查状态
docker compose ps

# 查看日志
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f sandbox

# 重启单个服务
docker compose restart backend

# 停止所有服务
docker compose down

# 停止单个服务
docker compose stop backend
```

### 前端开发

```bash
cd ScienceClaw/frontend
npm install
npm run dev
```

### 后端开发

后端在 docker-compose 中使用 `--reload` 标志自动重载。

```bash
# 查看后端日志
docker compose logs -f backend

# 后端运行在 http://localhost:12001
# 前端运行在 http://localhost:5173
```

## 代码规范

### 后端 (Python)

- **框架**: FastAPI with async/await
- **数据库**: Motor (异步 MongoDB 驱动)
- **Agent**: LangChain, LangGraph, DeepAgents
- **类型提示**: 尽可能使用
- **格式化**: 遵循 PEP 8

### 前端 (TypeScript/Vue)

- **框架**: Vue 3 Composition API
- **状态**: Pinia
- **样式**: Tailwind CSS
- **组件**: shadcn/ui 模式
- **格式化**: ESLint + Prettier

### 文件命名

- Python: `snake_case.py`
- TypeScript: `camelCase.ts` 或 `PascalCase.ts` (组件)
- 技能: `SKILL.md` (大写)
- 工具: `*.py` 带 `@tool` 装饰器

### 安全规范

- 永不提交真实凭据或 API 密钥
- 使用环境变量存储秘密
- 工作空间文件 (`./workspace/`) 仅本地存储
- Sandbox 隔离防止主机访问
- 默认管理员: `admin` / `admin123` (首次登录后修改)

## 测试指南

### 手动测试

```bash
# 检查所有服务健康状态
docker compose ps

# 测试后端 API
curl http://localhost:12001/api/v1/auth/status

# 测试 sandbox
curl http://localhost:18080/v1/docs
```

### 诊断模式

在后端启用 `DIAGNOSTIC_MODE=1` 以记录完整 LLM 调用上下文用于调试。

### 日志查看

```bash
# 所有服务
docker compose logs -f

# 单个服务
docker compose logs -f backend
docker compose logs -f sandbox
docker compose logs -f websearch
```

## 数据库 Schema

### MongoDB 集合

| 集合 | 用途 |
|------------|---------|
| `users` | 用户账户和认证 |
| `sessions` | Agent 对话会话 |
| `files` | 文件元数据和引用 |
| `tasks` | 定时任务定义 |
| `skills` | 自定义技能配置 |

### Redis 用途

- 会话缓存
- 任务队列 (Celery broker)
- 限流

## IM 集成

### 飞书/钉钉设置

1. 在 https://open.feishu.cn/app 创建飞书应用
2. 获取 `LARK_APP_ID` 和 `LARK_APP_SECRET`
3. 在 ScienceClaw 设置中配置 webhook URL
4. 设置环境变量:

```bash
LARK_APP_ID=your_app_id
LARK_APP_SECRET=your_app_secret
IM_ENABLED=true
```

## 项目结构详情

### 自定义工具 (`Tools/`)

放置带 `@tool` 装饰器的 Python 文件:

```python
from deepagent import tool

@tool
def my_custom_tool(query: str) -> str:
    """工具功能描述。"""
    return f"结果: {query}"
```

添加到 `Tools/` 目录后工具会自动重载。

### 自定义技能 (`Skills/`)

创建带 `SKILL.md` 的技能文件夹:

```
Skills/
└── my-skill/
    └── SKILL.md
```

### 工作空间 (`workspace/`)

所有生成的文件保留在本地:

- 会话文件
- 生成的文档 (PDF、DOCX 等)
- 下载的数据
- 临时文件

**数据永不离开你的机器。**

## 部署说明

### 生产部署

1. 使用 `docker-compose-release.yml` 获取预构建镜像
2. 立即更改默认管理员密码
3. 配置正确的 `DS_API_KEY`
4. 设置反向代理 (包含 nginx)
5. 启用 SSL/TLS

### 资源限制

| 服务 | 默认限制 |
|---------|--------------|
| Sandbox 内存 | 8GB |
| Sandbox CPU | 4 核 |
| 共享内存 | 2GB |

通过 `SANDBOX_MEM_LIMIT` 和 `SANDBOX_CPUS` 环境变量调整。

## 故障排除

### 常见问题

| 问题 | 解决方案 |
|-------|----------|
| 后端无法启动 | 检查 MongoDB 连接，验证环境变量 |
| Sandbox 错误 | 增加内存/shm，检查 Docker 隔离 |
| WebSearch 失败 | 验证 SearXNG 正在运行，检查网络 |
| 前端空白 | 检查后端是否可访问，检查浏览器控制台 |

### 健康检查

```bash
# 后端健康
curl http://localhost:12001/api/v1/auth/status

# Sandbox 健康
curl http://localhost:18080/v1/docs

# WebSearch 健康
curl http://localhost:8068/health
```

### 重置

```bash
# 停止所有服务并删除卷
docker compose down -v

# 全新开始
docker compose -f docker-compose-release.yml up -d --pull always
```

## 文档

- 主 README: `README.md` / `README_zh.md`
- 项目文档在仓库 docs 中
- 在线文档: https://scienceclaw.taichuai.cn

## 协作说明

- **多 Agent 安全**: 每个 Agent 应在自己的会话中工作
- **Git 工作流**: 使用功能分支，push 前先 pull
- **提交**: 使用清晰描述性的消息
- **测试**: 提交前验证更改

## 发布流程

1. 在相关文件中更新版本
2. 使用 `docker compose -f docker-compose-china.yml up -d --build` 测试
3. 构建发布镜像
4. 打标签并发布
5. 更新文档

## 安全说明

- 首次登录后必须更改默认凭据
- 不要直接暴露 MongoDB 端口
- 生产环境使用强 API 密钥
- 保持 Docker 镜像更新
- 定期审查安全相关日志
- 数据按设计保留在本地 - 无外部数据泄露

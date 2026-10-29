# GameBuddy Agent

## Player memory | 玩家记忆

Open `/memory/` to manage a player's profile, game-specific goals, reminders and reviewed games. Explicit “记住：…” requests can update preferences or save a note; later sessions recall relevant notes and past user-reported events, with the selected memory visible beside the answer. Entries support revision checks, expiry and deletion. Identified player-memory requests stay local and do not call an external model. Public visitors continue to use stateless analysis.

See [the memory lifecycle, storage and API](docs/player-memory.md). The existing private access boundary is unchanged.

## Play and review | 小游戏与战局分析

Open `/` to play three original turn-based games, or `/play/field-notes/?scene=town` for the full game page:

- **松风镇 / Pinewind**: recover three supply caches and return to the gate.
- **河谷争夺 / River Front**: cross the river and take three flags.
- **地牢余火 / Last Ember**: collect two runes and reach the exit.

The existing CC0 scene art is now used as the actual map background, with live player, enemy and objective layers. Movement, attacks, ranged strikes, rest and potions update a deterministic turn engine. The analysis button submits a frozen snapshot of that game to `POST /api/v1/play/analyze`; advice covers the current health, stamina, enemy positions and remaining route. The following turn is played from the same ongoing game. Analysis responses are bound to their scene and turn.

All gameplay runs in the browser. The backend provides the game analysis and local Ops records. Run `npm run test:games` in `frontend/` for the rules and completion-path checks. Art sources and licenses are in [visual-assets.md](docs/visual-assets.md).

## Local-first assistant and Agent Ops | 本地助手与迭代闭环

The app runs without an API key or MongoDB. Start the existing FastAPI backend and Next.js frontend, then open:

- `/assistant/`: cited game Q&A, RPG progression advice constrained by supplied resources, and evidence-bounded match review.
- `/review/`: structured state analysis for the three demo game packs. Screenshot input remains an explicitly labelled placeholder.
- `/ops/`: real request statistics, stage traces, immutable prompt/policy versions, offline regression checks, trace-linked human review and JSONL exports.

无 Key、无 MongoDB 即可运行。画像、历史、反馈、Trace、Policy 和评测结果写入本地 SQLite；设置 `GAMEBUDDY_DATA_DIR` 可更换私有数据目录。OpenRouter 是可选增强，超时或不合格响应会保留可用的规则与本地检索结果，并记录降级原因。

See [the runnable walkthrough and resume coverage](docs/resume-coverage.md), [API](docs/api.md), and [evaluation scope](docs/evaluation.md). No SFT/DPO training or live provider quality result is claimed.

## Optional MongoDB replication

SQLite always stores the following data first. Optional MongoDB replicates these paths and falls back to local copies on failure:

- user profile storage and profile merge by `user_id`
- analysis history storage for each request
- feedback storage for later SFT / preference-data export

Environment variables:

```env
MONGODB_URI=
MONGODB_DATABASE=gamebuddy
MONGODB_USER_PROFILES_COLLECTION=user_profiles
MONGODB_ANALYSIS_HISTORY_COLLECTION=analysis_history
MONGODB_FEEDBACK_COLLECTION=feedback
```

GameBuddy Agent is a browser-based game analysis lab. It combines structured review demos with playable sandbox modules, then turns a game state or screenshot placeholder input into:

GameBuddy Agent 是一个基于浏览器的游戏分析实验项目，结合结构化复盘 Demo 与可游玩的沙盒模块，将游戏状态或截图占位输入转换为：

- a short situation summary / 简短局势总结
- a phase read and recommended direction / 阶段判断与推荐方向
- tactical advice / 战术建议
- a beginner-friendly explanation / 面向新手的解释
- a review-style breakdown of likely mistakes and next steps / 复盘式的失误分析与后续行动建议

This repository also includes browser-playable modules in `/play`, including a web RPG adaptation, macro sandboxes, and a small survivor-style prototype.

本仓库还包含位于 `/play` 下的浏览器可玩模块，包括网页 RPG 改编、宏观决策沙盒，以及一个小型 survivor 风格原型。

## What This Project Is | 项目定位

GameBuddy Agent is a strategy and review tool with a playable frontend surface.

GameBuddy Agent 是一个带有可交互前端界面的策略分析与复盘工具。

It is built for:

适用场景：

- post-match review / 对局后复盘
- situation explanation / 局势解释
- lightweight coaching / 轻量教学指导
- testing modular analysis flows and browser prototypes in the same project / 在同一项目中验证模块化分析流程与浏览器原型

It is not built for:

不适用场景：

- cheats / 作弊工具
- automation bots / 自动化脚本或机器人
- memory reading / 读取游戏内存
- input injection / 注入输入操作
- anti-cheat evasion / 绕过反作弊

## Current Scope | 当前范围

Analysis demos:

分析 Demo：

- Pokemon-style turn-based battle demo / 类宝可梦回合制战斗 Demo
- MOBA post-match demo / MOBA 对局后复盘 Demo
- RPG build demo / RPG Build 配装 Demo

Browser-playable modules:

浏览器可玩模块：

- Heroes & Monsters Web
- MOBA Sandbox
- RPG Build Lab
- Mini Survivor Mode

## How It Works | 工作方式

Backend flow:

后端流程：

1. Normalize input into a game-specific state.  
   将输入规范化为具体游戏的状态结构。
2. Run game-pack analysis logic.  
   执行对应游戏包的分析逻辑。
3. Optionally enhance the result with OpenRouter.  
   可选地通过 OpenRouter 对结果进行增强。
4. Return a stable response shape to the frontend.  
   向前端返回稳定一致的响应结构。

Main backend pieces:

主要后端模块：

- `backend/app/api/routes/`
- `backend/app/services/orchestrator.py`
- `backend/app/services/game_packs.py`
- `backend/app/services/openrouter_client.py`

Frontend pieces:

主要前端模块：

- `frontend/app/`
- `frontend/components/`
- `frontend/lib/`

## Features | 功能特性

- Structured state analysis via `POST /api/v1/analyze/state` / 通过 `POST /api/v1/analyze/state` 进行结构化状态分析
- Screenshot placeholder analysis via `POST /api/v1/analyze/screenshot` / 通过 `POST /api/v1/analyze/screenshot` 进行截图占位分析
- Phase prediction and recommended direction output / 输出阶段判断与推荐方向
- Review report output / 输出复盘报告
- English and Chinese UI / 支持中英文界面
- Local sample states for demos / 提供本地示例状态用于演示
- Optional OpenRouter integration / 可选接入 OpenRouter
- Browser-playable prototype pages / 提供浏览器可玩原型页面

## OpenRouter

OpenRouter support is optional.

OpenRouter 支持是可选的。

If `OPENROUTER_API_KEY` is set, the backend can enhance heuristic analysis with an LLM response. If it is not set, the app falls back to the built-in rule-based path.

如果设置了 `OPENROUTER_API_KEY`，后端会使用大模型响应增强启发式分析；如果未设置，则回退到内置规则路径。

Example environment variables:

环境变量示例：

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=GameBuddy Agent
```

## Quick Start | 快速开始

### Backend | 后端

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend | 前端

```powershell
cd frontend
npm install
npm run dev
```

Open:

访问地址：

- frontend: `http://localhost:3000`
- backend: `http://localhost:8000`

Windows 后台启动：安装依赖并完成前端静态构建后，在仓库根目录运行 `.\scripts\start-local.ps1`；用 `.\scripts\stop-local.ps1` 停止。日志位于 `.runtime/`，启动方式和公网配置见 [deployment guide](docs/deployment.md)。

## Docker

```bash
docker compose up --build
```

## API

Routes:

接口列表：

- `GET /health`
- `POST /api/v1/analyze/state`
- `POST /api/v1/analyze/screenshot`

See [docs/api.md](docs/api.md) for the request and response shape.

请求与响应结构见 [docs/api.md](docs/api.md)。

## Example Data | 示例数据

Sample game states:

示例游戏状态：

- `samples/game-states/balanced-position.json`
- `samples/game-states/moba-comeback-window.json`
- `samples/game-states/rpg-mage-build.json`
- `samples/game-states/defensive-stall-break.json`
- `samples/game-states/closing-out-a-lead.json`

Placeholder asset:

占位资源：

- `frontend/public/demo/placeholder-battle.svg`

## Documentation | 文档

- [docs/architecture.md](docs/architecture.md)
- [docs/agents.md](docs/agents.md)
- [docs/api.md](docs/api.md)
- [docs/future-roadmap.md](docs/future-roadmap.md)

## Tests | 测试

```powershell
cd backend
pytest
```

## Notes | 说明

- Screenshot analysis is still a placeholder path, not a full vision system. / 截图分析目前仍是占位实现，不是完整视觉系统。
- The project favors explicit system boundaries over pretending to do more than it actually does. / 项目更强调清晰的系统边界，而不是伪装成具备尚未实现的能力。
- Some game modules are analytical demos, while others are playable frontend prototypes. / 部分游戏模块是分析 Demo，部分则是可交互前端原型。

## Contributing | 贡献

Contributions are welcome.

欢迎提交贡献。

Good contributions usually include:

高质量贡献通常包括：

- a clear user-facing problem / 明确的用户问题或需求
- matching docs updates when behavior changes / 行为变更时同步更新文档
- sample data updates when a demo format changes / Demo 格式变化时同步更新示例数据
- tests for backend response-shape or logic changes / 为后端响应结构或逻辑变更补充测试
## Function Calling | 工具调用

GameBuddy now supports an OpenAI-compatible function-calling path when `OPENROUTER_API_KEY` is configured.

配置 `OPENROUTER_API_KEY` 后，可通过 OpenRouter 使用兼容的 Function Calling；无 Key 时规则与本地检索仍可运行。

Current local tools:

当前本地工具：

- `get_game_knowledge`: query local game knowledge packs for glossary, beginner tips, macro, and build references
- `get_user_profile`: read optional request-time user preferences for response personalization

Execution flow:

执行流程：

1. Build the normal heuristic draft first.
2. Let the model decide whether tool use is necessary.
3. Execute local tools on the backend and feed the results back to the model.
4. Force the final answer back into the same `AnalysisResponse` schema.

This keeps the API response shape stable while making the LLM layer more grounded and extensible.

工具调用受白名单、严格参数与调用次数约束；超时或最终响应校验失败会保留可用的本地结果。实际工具结果和降级原因写入 Trace。

Optional personalization fields for `POST /api/v1/analyze/state`:

```json
{
  "session_id": "session-123",
  "user_profile": {
    "user_id": "player-7",
    "skill_level": "beginner",
    "preferred_style": "concise",
    "favorite_role": "jungler",
    "goals": ["cleaner macro setup"]
  }
}
```

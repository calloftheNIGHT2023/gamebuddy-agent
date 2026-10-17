# GameBuddy 简历能力与验收

本项目使用 FastAPI + Next.js，提供面向三个演示游戏包的策略解释和复盘。知识包是仓库内的通用原则，不能当作具体商业游戏最新版本的攻略。养成任务目前仅支持 RPG 演示包。

## 本地启动

要求 Python 3.11+、Node.js 20+。在两个终端中分别运行：

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
cd frontend
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

访问 `http://localhost:3000/assistant/` 和 `http://localhost:3000/ops/`。默认前端使用本机 8000 端口后端，无需 `.env`、Key 或数据库服务。

前端保留静态导出配置；生产构建用 `npm run build`，可用 `python -m http.server 3000 --bind 127.0.0.1 --directory out` 预览。静态导出不使用 `next start`。远程部署需在构建前设置 `NEXT_PUBLIC_API_BASE_URL`，并为后端配置对应 CORS 来源。

OpenRouter 可选配置：把 `.env.example` 中的相关变量放到 `backend/.env`（或进程环境）。前端变量放到 `frontend/.env.local`。不要把 Key 写入前端。`GAMEBUDDY_DATA_DIR` 未指定时是 `backend/data`，该目录已被 Git 忽略；重启不会清空 SQLite。

## 一次完整演示

1. 在 `/assistant/` 选择 MOBA 问答，输入“什么是视野与 face-check？”。查看可点击展开的知识来源；无关问题会显示证据不足。
2. 切换 RPG 养成，显式载入演示样例或填写自己的完整状态。把 `available_resources` 设为零，确认建议先获取资源，并明确缺少价格时不能算出购买数量。
3. 复盘任务在 `recent_events` 填入关键事件。结果引用输入，区分可能问题与已观察事实。
4. 在 `/ops/` 打开该次真实 Trace，核对输入、输出、检索来源、LLM 状态、阶段耗时和使用的版本。
5. 创建新 Policy，设置 `max_next_steps=1` 并启用。再次分析，确认 `next_steps` 受限，且 Trace 绑定新版本。有 Key 时 prompt/instructions 还会实际进入模型 system prompt。
6. 选择一个版本运行离线评测，查看逐条检查；评测期间强制禁用外部模型，且不会写入用户请求统计和记忆。
7. 在真实 Trace 上点赞，或点踩并填写不同的人工修正。下载 SFT / Preference JSONL，核对来源 Trace 和目标；中性评价、无修正的差评、空修正、相同答案均不会成为训练目标。

有 Key 时，养成回答保留通过结构校验的模型摘要与计划，仍明确升级成本尚未核验；已知可用资源全部为零时不请求模型，最终摘要、战术建议和复盘行动统一采用无成本方案。问答的来源包含成功工具调用新增的知识，即使后续模型超时也能保留引用；`initial_knowledge_matches` / `initial_retrieval_status` 保留首次检索结果供 Trace 核对。

## 能力对应

| 简历能力 | 实现与可验证证据 |
| --- | --- |
| FastAPI + Next.js 完整链路 | `/assistant/`、`/review/`、`/ops/`；真实 API、加载/空态/错误状态 |
| 结构化局势分析 | 三个游戏包规则；消费字段验证，不完整输入返回 422 |
| 游戏问答与本地 RAG | JSON 叶子文档、TF-IDF 词项和中文概念别名；稳定 source/path/score；无命中留空 |
| 养成与复盘 | RPG 资源约束和瓶颈优先级；复盘引用输入事件，保留因果不确定性 |
| 可选 LLM / Function Calling | OpenRouter 两轮工具闭环；工具白名单、严格参数、数量预算、响应结构验证与可追踪降级 |
| 用户画像 / 记忆 | SQLite 默认持久化；画像实际影响解释与建议；MongoDB 可选复制和本地回退 |
| Trace / 版本管理 | 每请求输入、输出、来源、工具结果、耗时和 policy_id；不可变版本，单一 active 指针与显式版本覆盖 |
| Eval Harness | `python scripts/run_eval.py`；12 项离线契约检查与逐条报告 |
| HITL / 训练数据 | 人工评价关联真实 Trace；JSONL 导出筛选合格 SFT / Preference 样本 |
| Agent Ops | 真实存储统计、可查看 Trace、版本与评测记录；样本下载 |

## 验证命令

```powershell
cd backend
python -m pytest -q
python scripts/run_eval.py --output ../artifacts/offline-eval.json
```

```powershell
cd frontend
npm run lint
npm run typecheck
npm run build
```

测试通过临时 SQLite 和模拟 provider / Mongo 集合覆盖外部成功与失败路径，不连接真实模型或数据库。离线评测用于检查已列出的行为，不能证明泛化策略质量、用户满意度或训练收益。尚未开展 SFT/DPO 训练。

## 数据与部署范围

Agent Ops、记忆、标注和导出是本地可信开发环境功能，尚无账号认证、租户隔离和权限管理。默认服务仅监听本机。需要把这些能力部署到公网时，应先加访问控制并配置持久磁盘；云服务临时文件系统重建不等于 SQLite 长期留存。不要将个人 Trace、数据库或导出样本提交到仓库。

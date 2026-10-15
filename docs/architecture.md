# 架构说明

## 当前执行路径

1. Next.js 的 `/assistant/`、`/review/` 向 FastAPI 提交问题、任务和可选画像。
2. 请求模型检查游戏、任务、非空问题和规则实际消费的结构化字段；缺失或非法输入返回 422。
3. `GameBuddyOrchestrator` 在请求开始时固定一个不可变 Policy，通过 ContextVar 隔离并发请求，结束时恢复上下文。
4. 画像从 SQLite 合并；结构化分析运行对应 `game_packs.py` 规则。QA 使用知识问答草稿，避免把演示状态误当作真实观测。
5. `retrieval.py` 将知识包 JSON 叶子作为可引用文档，用 TF-IDF 词项与中文概念别名检索。每项返回 source/path/score。QA 仅按问题检索，局势分析可加入已提供状态；无命中不填充随机文档。
6. 无 Key 直接使用规则和检索依据；有 Key 时 OpenRouter 可执行两轮 Function Calling。工具白名单、严格参数、最多四次调用、provider schema 和超时边界保证失败可降级。
7. 输出统一为 `AnalysisResponse`。助手在此基础上提供引用问答、受资源约束的 RPG 养成、引用事件并保留因果不确定性的复盘；Policy 的 max_next_steps 实际约束离线行动列表。
8. 保存画像与历史，并记录输入、输出、检索/工具结果、模型状态、版本和实测耗时的 Trace。

`backend/app/agents/` 是早期原型模块，当前运行路径不导入该目录；现行入口为上述 services + orchestrator。截图接口仍明确使用占位状态，不执行视觉识别。

## 持久化

`LocalStore` 使用 SQLite 的参数化语句和单记录事务。默认数据库是 `backend/data/gamebuddy.sqlite3`，可用 GAMEBUDDY_DATA_DIR 更换目录。画像、历史、反馈、Trace、Policy、active 指针和评测结果均支持重启恢复。

配置 MongoDB 时画像、历史和反馈先写 SQLite 再复制到 MongoDB；远端读取结果会缓存本地，重复副本按记录标识去重。MongoDB 故障记录日志并使用本地副本。Trace 和版本管理仍为本地存储。

## 迭代闭环

`/ops/` 读取真实记录并支持查看 Trace、创建/启用不可变版本、运行固定样例检查、人工标注以及训练样本下载。带 Trace 的反馈从服务端回填执行上下文，客户端不能通过修改回答或状态伪造关联。旧版独立反馈仍兼容，但导出明确标记未验证来源。

仅人工认可的回答或有效人工修正可导出。Preference 需要相同输入下不同的 chosen/rejected；neutral、未修正 down、空修正和相同答案不导出。验证关联的样本包含真实任务及策略上下文。数据闭环提供后续训练基础，不表示已完成 SFT/DPO。

离线 Eval Harness 固定版本、强制关闭外部模型、不写用户记忆/请求统计，逐项报告结果。它检查契约和回归行为，不衡量真实游戏决策准确率。

## 部署范围

默认服务仅监听本机。当前 Ops/记忆 API 面向可信本地开发，没有公网账号认证或租户隔离；公开部署需先补访问控制和持久磁盘。Docker 将 backend 与 samples 一起打包并挂载本地数据目录。前端静态导出需要配置可访问的 API 基址，单独部署静态页面不会运行后端。

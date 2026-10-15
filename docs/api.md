# API 文档

## 总览

当前 MVP 提供 3 个主要接口：

- `GET /health`
- `POST /api/v1/analyze/state`
- `POST /api/v1/analyze/screenshot`
- `GET /api/v1/memory/profile/{user_id}`
- `POST /api/v1/memory/profile`
- `GET /api/v1/memory/history`
- `POST /api/v1/memory/feedback`
- `GET /api/v1/memory/feedback`
- `GET /api/v1/memory/training-samples`

接口目标是保持简单、稳定、易扩展。

## `GET /health`

用于健康检查。

### 响应示例

```json
{
  "status": "ok"
}
```

## `POST /api/v1/analyze/state`

用于提交结构化战局并获取分析结果。

### 请求体示例

```json
{
  "game": "pokemon-battle-demo",
  "question": "我下一步应该做什么？",
  "state": {
    "battle_id": "demo-balanced-001",
    "turn": 12,
    "format": "singles",
    "skill_level": "beginner",
    "player": {
      "active": {
        "name": "Voltfox",
        "archetype": "fast-sweeper",
        "current_hp_percent": 38,
        "known_moves": ["Thunderbolt", "Volt Switch"],
        "status": null,
        "speed_tier": "fast",
        "likely_role": "late-game cleaner"
      },
      "bench": [],
      "hazards": [],
      "momentum": "behind"
    },
    "opponent": {
      "active": {
        "name": "Drakeon",
        "archetype": "fast-sweeper",
        "current_hp_percent": 64,
        "known_moves": ["Dragon Dance"],
        "status": null,
        "speed_tier": "fast",
        "likely_role": "setup sweeper"
      },
      "bench": [],
      "hazards": ["stealth-rock"],
      "momentum": "ahead"
    },
    "revealed_threats": ["dragon-dance"],
    "recent_events": [],
    "win_condition_hint": "Keep Voltfox healthy enough to clean later."
  }
}
```

### 说明

- 当前 `game` 只支持 `pokemon-battle-demo`
- 若提交其他游戏标识，接口会返回 `400`

## `POST /api/v1/analyze/screenshot`

用于上传截图并获取分析结果。

### 请求方式

`multipart/form-data`

### 字段

- `question`: 用户问题
- `file`: 图片文件

### 当前 MVP 行为

- 接收上传文件
- 进入感知层
- 返回有效结构化分析结果
- 明确告诉调用方：截图解析目前仍是占位实现

## 响应结构

所有分析接口都会返回统一结构：

```json
{
  "summary": "string",
  "tactical_advice": [
    {
      "title": "string",
      "recommendation": "string",
      "reasoning": "string",
      "confidence": "low"
    }
  ],
  "beginner_explanation": "string",
  "risks_or_uncertainties": ["string"],
  "next_steps": ["string"],
  "review_report": {
    "current_situation": "string",
    "likely_mistakes": ["string"],
    "recommended_actions": ["string"],
    "longer_term_improvement": ["string"]
  },
  "metadata": {
    "game": "pokemon-battle-demo"
  }
}
```

## 字段说明

### `summary`

对当前局势的简短总结。

### `tactical_advice`

战术建议列表。每条建议包含：

- 标题
- 推荐动作
- 推理说明
- 置信度

### `beginner_explanation`

用更适合新手理解的语言解释当前局势与建议。

### `risks_or_uncertainties`

用于说明模型或系统当前无法完全确定的部分。  
这是本项目的重要设计之一：系统应主动暴露不确定性，而不是伪装成全知。

### `next_steps`

给用户的下一步执行清单。

### `review_report`

用于复盘页展示，包含：

- 当前局面
- 可能失误
- 推荐动作
- 长期提升建议

### `metadata`

用于记录本次分析的一些附加信息，例如：

- 游戏标识
- 提问内容
- 感知置信度
- 回合数

## 错误处理

当前 MVP 的错误处理保持简单明确：

- 不支持的游戏类型返回 `400`
- 非法请求体由 FastAPI / Pydantic 自动返回校验错误
- 截图接口在缺失字段时返回标准请求错误

## 后续 API 扩展方向

- 增加历史分析记录
- 增加回合对比接口
- 增加“两个动作方案对比”接口
- 增加多游戏支持
- 增加会话级复盘接口
# Function Calling Notes

`POST /api/v1/analyze/state` now accepts two optional fields for function-calling personalization:

```json
{
  "session_id": "session-123",
  "user_profile": {
    "user_id": "player-7",
    "skill_level": "beginner",
    "preferred_style": "concise",
    "goals": ["safer turn planning"]
  }
}
```

`POST /api/v1/analyze/screenshot` now also accepts:

- `session_id`
- `user_profile_json` as a JSON string

## Feedback and Training Data Loop

`POST /api/v1/memory/feedback` records user feedback for one generated answer:

```json
{
  "game": "pokemon-battle-demo",
  "question": "What should I do next?",
  "response": {},
  "rating": "down",
  "session_id": "session-123",
  "user_id": "player-7",
  "correction": "Explain the safer pivot first.",
  "tags": ["user-correction"]
}
```

`GET /api/v1/memory/training-samples` converts saved feedback into lightweight training records:

- `rating=up` becomes an SFT-style sample with the accepted answer as `target`.
- `rating=down` with `correction` becomes a preference-style sample with `chosen` and `rejected` fields.

This endpoint is intended as an export bridge for later SFT, DPO, RLHF, or offline evaluation pipelines. It does not fine-tune a model inside the web service.

## Assistant and Agent Ops

- `POST /api/v1/assistant`: `{game,task:"qa"|"build"|"review",question,state?,user_profile?,policy_id?}` -> `{answer,sources,analysis,evidence_status,trace_id}`. Build currently requires `rpg-build-demo`; build/review require a complete state. QA may use `{}`.
- `GET /api/v1/ops/summary`: stored execution count, successful/fallback/error counts, mean latency, feedback and evaluation counts. Successful executions include usable fallbacks.
- `GET /api/v1/ops/traces?limit=100` and `GET /api/v1/ops/traces/{id}`: real execution records and stage details.
- `POST /api/v1/ops/traces/{id}/feedback`: `{rating:"up"|"down"|"neutral",correction?,tags?}`. All execution context comes from the stored trace.
- `GET /api/v1/ops/policies`: immutable versions and current active pointer.
- `POST /api/v1/ops/policies`: `{name,prompt,instructions:"text",max_next_steps:4}`; creates a fresh version, returns 201. Max steps must be 1–8.
- `POST /api/v1/ops/policies/{id}/activate`: changes the default for future requests. An explicit policy_id overrides the active default for one request.
- `GET /api/v1/ops/evaluations` and `POST /api/v1/ops/evaluations` with `{policy_id?}`: versioned offline checks; returns 201 for a new run.
- `GET /api/v1/memory/training-samples.jsonl?sample_type=sft|preference`: reviewed JSONL download, with optional user_id/session_id/limit filters. JSON API remains at `/memory/training-samples`.

Unknown traces/policies return 404 (feedback referencing an unknown trace returns 422). Invalid inputs return 422. Provider failure keeps a working response with `metadata.llm_status="fallback"` and a safe fallback_reason; unconfigured provider is `disabled`, successful enhancement is `enhanced`. Trace IDs and source paths are stable identifiers; retrieval scores are not probabilities.

These operations endpoints are intended for a private local developer instance. The current API does not supply public user authentication or tenant isolation.

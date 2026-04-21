# API 文档

## 总览

当前 MVP 提供 3 个主要接口：

- `GET /health`
- `POST /api/v1/analyze/state`
- `POST /api/v1/analyze/screenshot`
- `GET /api/v1/memory/profile/{user_id}`
- `POST /api/v1/memory/profile`
- `GET /api/v1/memory/history`

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

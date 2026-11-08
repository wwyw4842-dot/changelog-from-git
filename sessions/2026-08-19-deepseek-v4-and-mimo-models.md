# 2026-08-19 — DeepSeek 切 V4，接入小米 MiMo

## 做了什么

- DeepSeek 默认模型从已下线的 `deepseek-chat` / `deepseek-reasoner` 改为官方 V4：`deepseek-v4-flash`、`deepseek-v4-pro`。
- 引擎 id 未改（仍是 `deepseek` / `deepseek-reason`），避免已保存的调度设置失效。
- 新增小米 MiMo：`mimo`（`mimo-v2.5`）、`mimo-pro`（`mimo-v2.5-pro`），OpenAI 兼容，默认 `https://api.xiaomimimo.com/v1`。
- 别名凭据只复用 Key/Base，不再继承主引擎 model，避免 Flash 卡片上的模型名把 Pro 档也带跑。
- 启动时把本地存着的 `deepseek-chat` / `deepseek-reasoner` 改写成 V4 名称。

## 使用注意

- DeepSeek 与 MiMo 各自一张主卡片填 Key；Pro 档在「引擎调度」里单独选。
- Token Plan 用户把 MiMo API Base 改成 `https://token-plan-cn.xiaomimimo.com/v1`。
- 未接入 TTS / ASR / UltraSpeed，Foliole 当前 LLM 路径只用文本生成模型。

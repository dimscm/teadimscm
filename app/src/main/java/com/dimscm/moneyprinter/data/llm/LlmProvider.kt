package com.dimscm.moneyprinter.data.llm

/** Wire format a provider expects. */
enum class LlmDialect { OPENAI, GEMINI }

/**
 * AI providers the phone can talk to directly when the user supplies their own key.
 *
 * Everything except Gemini speaks the OpenAI `/chat/completions` dialect, which is why a single
 * "custom" entry is enough to cover OneAPI, LiteLLM, AIHubMix, ModelScope and friends.
 */
enum class LlmProvider(
    val id: String,
    val displayName: String,
    val defaultBaseUrl: String,
    val defaultModel: String,
    val dialect: LlmDialect,
    val requiresKey: Boolean = true,
) {
    OPENAI("openai", "OpenAI", "https://api.openai.com/v1", "gpt-4o-mini", LlmDialect.OPENAI),
    GEMINI("gemini", "Google Gemini", "https://generativelanguage.googleapis.com", "gemini-2.5-flash", LlmDialect.GEMINI),
    DEEPSEEK("deepseek", "DeepSeek", "https://api.deepseek.com/v1", "deepseek-chat", LlmDialect.OPENAI),
    MOONSHOT("moonshot", "Moonshot / Kimi", "https://api.moonshot.cn/v1", "moonshot-v1-8k", LlmDialect.OPENAI),
    QWEN("qwen", "Alibaba Qwen", "https://dashscope.aliyuncs.com/compatible-mode/v1", "qwen-plus", LlmDialect.OPENAI),
    GROQ("groq", "Groq", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", LlmDialect.OPENAI),
    GROK("grok", "xAI Grok", "https://api.x.ai/v1", "grok-3", LlmDialect.OPENAI),
    OPENROUTER("openrouter", "OpenRouter", "https://openrouter.ai/api/v1", "openai/gpt-4o-mini", LlmDialect.OPENAI),
    OLLAMA("ollama", "Ollama (self-hosted)", "http://localhost:11434/v1", "qwen2.5:7b", LlmDialect.OPENAI, requiresKey = false),
    CUSTOM("custom", "Other (OpenAI compatible)", "", "", LlmDialect.OPENAI, requiresKey = false),
    ;

    companion object {
        fun fromId(id: String?): LlmProvider = entries.firstOrNull { it.id == id } ?: OPENAI
    }
}

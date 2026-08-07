package com.dimscm.moneyprinter.data.llm

/**
 * Prompts mirroring what MoneyPrinterTurbo asks its own LLM for, so a script written on the
 * phone is interchangeable with one written by the server.
 */
object Prompts {

    const val SCRIPT_SYSTEM = """
You write narration scripts for short vertical videos.
Rules you must follow:
- Output ONLY the narration text. No titles, no headings, no markdown, no quotes, no emoji.
- Never mention the video, the camera, the viewer's screen, or that you are an AI.
- Write for the ear: short sentences, concrete words, one idea per sentence.
- Open with a hook in the first sentence and close with a clear takeaway.
"""

    fun scriptUser(subject: String, language: String, paragraphs: Int, extra: String): String =
        buildString {
            append("Subject: ").append(subject).append('\n')
            append("Write exactly ").append(paragraphs).append(" paragraph(s), separated by a blank line.\n")
            append("Each paragraph should be about 3 to 5 sentences.\n")
            if (language.isNotBlank()) {
                append("Write the narration in this language: ").append(language).append(".\n")
            } else {
                append("Write the narration in the same language as the subject above.\n")
            }
            if (extra.isNotBlank()) {
                append("Additional instruction from the user: ").append(extra).append('\n')
            }
        }

    const val TERMS_SYSTEM = """
You pick stock-footage search keywords for a narration script.
Rules you must follow:
- Answer with a JSON array of strings and nothing else. Example: ["ocean waves", "city at night"]
- Always write the keywords in ENGLISH, whatever language the script is in.
- Each keyword is 1 to 3 words describing something filmable: a place, an object, an action.
- No abstract nouns, no brand names, no people's names, no punctuation inside a keyword.
"""

    fun termsUser(subject: String, script: String, amount: Int): String =
        buildString {
            append("Subject: ").append(subject).append('\n')
            append("Script:\n").append(script).append('\n')
            append("Return exactly ").append(amount).append(" keywords as a JSON array.")
        }
}

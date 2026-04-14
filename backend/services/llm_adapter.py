"""
llm_adapter.py — Adapter abstrato para multi-LLM.

Suporta:
  - Gemini Flash Lite (Google API) — producao
  - Ollama (Llama 3 / Gemma 4 local) — desenvolvimento
"""

from __future__ import annotations
import os
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class LLMAdapter(ABC):
    @abstractmethod
    def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        ...


class GeminiAdapter(LLMAdapter):
    """Google Gemini Flash Lite via API."""

    def __init__(self):
        self.api_key = os.environ.get("GEMINI_KEY")
        if not self.api_key:
            raise RuntimeError("GEMINI_KEY nao configurada")

    def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        import google.generativeai as genai

        genai.configure(api_key=self.api_key)
        model_name = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash-lite")
        model = genai.GenerativeModel(
            model_name,
            system_instruction=system_prompt or METIS_SYSTEM_PROMPT,
        )
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                max_output_tokens=1024,
            ),
        )
        return response.text


class OllamaAdapter(LLMAdapter):
    """Ollama local (Llama 3, Gemma 4, etc.)."""

    def __init__(self, model: str = "llama3"):
        self.model = model
        self.base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

    def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        import requests

        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system_prompt or METIS_SYSTEM_PROMPT,
            "stream": False,
            "options": {"temperature": 0.3},
        }
        res = requests.post(f"{self.base_url}/api/generate", json=payload, timeout=60)
        res.raise_for_status()
        return res.json().get("response", "")


def get_llm(model: str | None = None) -> LLMAdapter:
    """
    Factory: retorna o adapter adequado.

    Prioridade:
      1. Se GEMINI_KEY existe → GeminiAdapter
      2. Senao → OllamaAdapter (local)
    """
    if model and model.startswith("ollama:"):
        return OllamaAdapter(model=model.split(":", 1)[1])

    if os.environ.get("GEMINI_KEY"):
        try:
            return GeminiAdapter()
        except Exception as e:
            logger.warning(f"Gemini indisponivel ({e}), fallback pra Ollama")

    return OllamaAdapter(model=model or "llama3")


# ── System Prompt ────────────────────────────────────────────────

METIS_SYSTEM_PROMPT = """Voce e a Metis, uma estrategista tatica de League of Legends.

Regras:
- Responda APENAS com base no contexto fornecido e no seu conhecimento de LoL.
- Seja direto, analitico e pratico.
- Use dados concretos quando disponiveis (winrate, KDA, gold diff, etc.).
- Nunca invente dados que nao foram fornecidos.
- Responda em portugues brasileiro.
- Formato: respostas curtas e objetivas, use bullet points quando apropriado.
"""

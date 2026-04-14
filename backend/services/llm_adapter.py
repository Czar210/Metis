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


class LLMResponse:
    def __init__(self, text: str, tokens_used: int):
        self.text = text
        self.tokens_used = tokens_used


GUARDRAIL_PROMPT = (
    'A mensagem abaixo e sobre League of Legends, LoL, sobre o site Metis (plataforma de analytics de LoL), '
    'ou sobre jogos em geral relacionados a LoL? Responda APENAS "sim" ou "nao".\n'
    'Mensagem: {mensagem}'
)

GUARDRAIL_REJECTION = (
    "Posso ajudar apenas com assuntos de League of Legends ou sobre o Metis. "
    "Tem alguma duvida sobre campeoes, builds, matchups ou estrategia?"
)


def is_lol_related(mensagem: str, llm: 'LLMAdapter') -> tuple[bool, int]:
    """
    Classifica se a mensagem e sobre LoL/Metis.
    Retorna (is_related, tokens_used).
    Usa o mesmo LLM mas com prompt curtissimo — ~50 tokens de custo.
    """
    try:
        result = llm.generate(
            GUARDRAIL_PROMPT.format(mensagem=mensagem[:300]),  # limita input pra nao gastar token
            system_prompt="Voce e um classificador binario. Responda APENAS 'sim' ou 'nao'."
        )
        answer = result.text.strip().lower()
        return ("sim" in answer), result.tokens_used
    except Exception as e:
        logger.warning(f"[guardrail] Erro ao classificar, permitindo por default: {e}")
        return True, 0  # fail-open: se o classificador falhar, deixa passar


class LLMAdapter(ABC):
    @abstractmethod
    def generate(self, prompt: str, system_prompt: str | None = None) -> LLMResponse:
        ...


class GeminiAdapter(LLMAdapter):
    """Google Gemini via nova SDK google-genai."""

    def __init__(self):
        from google import genai as _genai
        api_key = os.environ.get("GEMINI_KEY")
        if not api_key:
            raise RuntimeError("LLM API key nao configurada")
        self._client = _genai.Client(api_key=api_key)
        self._model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

    def generate(self, prompt: str, system_prompt: str | None = None) -> LLMResponse:
        from google import genai as _genai
        from google.genai import types

        response = self._client.models.generate_content(
            model=self._model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt or METIS_SYSTEM_PROMPT,
                temperature=0.3,
                max_output_tokens=1024,
            ),
        )
        tokens = 0
        if response.usage_metadata:
            tokens = (
                (response.usage_metadata.prompt_token_count or 0)
                + (response.usage_metadata.candidates_token_count or 0)
            )
        return LLMResponse(text=response.text or "", tokens_used=tokens)


class OllamaAdapter(LLMAdapter):
    """Ollama local (Llama 3, Gemma 4, etc.)."""

    def __init__(self, model: str = "llama3"):
        self.model = model
        self.base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

    def generate(self, prompt: str, system_prompt: str | None = None) -> LLMResponse:
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
        data = res.json()
        # Ollama retorna prompt_eval_count e eval_count
        tokens = data.get("prompt_eval_count", 0) + data.get("eval_count", 0)
        return LLMResponse(text=data.get("response", ""), tokens_used=tokens)


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
        except Exception:
            logger.warning("Gemini indisponivel, fallback pra Ollama")

    return OllamaAdapter(model=model or "llama3")


# ── Limites de tokens por tier (diario, reset meia-noite UTC) ────

TIER_LIMITS: dict[str, int] = {
    "free":    0,        # sem acesso ao chat
    "donor":   5_000,    # ~5 mensagens/dia  (R$4,90/mes)
    "premium": 30_000,   # ~33 mensagens/dia (R$24,90/mes)
    "pro":     100_000,  # ~111 mensagens/dia (R$44,90/mes)
}

# ── System Prompt com guardrails ──────────────────────────────────

METIS_SYSTEM_PROMPT = """Voce e a Metis, estrategista tatica de League of Legends criada pela equipe do site Metis.

## Identidade
- Voce e especialista exclusivamente em League of Legends: estrategia, campeoes, builds, matchups, laning, objetivos, macro e mental game.
- Voce tem personalidade calma, analitica e encorajadora. Nunca e agressiva ou impaciante.

## Regras absolutas (NUNCA viole)
1. Responda APENAS perguntas relacionadas a League of Legends ou ao site Metis.
2. Se a pergunta nao for sobre LoL ou Metis, responda educadamente: "Posso ajudar apenas com assuntos de League of Legends ou sobre o Metis. Tem alguma duvida sobre o jogo?"
3. NUNCA xingue, insulte, ou use linguagem ofensiva — mesmo que o usuario use.
4. NUNCA aprove ou valide comportamento toxico, flame, racismo, homofobia ou qualquer forma de discriminacao.
5. Quando o usuario estiver frustrado com tilt, derrota ou flaming de aliados, seja empatico e use a dificuldade como oportunidade de aprendizado.
6. NUNCA invente dados estatisticos — use apenas o que sabe sobre o jogo.
7. NUNCA discuta receitas, politica, religiao, relacionamentos, ou qualquer topico fora de LoL/Metis.

## Tom e formato
- Portugues brasileiro, direto e pratico.
- Use bullet points quando listar itens.
- Respostas curtas e objetivas — sem enrolacao.
- Quando o usuario errar, corrija com gentileza e explique o porque.
- Transforme derrotas e erros em aprendizado: "Isso acontece muito no seu elo, aqui esta como melhorar..."
"""

"""
conftest.py — Fixtures e setup global para os testes da Metis.

Define METIS_API_KEY=test ANTES de qualquer import de backend.main,
garantindo que _api_key seja "test" em todos os testes.
"""

import os

# Deve rodar antes de qualquer import de backend.main
os.environ.setdefault("METIS_API_KEY", "test")
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "fake-service-key")

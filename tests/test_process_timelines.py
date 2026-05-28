import unittest
from unittest.mock import MagicMock
from scripts.processing.process_timelines import extrair_dados_timeline, processar_timeline

class TestProcessTimelines(unittest.TestCase):

    def setUp(self):
        """
        Esse método roda ANTES de cada teste.
        Aqui nós criamos um JSON falso simulando a Riot, para não depender da internet!
        """
        self.mock_timeline = {
            "metadata": {"matchId": "BR1_TESTE_123"},
            "info": {
                "participants": [
                    {"participantId": 1, "puuid": "puuid_jogador_1"}
                ],
                "frames": [
                    {
                        "timestamp": 600000, # 10 Minutos exatos!
                        "participantFrames": {
                            "1": {
                                "level": 9,
                                "totalGold": 3500,
                                "minionsKilled": 80,
                                "jungleMinionsKilled": 4,
                                "damageStats": {"totalDamageDoneToChampions": 4500}
                            }
                        },
                        "events": [
                            {
                                "type": "CHAMPION_KILL",
                                "killerId": 1,
                                "timestamp": 600050,
                                "position": {"x": 5000, "y": 5000}
                            }
                        ]
                    }
                ]
            }
        }

    def test_extrair_dados_timeline(self):
        """
        TESTE 1: Verifica se a lógica de cálculo (matemática/estruturação) está certa.
        ZERO banco de dados aqui. Roda em 0.001 segundos.
        """
        match_id, snapshots, events = extrair_dados_timeline(self.mock_timeline)

        # O ID bate com o nosso JSON falso?
        self.assertEqual(match_id, "BR1_TESTE_123")

        # Ele pegou a foto dos 10 minutos direitinho?
        self.assertEqual(len(snapshots), 1)
        self.assertEqual(snapshots[0]["timestamp_minute"], 10)
        self.assertEqual(snapshots[0]["total_gold"], 3500)

        # Ele registrou o abate?
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_type"], "CHAMPION_KILL")

    def test_processar_timeline_com_mock_supabase(self):
        """
        TESTE 2: Verifica a inserção no banco SEM SUJAR o Supabase!
        Usamos o MagicMock para ser nosso "Dublê".
        """
        mock_supabase_client = MagicMock()
        sucesso = processar_timeline(self.mock_timeline, db_client=mock_supabase_client)

        self.assertTrue(sucesso)
        mock_supabase_client.table.assert_any_call("participant_snapshots")
        mock_supabase_client.table.assert_any_call("critical_events")
        self.assertTrue(mock_supabase_client.table().upsert().execute.called)

    def test_item_purchased_extraido(self):
        """TESTE 3: ITEM_PURCHASED gera evento com itemId no details."""
        timeline = {
            "metadata": {"matchId": "BR1_ITEM_TEST"},
            "info": {
                "participants": [{"participantId": 1, "puuid": "puuid_1"}],
                "frames": [{
                    "timestamp": 120000,
                    "participantFrames": {},
                    "events": [{
                        "type": "ITEM_PURCHASED",
                        "participantId": 1,
                        "itemId": 3157,
                        "timestamp": 120500,
                        "position": {"x": 100, "y": 200},
                    }]
                }]
            }
        }
        match_id, snapshots, events = extrair_dados_timeline(timeline)

        self.assertEqual(match_id, "BR1_ITEM_TEST")
        self.assertEqual(len(snapshots), 0)
        self.assertEqual(len(events), 1)
        ev = events[0]
        self.assertEqual(ev["event_type"], "ITEM_PURCHASED")
        self.assertEqual(ev["primary_participant_id"], "puuid_1")
        self.assertEqual(ev["details"]["itemId"], 3157)
        self.assertIsNone(ev["secondary_participant_id"])

    def test_skill_level_up_extraido(self):
        """TESTE 4: SKILL_LEVEL_UP gera evento com skillSlot e levelUpType no details."""
        timeline = {
            "metadata": {"matchId": "BR1_SKILL_TEST"},
            "info": {
                "participants": [{"participantId": 2, "puuid": "puuid_2"}],
                "frames": [{
                    "timestamp": 60000,
                    "participantFrames": {},
                    "events": [{
                        "type": "SKILL_LEVEL_UP",
                        "participantId": 2,
                        "skillSlot": 1,
                        "levelUpType": "NORMAL",
                        "timestamp": 60100,
                        "position": {},
                    }]
                }]
            }
        }
        match_id, snapshots, events = extrair_dados_timeline(timeline)

        self.assertEqual(match_id, "BR1_SKILL_TEST")
        self.assertEqual(len(events), 1)
        ev = events[0]
        self.assertEqual(ev["event_type"], "SKILL_LEVEL_UP")
        self.assertEqual(ev["primary_participant_id"], "puuid_2")
        self.assertEqual(ev["details"]["skillSlot"], 1)
        self.assertEqual(ev["details"]["levelUpType"], "NORMAL")

    def test_eventos_desconhecidos_ignorados(self):
        """TESTE 5: Tipos de evento nao mapeados nao geram linhas."""
        timeline = {
            "metadata": {"matchId": "BR1_UNKNOWN"},
            "info": {
                "participants": [{"participantId": 1, "puuid": "puuid_1"}],
                "frames": [{
                    "timestamp": 0,
                    "participantFrames": {},
                    "events": [
                        {"type": "WARD_PLACED", "participantId": 1, "timestamp": 100},
                        {"type": "LEVEL_UP", "participantId": 1, "timestamp": 200},
                    ]
                }]
            }
        }
        _, _, events = extrair_dados_timeline(timeline)
        self.assertEqual(len(events), 0)

if __name__ == '__main__':
    unittest.main()

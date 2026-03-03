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
        # Criamos um cliente falso do Supabase
        mock_supabase_client = MagicMock()

        # Rodamos a função principal injetando o nosso cliente falso
        sucesso = processar_timeline(self.mock_timeline, db_client=mock_supabase_client)

        # O script tem que retornar True
        self.assertTrue(sucesso)

        # VERIFICAÇÃO DE OURO: O script tentou salvar os snapshots no supabase?
        mock_supabase_client.table.assert_any_call("participant_snapshots")
        mock_supabase_client.table.assert_any_call("critical_events")

        # Verifica se o .upsert().execute() foi chamado para o db_client falso
        self.assertTrue(mock_supabase_client.table().upsert().execute.called)

if __name__ == '__main__':
    unittest.main()

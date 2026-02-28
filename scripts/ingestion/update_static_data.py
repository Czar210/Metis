import requests
import json
import os

# Salva os dados estáticos (campeões e itens) em arquivos JSON locais.
os.makedirs("data/static", exist_ok=True)


def get_latest_version():
    url = "https://ddragon.leagueoflegends.com/api/versions.json"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()[0]  # Retorna apenas a versão mais recente (primeiro item da lista)


def download_ddragon_data(version, data_type):
    url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/pt_BR/{data_type}.json"
    print(f"Baixando {data_type} da versão {version}...")

    response = requests.get(url)
    response.raise_for_status()

    filepath = f"data/static/{data_type}.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(response.json(), f, ensure_ascii=False, indent=4)
    print(f"Salvo com sucesso em {filepath}")


if __name__ == "__main__":
    try:
        latest_patch = get_latest_version()
        print(f"Patch mais recente detectado: {latest_patch}")
        download_ddragon_data(latest_patch, "champion")
        download_ddragon_data(latest_patch, "item")

        print("✅ Rotina Estática finalizada com sucesso!")
    except Exception as e:
        print(f"❌ Erro ao puxar dados estáticos: {e}")

# Guia de classificação de campeões — Fase 4 do plano v0.9.0

**Arquivo a editar:** [`data/champion_classification.csv`](../data/champion_classification.csv) (172 campeões)
**Dono da tarefa:** César
**Consumidor:** `scripts/processing/sync_champions.py` (a ser criado na Fase 4) → tabela `champions` no Supabase

---

## Como preencher o CSV

Cada linha já vem com:
- `champion_name` — chave da Riot (**NÃO mude**, é o id interno)
- `display_name` — nome em pt-BR (referência)
- `title` — alcunha (referência)
- `ddragon_tags` — tags oficiais separadas por `|` (referência rápida do papel oficial da Riot)
- `short_blurb` — descrição em pt-BR (200 chars) (referência narrativa)

Você preenche só **três colunas**:
- `primary_class` — **obrigatória**, escolhe UMA das 10 classes abaixo
- `secondary_classes` — **opcional**, uma ou duas classes extras separadas por `|` (ex: `skirmisher|bruiser`)
- `notes` — **opcional**, qualquer observação livre (ex: "kit flexível", "mudou muito em 14.19")

Deixar `primary_class` vazio = campeão não classificado (o script de seed pode tratar como "other" e ignorar até a revisão chegar).

---

## As 10 classes da taxonomia

| Classe | Papel | Sinal forte | Exemplos canônicos |
|---|---|---|---|
| `tank` | Frontline defensiva | Vida alta, CC pesado, baixo dano | Ornn, Malphite, Maokai, Rammus, Shen |
| `bruiser` | Frontline ofensiva, meio-termo | Durável + dano corpo-a-corpo, mobilidade moderada | Camille, Sett, Renekton, Jax, Gragas |
| `juggernaut` | Tank ofensivo lento | Alto dano sustentado AD, sem mobilidade, precisa stick | Mordekaiser, Aatrox, Illaoi, Darius, Garen |
| `skirmisher` | Duelista ágil | Dano sustentado + mobilidade, 1v1 forte | Yone, Fiora, Irelia, Yasuo, Master Yi |
| `assassin` | Burst + mobilidade | Combo letal em alvo único, frágil, depende de pick | Zed, Talon, Katarina, Akali, LeBlanc |
| `burst_mage` | Combo mágico em rajada | Alto dano burst AP, combos rápidos, cooldown médio/alto | Syndra, Veigar, Lux, Annie, Ahri |
| `control_mage` | Dano mágico sustentado + zona | DPS contínuo, waveclear, scaling AP | Orianna, Viktor, Anivia, Cassiopeia, Vel'Koz |
| `marksman` | ADC clássico | Dano físico à distância, auto-attack focus, scaling | Jinx, Caitlyn, Aphelios, Jhin, Ashe |
| `enchanter` | Suporte de buffs/heals | Shields, heals, peels, zero kill threat solo | Soraka, Lulu, Nami, Janna, Yuumi |
| `catcher` | Suporte de pick/zona | CC pesado, long-range engage, zone control | Thresh, Morgana, Bard, Blitzcrank, Rakan |

### Regras de decisão quando tiver dúvida

1. **Qual é o papel em ranked solo queue HOJE?** (não lore, não pro play, não ARAM)
2. **Se 2 classes encaixam**, `primary_class` = a que o jogo **preferencialmente** pede dele
3. **Flexões históricas** vão em `secondary_classes` (ex: Kayn Rhaast = `juggernaut` secundário; Kayn Shadow = `assassin` primário)

### Casos difíceis conhecidos

- **Kayn** → primary `assassin`, secondary `skirmisher|juggernaut` (2 formas)
- **Jayce** → primary `marksman`, secondary `burst_mage` (hybrid)
- **Swain** → primary `control_mage`, secondary `bruiser` (draintank build)
- **Ivern** → primary `enchanter`, secondary `catcher` (jungle de suporte)
- **Pyke** → primary `assassin`, secondary `catcher` (support assassin)
- **Yuumi** → primary `enchanter` (não tem secondary — kit único)
- **Aurelion Sol** → primary `control_mage` (scaling + DPS, não é burst)
- **Graves** → primary `marksman`, secondary `skirmisher` (AD jg brawler)
- **Neeko** → primary `burst_mage`, secondary `catcher`

### Sinais de classificação pelas `ddragon_tags`

As tags da Riot são grossas — a gente usa como **pista**, não decisão final:

| Tag DDragon | Nossas classes prováveis |
|---|---|
| `Tank` sozinho | `tank` |
| `Tank|Fighter` | `tank` ou `juggernaut` |
| `Fighter` sozinho | `bruiser`, `juggernaut`, `skirmisher` |
| `Fighter|Tank` | `juggernaut` ou `bruiser` |
| `Assassin` | `assassin` |
| `Fighter|Assassin` | `skirmisher` ou `assassin` |
| `Mage` sozinho | `control_mage` ou `burst_mage` |
| `Mage|Assassin` | `burst_mage` ou `assassin` |
| `Mage|Support` | `enchanter` ou `catcher` |
| `Marksman` | `marksman` |
| `Marksman|Assassin` | `marksman` ou `assassin` |
| `Support` (sozinho) | `enchanter` ou `catcher` |
| `Support|Tank` | `tank` ou `catcher` |

---

## Fluxo de trabalho sugerido

1. Abre [`data/champion_classification.csv`](../data/champion_classification.csv) no VSCode (ou Excel / Google Sheets — qualquer editor de CSV)
2. Vai em lotes de 20–30 champs por sessão (30–60 min)
3. Começa pelos óbvios (Ornn=tank, Jinx=marksman, Thresh=catcher) — só bate o olho
4. Guarda os duvidosos pro fim da lista quando já tá calibrado
5. Salva o arquivo
6. Commit: `git add data/champion_classification.csv && git commit -m "classify: N champions"`

Quando terminar, a Fase 4 vira só rodar o `sync_champions.py` que consome esse CSV e faz upsert em `champions`.

---

## Regenerar o CSV (se sair campeão novo da Riot)

```bash
python -m scripts.processing.build_champion_csv_template
```

⚠️ **Cuidado:** regerar sobrescreve o arquivo e perde tudo que tu já classificou. Se precisar atualizar pra pegar um champ novo, deixa eu ajustar o script pra fazer **merge** (preservar `primary_class`/`secondary_classes`/`notes` dos existentes e só adicionar as linhas novas).

---

## Progresso sugerido

- [ ] 0–30 champs (sessão 1, ~45 min)
- [ ] 30–70 champs (sessão 2)
- [ ] 70–120 champs (sessão 3)
- [ ] 120–172 champs (sessão 4)
- [ ] Revisão final dos duvidosos (sessão 5, ~30 min)
- [ ] Total estimado: **~4 horas em 5 sessões**

Paralelo com as Fases 0–3 do plano — não bloqueia nada.

# Templates — preencher localmente

Os CSVs aqui são **templates vazios/semi-preenchidos** pra estruturas que dependem de decisão humana (classificação de campeões, itens, etc).

## Fluxo de uso

1. Copia o arquivo pra `analysis/comp_heuristics/` (pasta **local**, gitignored)
2. Abre no Excel / Google Sheets / LibreOffice
3. Preenche as linhas (tem exemplos no template pra mostrar formato)
4. Quando terminar, roda o script de ingestão que popula o Supabase (spec do script fica no `.speckit/plano_backend_decisoes.md` ticket D5)

> **Importante:** o CSV preenchido NÃO sobe pro GitHub. Fica apenas em `analysis/`. O template em branco sim fica versionado pra qualquer um do time usar.

---

## `comp_heuristics_champions.csv`

Uma linha por `(champion, role)` — se o mesmo champion é viável em múltiplos roles, faz uma linha por role.

### Colunas

| Coluna | Tipo | Valores | Explicação |
|--------|------|---------|------------|
| `champion` | text | id do Data Dragon (ex: `Kayn`, `MonkeyKing`) | Id do campeão, não o display name |
| `role` | enum | `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY` | Convenção Riot Match-V5 |
| `primary_archetype` | enum | `dive`, `engage`, `poke`, `pick`, `siege`, `split`, `scaling`, `early_skirmish`, `protect`, `assassin` | Tag principal — o que o champ faz melhor |
| `secondary_archetype` | enum (opcional) | mesmos valores acima ou vazio | Tag secundária pra champs versáteis |
| `damage_type` | enum | `AD`, `AP`, `HYBRID`, `TRUE` | Tipo de dano dominante |
| `range_class` | enum | `MELEE`, `SHORT_RANGE` (525-550), `LONG_RANGE` (550-650), `VERY_LONG` (650+) | Alcance principal |
| `cc_type` | multi (pipe-separated) | `NONE`, `SOFT` (slow), `HARD` (stun/root/knockup), `LOCKDOWN` (suppress/airborne chain) | Pode ter mais de um: `HARD\|SOFT` |
| `cc_tier` | 0-3 | 0=nenhum, 1=situacional, 2=confiável, 3=múltiplas ferramentas | Densidade de CC no kit |
| `engage_tool` | 0/1 | 1 se tem engage ativo tipo Malph R, Rakan W, Leona E | Binário |
| `peel_tool` | 0/1 | 1 se tem ferramenta defensiva pra parceiro (Janna Q, Thresh W, Braum E) | Binário |
| `front_line` | 0/1 | 1 se aguenta stand na frente (tanks, bruisers) | Binário |
| `mobility` | 0-3 | 0=Nasus, 1=Garen, 2=Ahri, 3=Lee Sin/LeBlanc | Subjetivo mas estável |
| `early_power` | 0-3 | Quanto o champ é forte do min 0-14 | |
| `mid_power` | 0-3 | Min 14-25 | |
| `late_power` | 0-3 | Min 25+ | |
| `teamfight_weight` | 0-3 | Quanto carrega teamfight 5x5 | |
| `pickoff_weight` | 0-3 | Quanto é bom caçando alvo isolado | |
| `splitpush_weight` | 0-3 | Quanto é bom split-pushing 1v1 | |
| `notes` | text | livre | Observações (ex: "Rhaast vs SA muda perfil") |

### Escopo de preenchimento

168 campeões × ~2 roles médios viáveis = **~300 linhas**. Sugestão: preencher por tier da meta (S+/S/A primeiro, depois B/C).

---

## `comp_heuristics_items.csv`

Uma linha por item relevante. Itens de componente (Long Sword, Dagger) e consumíveis não entram — só os finais/lendários + starters + boots.

### Colunas

| Coluna | Tipo | Valores | Explicação |
|--------|------|---------|------------|
| `item_name` | text | Nome oficial (ex: `Luden's Companion`) | |
| `item_id` | int | ID numérico do Data Dragon (ex: `6655`) | Pra join com tabela `items` do Supabase |
| `category` | enum | `core_bruiser`, `core_assassin`, `core_mage_burst`, `core_mage_scaling`, `core_fighter`, `support_enchanter`, `support_engage`, `tank_bruiser`, `tank_warden`, `boots`, `starter`, `situational_anti_heal`, `situational_mr`, `situational_armor`, `situational_anti_tank`, `situational_anti_crit` | Classe do item |
| `primary_stat` | enum | `AD`, `AP`, `HEALTH`, `ARMOR`, `MR`, `HYBRID`, `NONE` | Stat principal |
| `archetype_signal` | multi (pipe) | `dive`, `poke`, `scaling`, `splitpush`, `teamfight`, `pickoff`, `assassin`, `protect`, `engage` | Que comp esse item empurra — multi-valor |
| `tier_bought` | enum | `early` (1º recall), `core_1st` (1º item grande), `core_2nd`, `core_3rd`, `situational` | Quando típicamente é comprado |
| `cost` | int | Gold | Custo total |
| `anti_what` | multi (pipe) | `anti_heal`, `anti_shield`, `anti_burst`, `anti_ap`, `anti_ad`, `anti_ranged`, `anti_melee`, `anti_tank`, `anti_crit`, `anti_slow` | Contra o quê, se situational. Vazio pra itens normais |
| `notes` | text | livre | |

### Escopo

~180 itens finais + starters + boots relevantes. Menos tedioso que campeões.

---

## Depois de preencher

Ao terminar, me chama de volta e eu escrevo o script de ingestão (`scripts/processing/ingest_comp_heuristics.py`) que popula as tabelas:
- `champion_archetypes`
- `item_archetypes`

E o algoritmo de classificação de comp (soma os tags dos 5 picks + itens rushed do time) vira uma função Python pequena consumida pelo endpoint `/api/v1/champion/{id}/synergies`.

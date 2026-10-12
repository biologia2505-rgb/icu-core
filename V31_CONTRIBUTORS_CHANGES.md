# V31 — processes / continuous contributors

12.10.2026. Статус **v31.0-dev**. Freeze не выполнялся. Ветка v31.0-dev опубликована на GitHub по прямой команде пользователя; ниже результаты клинического пакета до публикации.

Удалены диагностические эвристики corrected HCO₃ >28, SBE_Cl ≤−5, SBE_Cl ≥+5, SBE_Alb ≥+5. Это исправление неутверждённых implementation heuristics, **не замена medical rules**. Другие числовые пороги не введены. Отдельное прямое уточнение пользователя для существующей Δ/Δ policy: >2 → probable metabolic alkalinizing component; classic alkalosis не назначается из ratio.

`contributors` и `processConfidence` отделяют направление/число от процесса и его диагностической уверенности. Исчезли `.high`, `lowSID`/`lowSIDEffect` и `multipleMethods`. SIDa/SIDe остаются численными: общий эффект без reference не получает произвольной классификации; направление относительного хлоридного вклада доступно отдельно.

HH, AG, AGcorr, Kellum, Stewart, числовая Δ/Δ policy, Winter/legacy compensation, QC/conditional gas scenarios, sodium calculations/presentation, шкалы и рСКФ защищены сравнением функций с предыдущей v31 и числовыми проверками с frozen v30.1. В `index.html` изменены только `correctedBicarbonate`, `synthesizeAcidBase`, `syndrome`.

## A–H после исправления

| Case | Current diagnostic composition | Contributors / confidence |
|---|---|---|
| A | Metabolic alkalosis + respiratory alkalosis; HAGMA supported при source=yes, иначе possible | Classic сохраняется по существующей газовой модели. Численные Cl/SID/corrected не повышают confidence |
| B | HAGMA + probable metabolic alkalinizing component; adequate Winter | Δ/Δ=2.8; прежний classic label снят. Corrected=51, SBE_Cl=+27 сохраняются |
| C | HAGMA possible при unknown/no, supported при yes; masked/opposing metabolic pattern | Corrected=33, delta gap=+9, SBE_Cl=+9. Отдельный алкализирующий процесс **не установлен** из contributors |
| D | HAGMA + NAGMA + respiratory acidosis | NAGMA по Δ/Δ=0.40, не по −5 Cl; SBE_Alb остаётся вкладом |
| E | HAGMA + NAGMA; adequate Winter | NAGMA по Δ/Δ≈0.578; прежний lowSID=true API заменён численным chloride contributor с acidifying direction |
| F | HAGMA + respiratory acidosis; possible metabolic alkalinizing component | Возможность по Δ/Δ≈1.92. Corrected=29.5 и SBE_Alb≈+7.38 не делают компонент supported; SBE_input=0 сохранён, warning прежний |
| G | Sodium: TBW=42, условная разность Na=672, после 1 л +0.697674≈+0.70; объёма до 140 нет | Sodium assertions неизменны. Прежний NAGMA в этой fixture из SBE_Cl≤−5 снят; отрицательный chloride contributor сохранён |
| H | Финальный диагноз blocked; три conditional ветви | Введённые газы не исправлены; численные contributors не интерпретируются диагностически |

## Точные поправки expectations

Прежние v31 ledgers сохранены побайтно. Новый слой `tests/v31-contributors-expectations.json` проверяет `before` против предыдущего ожидаемого результата и только затем применяет `after`. Исходные clinical contracts/gold не переписаны. Ниже перечислены **43 assertions в 38 cases** набора 300.

| ID | Assertion | Previous v31 | Current | Reason |
|---|---|---|---|---|
| DOUBLE-11 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis"] | ["HAGMA", "metabolic alkalinizing component"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| DOUBLE-12 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis"] | ["HAGMA", "metabolic alkalinizing component"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| DOUBLE-13 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis"] | ["HAGMA", "metabolic alkalinizing component"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| DOUBLE-14 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis"] | ["HAGMA", "metabolic alkalinizing component"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| DOUBLE-15 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis"] | ["HAGMA", "metabolic alkalinizing component"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| DOUBLE-16 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis"] | ["HAGMA", "metabolic alkalinizing component"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| DOUBLE-17 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis"] | ["HAGMA", "metabolic alkalinizing component"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| DOUBLE-18 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis"] | ["HAGMA", "metabolic alkalinizing component"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| DOUBLE-19 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis"] | ["HAGMA", "metabolic alkalinizing component"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| DOUBLE-20 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis"] | ["HAGMA", "metabolic alkalinizing component"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-01 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-02 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-03 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-04 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-05 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-06 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-07 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-08 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-09 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-10 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-11 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory acidosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory acidosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-12 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory acidosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory acidosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-13 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory acidosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory acidosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-14 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory acidosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory acidosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-15 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory acidosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory acidosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-16 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory acidosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory acidosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-17 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory acidosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory acidosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-18 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory acidosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory acidosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-19 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory acidosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory acidosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| TRIPLE-20 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory acidosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory acidosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| NORMAL-PH-MIXED-05 | possible processes are not proven | ["metabolic alkalinizing component"] | [] | Remove unapproved corrected >28 heuristic: contributors alone do not create a process. |
| NORMAL-PH-MIXED-06 | confirmed/probable process composition | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | ["HAGMA", "respiratory alkalosis"] | Remove unapproved corrected >28 / SBE_Cl >=5 confidence promotion. Δ/Δ 1.5–2 remains possible. |
| NORMAL-PH-MIXED-06 | possible processes are not proven | [] | ["metabolic alkalinizing component"] | Remove unapproved corrected >28 / SBE_Cl >=5 confidence promotion. Δ/Δ 1.5–2 remains possible. |
| NORMAL-PH-MIXED-07 | confirmed/probable process composition | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | ["HAGMA", "respiratory alkalosis"] | Remove unapproved corrected >28 / SBE_Cl >=5 confidence promotion. Δ/Δ 1.5–2 remains possible. |
| NORMAL-PH-MIXED-07 | possible processes are not proven | [] | ["metabolic alkalinizing component"] | Remove unapproved corrected >28 / SBE_Cl >=5 confidence promotion. Δ/Δ 1.5–2 remains possible. |
| NORMAL-PH-MIXED-08 | confirmed/probable process composition | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | ["HAGMA", "respiratory alkalosis"] | Remove unapproved corrected >28 / SBE_Cl >=5 confidence promotion. Δ/Δ 1.5–2 remains possible. |
| NORMAL-PH-MIXED-08 | possible processes are not proven | [] | ["metabolic alkalinizing component"] | Remove unapproved corrected >28 / SBE_Cl >=5 confidence promotion. Δ/Δ 1.5–2 remains possible. |
| NORMAL-PH-MIXED-09 | confirmed/probable process composition | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | ["HAGMA", "respiratory alkalosis"] | Remove unapproved corrected >28 / SBE_Cl >=5 confidence promotion. Δ/Δ 1.5–2 remains possible. |
| NORMAL-PH-MIXED-09 | possible processes are not proven | [] | ["metabolic alkalinizing component"] | Remove unapproved corrected >28 / SBE_Cl >=5 confidence promotion. Δ/Δ 1.5–2 remains possible. |
| NORMAL-PH-MIXED-10 | confirmed/probable process composition | ["HAGMA", "metabolic alkalosis", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] | Approved Δ/Δ >2 policy: probable metabolic alkalinizing component, no classic alkalosis from ratio. No formula change. |
| HYPOALBUMINEMIA-06 | confirmed/probable process composition | ["HAGMA", "NAGMA"] | ["HAGMA"] | Remove unapproved SBE_Cl <=-5 diagnostic branch; chloride remains a contributor, not an added NAGMA. |
| HYPOALBUMINEMIA-06 | single primary with compensation is isolated | "Смешанное нарушение" | "Изолированное нарушение" | Remove unapproved SBE_Cl <=-5 diagnostic branch; chloride remains a contributor, not an added NAGMA. |
| HYPOALBUMINEMIA-07 | confirmed/probable process composition | ["HAGMA", "NAGMA"] | ["HAGMA"] | Remove unapproved SBE_Cl <=-5 diagnostic branch; chloride remains a contributor, not an added NAGMA. |

Из них: DOUBLE-11–20 / TRIPLE-01–20 / NORMAL-PH-MIXED-10 — classic → probable component (ratio policy); NORMAL-05 — possible из >28 удалён; NORMAL-06–09 — supported из >28/+5 снят, остаётся possible по borderline ratio; HYPOALBUMINEMIA-06/07 — дополнительный NAGMA из −5 снят.

### Прочие assertions

- `classification-boundaries`: Δ/Δ=2 теперь possible component вместо supported; Δ/Δ=2.0001 — probable component вместо classic. Числа/допуски не менялись.
- `final-core-defects`: два assertions TRIPLE-09/10 меняют classic label на probable component.
- `v31-synthesis`: B, C-unknown, C-yes, E, F и corrected-alone/renal-compensation обновлены после удаления эвристик. Проверки borderline и sodium-limits теперь явно проверяют confidence/отсутствие удалённых API, вместо пустого отрицания undefined `multipleMethods`. Все inputs A–H неизменны. Названия B/E/F обновлены по актуальному смыслу.
- A, D, Winter F, sodium G, triad H, source confirmation и измеренный Na сохраняют свои прежние assertions. Новые 17 проверок contributors отдельно доказывают отсутствие скачка diagnosis/confidence около 28/±5, отсутствие new diagnosis из положительных/отрицательных contributors, shared input disclosure и неизменность защищённых функций.

### Adversarial: 3 explicit changes

| Probe | Previous v31 | Current | Reason |
|---|---|---|---|
| DD-class-1.99 | {"NAGMA": false, "alk": false, "possible": false, "supportedComponent": true} | {"NAGMA": false, "alk": false, "possible": true, "supportedComponent": false} | Removed unapproved corrected >28 / SBE_Cl >=5 promotion; approved borderline ratio remains possible. |
| DD-class-2 | {"NAGMA": false, "alk": false, "possible": false, "supportedComponent": true} | {"NAGMA": false, "alk": false, "possible": true, "supportedComponent": false} | Removed unapproved corrected >28 / SBE_Cl >=5 promotion; approved borderline ratio remains possible. |
| DD-class-2.01 | {"NAGMA": false, "alk": true, "possible": false} | {"NAGMA": false, "alk": false, "possible": false, "probableComponent": true} | Explicit approved Δ/Δ >2 wording: probable component, no classic diagnosis from ratio. |

Все шесть original adversarial scripts и numeric inputs сохранены. Старые 49 v30 ledgers и 4 initial v31 amendments остаются; новый overlay проверяет точное `before`. `AG-composition-24-40` сохраняет ожидание non-isolated через masked pattern, а не через повышение confidence алкализирующего диагноза. `DD-class-1.51` сохраняет possible по Δ/Δ, а не по corrected cutoff.

## Сохранённое происхождение

- `reference/v31-pre-contributors.zip`: исходник, tests/expectations, changelog и итог A–H до исправления. SHA-256 архива: `b4fbd02229c46153ec98fe87c385696d850cb0f35c867511d289db287838791d`.
- `reference/v31-contributors-initial-conflicts.zip`: реальные FAIL при запуске новых функций на прежних expectations до миграции; это исторические промежуточные отчёты со своими source hashes.
- `V31_THRESHOLD_AUDIT.md`: неизменный аудит прежнего SHA `97d4b067…`, не текущий документ статуса кода.
- Первичный frozen v30.1 ZIP и все независимые numeric gold сохранены.

## Проверка текущего исходника

Итог полного suite: `reports/TEST_SUMMARY_v31.md`. Отдельный повтор A–H: `reports/v31-A-H-separate.json`. Текущий SHA и counts: `DELIVERY_MANIFEST.json`. Старые browser-F/G снимки не используются как свидетельство текущего synthesis.

Текущий SHA-256 `index.html`: `cbb5f6922291fe7bc6c3d96410dd9c3ff76ddce5b0fd8959f9b11306a40aa9f7`. Итог: frozen v30.1 21/21 suites; v31 18/18 suites; 300/300 cases (включая защищённые 35); adversarial 1970/1970; A–H 22/22, отдельно повторены; contributors 17/17; числовая/функциональная регрессия 1280/1280. Относительно предыдущей v31 изменены ровно три функции: `correctedBicarbonate`, `synthesizeAcidBase`, `syndrome`; остальные 88 функций совпадает побайтно.

# Исторические изменения ожиданий начальной v31

**Исторический документ для SHA 97d4b067… до исправления 12.10.2026.** Его утверждение «только утверждённые правила» ошибочно распространялось на четыре implementation heuristics. Они удалены; актуальные expectations применяются отдельным слоем, см. `V31_CONTRIBUTORS_CHANGES.md`. Исходный текст этого документа до пометки сохранён в `reference/v31-pre-contributors.zip`.

Все исходные файлы тестов, gold, отчёты и v30.1 сохранены без изменения в `reference/v30.1-frozen-package.zip`. Новый runner повторяет все 21 исходный набор в изолированной распаковке. Frozen исходник: SHA-256 `48dd6fda126fe9e10501ef114f11ad8e8c1230d5b6b7ff6f2ba37efe1afa468c`.

Ожидания v31 изменены только для утверждённых правил. До поправки первый запуск старого runner на v31 закономерно давал FAIL на прежних строках первичности, SBE-оговорках, sodium volume и проверках полного совпадения текста/схемы. Эти конфликты не трактованы как неизменённое поведение. Исходные ожидания не перезаписаны в gold.

## 300 клинических случаев: 12 утверждений в 7 случаях

| ID | Поле | Ожидание v30.1 | Ожидание v31 |
|---|---|---|---|
| NORMAL-PH-MIXED-05 | possible processes are not proven | [] | ["metabolic alkalinizing component"] |
| NORMAL-PH-MIXED-06 | confirmed/probable process composition | ["HAGMA", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] |
| NORMAL-PH-MIXED-06 | possible processes are not proven | ["metabolic alkalosis"] | [] |
| NORMAL-PH-MIXED-07 | confirmed/probable process composition | ["HAGMA", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] |
| NORMAL-PH-MIXED-07 | possible processes are not proven | ["metabolic alkalosis"] | [] |
| NORMAL-PH-MIXED-08 | confirmed/probable process composition | ["HAGMA", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] |
| NORMAL-PH-MIXED-08 | possible processes are not proven | ["metabolic alkalosis"] | [] |
| NORMAL-PH-MIXED-09 | confirmed/probable process composition | ["HAGMA", "respiratory alkalosis"] | ["HAGMA", "metabolic alkalinizing component", "respiratory alkalosis"] |
| NORMAL-PH-MIXED-09 | possible processes are not proven | ["metabolic alkalosis"] | [] |
| HYPOALBUMINEMIA-06 | confirmed/probable process composition | ["HAGMA"] | ["HAGMA", "NAGMA"] |
| HYPOALBUMINEMIA-06 | single primary with compensation is isolated | "Изолированное нарушение" | "Смешанное нарушение" |
| HYPOALBUMINEMIA-07 | confirmed/probable process composition | ["HAGMA"] | ["HAGMA", "NAGMA"] |

NORMAL-PH-MIXED-05: добавлен возможный алкализирующий компонент по corrected HCO₃, без автоматического классического алкалоза. NORMAL-PH-MIXED-06–09: corrected HCO₃ + выраженный хлоридный эффект поддерживают компонент; прежний possible classic alkalosis заменён supported alkalinizing component. HYPOALBUMINEMIA-06–07: выраженный relative Cl / low-SID выявляется независимо от ветки p.met.

## 35 защищённых случаев

- Для 13 случаев с изолированным SBE conflict прежняя проверка `summary.includes("внутренне несогласованы") = true` заменена на false. Проверки кода предупреждения, сохранения SBE и его видимости остались.
- Для Na-volume в DYSNATREMIA-01–05 прежние числовые объёмы заменены ожиданием NaN. Все другие числовые gold и допуски сохранены.

## Граничные проверки компенсации

- Winter at PaCO₂ 32.9999 / 32.99: вывод «первичность не определена» заменён на «ниже ожид.»; диапазон 33–37, p.met/p.resp и числовые проверки сохранены.
- Δ/Δ 1.5001: possible alkalosis переименован в possible alkalinizing component. Δ/Δ 2: corrected HCO₃ + SBE_Cl поддерживают компонент; отдельный classic alkalosis не назначается. Δ/Δ >2 в согласованном хлоридном случае сохраняет classic alkalosis.
- SBE qualification: предупреждение остаётся; текст Δ/Δ больше не обязан включать QC-оговорку SBE.
- Четыре MA-HCO3-27/28 boundary-пробы above range: верхняя строка заменена на «Смешанное нарушение», диапазон и респираторный процесс прежние.
- Шесть прежних ambiguous respiratory boundary-сценариев: первичность не заменяет известный состав. Два ацидифицирующих сценария дополнительно получают Winter, сохранены прежние respiratory ranges.

## 1970 adversarial-проб: 4 явных поправки + 2 runtime sodium ожидания

| Probe | Старое ожидание | Новое ожидание | Основание |
|---|---|---|---|
| DD-class-1.51 | {"NAGMA": false, "alk": false, "possible": true} | {"NAGMA": false, "alk": false, "possible": true, "supportedComponent": false} | v31 rules 3–4: borderline ratio is a possible alkalinizing component, not classic metabolic alkalosis; AG/corrected HCO3 is one evidence line |
| DD-class-1.99 | {"NAGMA": false, "alk": false, "possible": true} | {"NAGMA": false, "alk": false, "possible": false, "supportedComponent": true} | v31 rule 4: high corrected HCO3 plus SBE_Cl supports an alkalinizing component; borderline ratio still does not prove classic alkalosis |
| DD-class-2 | {"NAGMA": false, "alk": false, "possible": true} | {"NAGMA": false, "alk": false, "possible": false, "supportedComponent": true} | v31 rule 4: high corrected HCO3 plus SBE_Cl supports an alkalinizing component; ratio 2 does not prove classic alkalosis |
| AG-composition-24-40 | {"supported": true, "unqualifiedIsolated": true} | {"supported": true, "unqualifiedIsolated": false} | v31 rules 1–4,8–9: normal final bicarbonate no longer removes a corroborated hidden metabolic alkalinizing component |

`HISTORY-solution-context` и `RELOAD-solutions`: runtime-derived expected.naVolume становится NaN по правилу P1; kVolume прежний. Старый expected записан в before каждого результата. Сами шесть исходных probe-скриптов и все числовые входы неизменны; runner проверяет их хеши. Existing 49 approved v30 ledgers продолжают применяться.

## Исторические ограничения области патча

Старые `final-core-before-after`, `respiratory-policy-integrity`, `metabolic-alkalosis-policy-integrity`, `math-freeze-300`, `final-core-scope`, `egfr-ui`, `cleanup-scope`, `harness-integrity` содержат привязку к прежним этапам патча, целиком прежней схеме composition или прежнему тексту отчёта. Все восемь сохранены и проходят на frozen v30.1. Полное совпадение v31 с их прежним клиническим текстом противоречит утверждённому ТЗ.

На v31 их действующая область проверяется `v31-freeze`: 1280 проверок, все прежние функции вне явного перечня synthesis/presentation сравниваются побайтно; legacy compensation сохранена; числовые поля b/st/bal сравниваются с frozen v30.1 на 300 случаях, кроме согласованного удаления naVolume; 300 независимых числовых оракулов, все шкалы/sepsis/рСКФ неизменны. `v31-ui` повторяет 188 независимых eGFR/UI проверок. `v31-harness` проверяет отказ при ошибке, подмене источника, устаревшем отчёте, провале baseline и искусственно повреждённой HH. Это явная замена ожидаемой области прежнего freeze, а не объявление всех старых snapshot-проверок успешными на v31.

Итоговые результаты: `reports/TEST_SUMMARY_v31.md`; исходный повторный прогон: `reports/v30.1-repeated-suite.json`; точные поправки: `tests/v31-approved-300-expectations.json` и `tests/v31-approved-adversarial-expectations.json`.

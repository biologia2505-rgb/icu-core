# ICU CORE v31.0-dev — проверка

Статус: **PASS**. Frozen v30.1: 21/21 исходных наборов прошли в изолированном повторном прогоне.

| Набор v31 | PASS | FAIL | REVIEW |
|---|---:|---:|---:|
| regression-35 | 35 | 0 | 0 |
| integration | 52 | 0 | 0 |
| missing-inputs | 25 | 0 | 0 |
| regression-300 | 300 | 0 | 0 |
| classification-boundaries | 36 | 0 | 0 |
| respiratory-range-boundaries | 91 | 0 | 0 |
| metabolic-alkalosis-boundaries | 44 | 0 | 0 |
| final-core-defects | 184 | 0 | 0 |
| final-core-scores | 466 | 0 | 0 |
| final-core-state | 208 | 0 | 0 |
| zero-review-cleanup | 166 | 0 | 0 |
| preset-state | 867 | 0 | 0 |
| final-adversarial-run | 1970 | 0 | 0 |
| v31-synthesis | 22 | 0 | 0 |
| v31-contributors | 17 | 0 | 0 |
| v31-freeze | 1280 | 0 | 0 |
| v31-ui | 188 | 0 | 0 |
| v31-harness | 6 | 0 | 0 |

300 клинических случаев включают 35 защищённых; это пересекающиеся наборы. 1970 проб adversarial, 22 целевые проверки A–H и ограничителей; отдельный v31-contributors проверяет непрерывность и независимость diagnostic confidence от бывших cutoffs. v31-freeze содержит 1280 проверок: неизменность функций, числовых векторов и шкал на 300 случаях. Независимые числовые оракулы также проверены на 300 случаях; единственное согласованное исключение — удалённый bal.naVolume.

Старые ожидания и изменения v31 перечислены в V31_EXPECTATION_CHANGES.md. Удаление неутверждённых implementation heuristics и точные новые expectations перечислены в V31_CONTRIBUTORS_CHANGES.md. Все исходные тесты, gold и исходник сохранены в reference/v30.1-frozen-package.zip. Исторические проверки полного совпадения схемы и текста отчёта выполняются на v30.1; для v31 их заменяют v31-freeze и v31-ui, поскольку схема композиции и текст намеренно изменены.

Снимки browser-F.jpg / browser-G.jpg относятся к исходной реализации v31 до удаления эвристик и не подтверждают текущее clinical synthesis. Сценарии A–H текущего исходника повторены отдельно; числовые функции Winter/QC/sodium защищены сравнением с исходной v31 и frozen v30.1.


SHA-256 приложения: `cbb5f6922291fe7bc6c3d96410dd9c3ff76ddce5b0fd8959f9b11306a40aa9f7`.

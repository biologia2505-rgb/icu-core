# ICU CORE v31.0-dev

Development branch based on the frozen v30.1 currently preserved on main.

The complete application code (HTML, CSS and JavaScript) is in `index.html`. Open it in a browser to run the app.

Four unapproved diagnostic cutoffs have been removed. Diagnostic processes and their confidence are separate from continuous physiological contributors. No replacement cutoffs were introduced. Δ/Δ >2 is a probable metabolic alkalinizing component, not classic alkalosis from ratio alone.

The app, formulas, Winter, QC, scores and sodium patch were verified: all 18 v31 suites and all 21 original v30.1 suites passed. The separate A–H repeat passed 22 checks; contributors passed 17 checks.

The `tests/` folder exposes the test source for review. The complete runnable project, including all historical fixtures, frozen archives and reports required by the test runner, is stored as `ICU_CORE_v31.0-dev_contributors.zip.part1` and `.part2` because of the transfer limit. Download both parts and join them:\n\n```sh\ncat ICU_CORE_v31.0-dev_contributors.zip.part1 ICU_CORE_v31.0-dev_contributors.zip.part2 > ICU_CORE_v31.0-dev_contributors.zip\n```\n\nZIP SHA-256: `341a92d4a484f37f4a08f5b1e960a4de0b03bf7629819e563c837586fde943b3`. Unzip it and run `node tests/run-all.mjs` from the extracted `icu-core-v31.0-dev` directory (Node.js and Python 3 required), or use `run-v31-tests.command` on the original Mac. The package manifest describes the verified package before GitHub publication.

Application SHA-256: `cbb5f6922291fe7bc6c3d96410dd9c3ff76ddce5b0fd8959f9b11306a40aa9f7`.

See `CHANGELOG_v31.md`, `V31_CONTRIBUTORS_CHANGES.md` and `V31_THRESHOLD_AUDIT.md` for the provenance and explicit expectation changes. Source v30.1 remains on main; v31 remains development, not frozen.

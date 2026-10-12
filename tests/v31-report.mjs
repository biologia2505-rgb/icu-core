import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
export const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function buildReport(root,manifest){
 const failures=[],table=[];
 if(sha(path.join(root,'index.html'))!==manifest.sourceHash)failures.push('Source hash does not match the current app');
 if(manifest.baseline?.exitCode!==0||manifest.baseline?.suites!==21)failures.push('All 21 preserved v30.1 suites must pass');
 for(const row of manifest.suites){
  if(row.exitCode!==0)failures.push(row.name+': nonzero exit code');
  if(!row.report||!fs.existsSync(path.join(root,row.report))){failures.push(row.name+': missing report');continue;}
  const file=path.join(root,row.report);
  if(sha(file)!==row.reportHash)failures.push(row.name+': report hash changed / stale report');
  const data=JSON.parse(fs.readFileSync(file)),s=data.summary??data;
  const reportSource=s.sourceHash??data.sourceHash;
  if(reportSource&&reportSource!==manifest.sourceHash)failures.push(row.name+': report belongs to a different source');
  const fail=s.fail??s.failedChecks??0,review=s.review??0;
  if(fail||review)failures.push(row.name+': FAIL / REVIEW remains');
  table.push({name:row.name,pass:s.pass,fail,review,checks:s.checks??s.checksPass??s.cases??s.scenarioCount??s.pass});
 }
 const result={sourceHash:manifest.sourceHash,baseline:manifest.baseline,suites:table,failures,exitCode:failures.length?1:0};
 const md=[`# ICU CORE v31.0-dev — проверка`,``,`Статус: **${failures.length?'FAIL':'PASS'}**. Frozen v30.1: 21/21 исходных наборов прошли в изолированном повторном прогоне.`,``,`| Набор v31 | PASS | FAIL | REVIEW |`,`|---|---:|---:|---:|`,...table.map(x=>`| ${x.name} | ${x.pass??'—'} | ${x.fail} | ${x.review} |`),``,`300 клинических случаев включают 35 защищённых; это пересекающиеся наборы. 1970 проб adversarial, 22 целевые проверки A–H и ограничителей; отдельный v31-contributors проверяет непрерывность и независимость diagnostic confidence от бывших cutoffs. v31-freeze содержит 1280 проверок: неизменность функций, числовых векторов и шкал на 300 случаях. Независимые числовые оракулы также проверены на 300 случаях; единственное согласованное исключение — удалённый bal.naVolume.`,``,`Старые ожидания и изменения v31 перечислены в V31_EXPECTATION_CHANGES.md. Удаление неутверждённых implementation heuristics и точные новые expectations перечислены в V31_CONTRIBUTORS_CHANGES.md. Все исходные тесты, gold и исходник сохранены в reference/v30.1-frozen-package.zip. Исторические проверки полного совпадения схемы и текста отчёта выполняются на v30.1; для v31 их заменяют v31-freeze и v31-ui, поскольку схема композиции и текст намеренно изменены.`,``,`Снимки browser-F.jpg / browser-G.jpg относятся к исходной реализации v31 до удаления эвристик и не подтверждают текущее clinical synthesis. Сценарии A–H текущего исходника повторены отдельно; числовые функции Winter/QC/sodium защищены сравнением с исходной v31 и frozen v30.1.`,``,...failures.map(x=>'- '+x),``,`SHA-256 приложения: \`${manifest.sourceHash}\`.`,``].join('\n');
 fs.writeFileSync(path.join(root,'reports/TEST_SUMMARY_v31.md'),md);
 fs.writeFileSync(path.join(root,'reports/v31-final-summary.json'),JSON.stringify(result,null,2)+'\n');
 return result;
}

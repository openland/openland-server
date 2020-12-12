import fs from 'fs';

const reportTemplate = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Report</title>
  <meta name="description" content="Report">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/normalize/8.0.1/normalize.min.css" integrity="sha512-NhSC1YmyruXifcj/KFRWoC561YpHpc5Jtzgvbuzx5VozKpWvQ+4nXhPdFgmx8xqexRcpAglTj9sIBWINXa8x5w==" crossorigin="anonymous" />
  <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
</head>
<body>
  \${BODY}
</body>
</html>`;

const reportItemTemplate = `
<h1>\${NAME}</h1>
<div id="plotly-chart-\${ID}" style="width:600px;height:250px;"></div>
<script>
	Plotly.newPlot(document.getElementById('plotly-chart-\${ID}'), [{
    mode: 'markers',
    type: 'scatter',
	  x: \${DATA_X},
    y: \${DATA_Y}
  }], { margin: { t: 0 } } );
</script>
`;

export function generateReport(path: string, data: { data: { x: number, y: number }[], name: string }[]) {

  let templates: string[] = [];
  for (let record of data) {
    let x = JSON.stringify(record.data.map((d) => d.x));
    let y = JSON.stringify(record.data.map((d) => d.y));
    templates.push(
      reportItemTemplate
        .replace('\${DATA_X}', x)
        .replace('\${DATA_Y}', y)
        .replace('\${NAME}', record.name)
        .replace('\${ID}', templates.length + '')
        .replace('\${ID}', templates.length + '')
    );
  }

  let report = reportTemplate
    .replace('${BODY}', templates.join('\n'));
  fs.writeFileSync(path, report, 'utf-8');
}
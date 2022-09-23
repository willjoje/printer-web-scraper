const cliProgress = require("cli-progress");
const converter = require("json-2-csv");
const { load } = require("cheerio");
const axios = require("axios");
const fs = require("fs");

const json = fs.readFileSync("./impressoras.json");
const listaImpressoras = JSON.parse(json);
const listaImprComTotal = [];
const barraDeProgresso = new cliProgress.SingleBar(
  { fps: 5, stopOnComplete: true },
  cliProgress.Presets.shades_classic
);

process.removeAllListeners("warning");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Desabilita a verificação de certificado

requisitar_paginas();

async function requisitar_paginas() {
  console.log(" Recolhendo dados das impressoras");
  const erros = [];
  barraDeProgresso.start(listaImpressoras.length, 0);
  for (const impressora of listaImpressoras) {
    barraDeProgresso.increment();
    try {
      const { data } = await axios.get(impressora.ip, { timeout: 4000 });
      const $ = load(data);
      processar_totais($, impressora);
    } catch (err) {
      erros.push(`Impressora "${impressora.nome}" desligada ou sem conexão`);
      preencher_planilha(impressora, null);
    }
  }
  console.log(erros);
  salvarPlanilha();
  setInterval(() => {}, 1 << 30);
}

function processar_totais(data, impressora) {
  if (impressora.colorida) {
    let totalMono = data(
      '[id="UsagePage.EquivalentImpressionsTable.Monochrome.Total"]'
    );
    let totalCor = data(
      '[id="UsagePage.EquivalentImpressionsTable.Color.Total"]'
    );
    totalMono = Math.ceil(totalMono.text().replace(",", ""));
    totalCor = Math.ceil(totalCor.text().replace(",", ""));

    const totais = [totalMono, totalCor];
    preencher_planilha(impressora, totais);
  }
  if (!impressora.colorida) {
    let total = data('[id="UsagePage.EquivalentImpressionsTable.Total.Total"]');
    total = Math.ceil(total.text().replace(",", ""));
    preencher_planilha(impressora, total);
  }
}

function preencher_planilha(impressora, total) {
  const dataHora = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/, "");
  if (impressora.colorida) {
    listaImprComTotal.push({
      "Nome": impressora.nome,
      "IP": impressora.ip.substring(0, 18),
      "Serial": impressora.serial,
      "Total Mono": total[0],
      "Total Cor": total[1],
      "Data": dataHora,
    });
  }

  if (!impressora.colorida) {
    listaImprComTotal.push({
      "Nome": impressora.nome,
      "IP": impressora.ip.substring(0, 18),
      "Serial": impressora.serial,
      "Total Mono": total,
      "Total Cor": "",
      "Data": dataHora,
    });
  }
}

function salvarPlanilha() {
  converter.json2csv(listaImprComTotal, (err, csv) => {
    if (err) {
      throw err;
    }
    let data = new Date();
    data =
      data.getDate() + "-" + (data.getMonth() + 1) + "-" + data.getFullYear();
    fs.writeFileSync(`Contagem_Impressoes_${data}.csv`, csv);
    console.log("\nPlanilha criada na pasta do executável");
  });
}

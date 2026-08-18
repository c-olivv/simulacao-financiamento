// URL do SheetMonkey configurada
const ENDPOINT_SHEETMONKEY = "https://api.sheetmonkey.io/form/v5HTKnEFHJkrhqmVCAhDi1";

// Converte taxa anual nominal/efetiva para taxa mensal equivalente
function converterTaxaAnualParaMensal(taxaAnualPercentual) {
    const taxaAnualDecimal = taxaAnualPercentual / 100;
    return Math.pow(1 + taxaAnualDecimal, 1 / 12) - 1;
}

// Formatação de valores para moeda brasileira (R$)
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Cálculo do SAC
function calcularSAC(valorFinanciado, taxaAnualPercentual, prazoMeses) {
    const i = converterTaxaAnualParaMensal(taxaAnualPercentual);
    const amortizacaoConstante = valorFinanciado / prazoMeses;
    
    let saldoDevedor = valorFinanciado;
    let totalJuros = 0;
    
    const primeiraParcelaBase = amortizacaoConstante + (saldoDevedor * i);
    const ultimaParcelaBase = amortizacaoConstante + (amortizacaoConstante * i);

    for (let mes = 1; mes <= prazoMeses; mes++) {
        const jurosMes = saldoDevedor * i;
        totalJuros += jurosMes;
        saldoDevedor -= amortizacaoConstante;
    }

    return {
        primeiraParcela: primeiraParcelaBase,
        ultimaParcela: ultimaParcelaBase,
        totalJuros: totalJuros,
        totalPago: valorFinanciado + totalJuros
    };
}

// Cálculo da Tabela Price
function calcularPrice(valorFinanciado, taxaAnualPercentual, prazoMeses) {
    const i = converterTaxaAnualParaMensal(taxaAnualPercentual);
    const fator = Math.pow(1 + i, prazoMeses);
    const parcelaFixa = valorFinanciado * ((i * fator) / (fator - 1));
    
    const totalPago = parcelaFixa * prazoMeses;
    const totalJuros = totalPago - valorFinanciado;

    return {
        primeiraParcela: parcelaFixa,
        ultimaParcela: parcelaFixa,
        totalJuros: totalJuros,
        totalPago: totalPago
    };
}

// Processa o formulário e envia os dados
function processarSimulacao(e) {
    e.preventDefault();

    // Leitura dos dados do formulário
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const telefone = document.getElementById('telefone').value;
    const renda = parseFloat(document.getElementById('renda').value) || 0;
    const valorImovel = parseFloat(document.getElementById('valorImovel').value) || 0;
    const valorEntrada = parseFloat(document.getElementById('valorEntrada').value) || 0;
    const prazoAnos = parseInt(document.getElementById('prazoAnos').value);
    const sistema = document.getElementById('sistema').value;
    const taxaAnual = parseFloat(document.getElementById('taxaAnual').value);

    const valorFinanciado = valorImovel - valorEntrada;
    const prazoMeses = prazoAnos * 12;

    if (valorFinanciado <= 0) {
        alert('O valor da entrada não pode ser igual ou maior que o valor do imóvel.');
        return;
    }

    // Estimativa de Seguros e Taxas (MIP + DFI + Taxa Adm)
    const encargoEstimado = (valorFinanciado * 0.00025) + (valorImovel * 0.00005) + 25.00;

    let resultado;
    if (sistema === 'SAC') {
        resultado = calcularSAC(valorFinanciado, taxaAnual, prazoMeses);
    } else {
        resultado = calcularPrice(valorFinanciado, taxaAnual, prazoMeses);
    }

    const primeiraParcelaTotal = resultado.primeiraParcela + encargoEstimado;
    const ultimaParcelaTotal = resultado.ultimaParcela + encargoEstimado;

    // --- ENVIO DOS DADOS PARA O SHEETMONKEY ---
    const dadosLead = {
        nome: nome,
        email: email,
        telefone: telefone,
        renda: renda,
        valorImovel: valorImovel,
        valorEntrada: valorEntrada,
        valorFinanciado: valorFinanciado,
        prazoAnos: prazoAnos,
        sistema: sistema,
        primeiraParcela: primeiraParcelaTotal.toFixed(2),
        ultimaParcela: ultimaParcelaTotal.toFixed(2),
        dataHora: new Date().toLocaleString('pt-BR')
    };

    fetch(ENDPOINT_SHEETMONKEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosLead)
    })
    .then(response => {
        if (response.ok) {
            console.log("Lead salvo com sucesso no SheetMonkey!");
        } else {
            console.error("Erro ao enviar dados para o SheetMonkey.");
        }
    })
    .catch(err => console.error("Erro de rede ao salvar lead:", err));

    // --- RENDERIZAÇÃO DOS RESULTADOS NA TELA ---
    const cardsContainer = document.getElementById('cardsContainer');
    cardsContainer.innerHTML = `
        <div class="card">
            <div class="card-label">Valor Financiado</div>
            <div class="card-value">${formatarMoeda(valorFinanciado)}</div>
        </div>
        <div class="card">
            <div class="card-label">Sistema / Prazo</div>
            <div class="card-value" style="font-size: 1rem; margin-top: 5px;">${sistema} (${prazoMeses} meses)</div>
        </div>
        <div class="card" style="border-left-color: #28a745;">
            <div class="card-label">1ª Parcela Estimada</div>
            <div class="card-value" style="color: #28a745;">${formatarMoeda(primeiraParcelaTotal)}</div>
        </div>
        <div class="card">
            <div class="card-label">${sistema === 'SAC' ? 'Última Parcela Estimada' : 'Parcela Fixa Estimada'}</div>
            <div class="card-value">${formatarMoeda(ultimaParcelaTotal)}</div>
        </div>
    `;

    // Prepara o link dinâmico do WhatsApp
    const mensagemWhatsApp = encodeURIComponent(
        `Olá! Me chamo ${nome}. Fiz uma simulação de financiamento no valor de ${formatarMoeda(valorImovel)} (financiando ${formatarMoeda(valorFinanciado)}) e gostaria de dar atendimento à minha análise de crédito.`
    );
    
    document.getElementById('linkWhatsapp').href = `https://wa.me/5524999999999?text=${mensagemWhatsApp}`;

    // Exibe o bloco de resultados
    document.getElementById('resultado').style.display = 'block';

    // Rola suavemente até os resultados
    document.getElementById('resultado').scrollIntoView({ behavior: 'smooth' });
}

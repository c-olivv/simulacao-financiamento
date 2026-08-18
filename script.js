// URL do SheetMonkey configurada
const ENDPOINT_SHEETMONKEY = "https://api.sheetmonkey.io/form/v5HTKnEFHJkrhqmVCAhDi1";

// Formatação de valores para moeda brasileira (R$)
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Cálculo do SAC (Parcelas Decrescentes)
function calcularSAC(valorFinanciado, taxaMensal, prazoMeses) {
    const amortizacaoConstante = valorFinanciado / prazoMeses;
    
    // 1ª parcela: Amortização + Juros sobre o saldo devedor inicial
    const primeiraParcelaBase = amortizacaoConstante + (valorFinanciado * taxaMensal);
    
    // Última parcela: Amortização + Juros sobre a última amortização
    const ultimaParcelaBase = amortizacaoConstante + (amortizacaoConstante * taxaMensal);

    return {
        primeiraParcela: primeiraParcelaBase,
        ultimaParcela: ultimaParcelaBase
    };
}

// Cálculo da Tabela Price (Parcelas Fixas)
function calcularPrice(valorFinanciado, taxaMensal, prazoMeses) {
    const fator = Math.pow(1 + taxaMensal, prazoMeses);
    const parcelaFixa = valorFinanciado * ((taxaMensal * fator) / (fator - 1));

    return {
        primeiraParcela: parcelaFixa,
        ultimaParcela: parcelaFixa
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

    // 1. Validação de Entrada Mínima (Normalmente 20% do imóvel)
    const entradaMinima = valorImovel * 0.20;
    if (valorEntrada < entradaMinima) {
        alert(`A entrada mínima exigida pelos bancos é de 20% (${formatarMoeda(entradaMinima)}). Por favor, ajuste o valor.`);
        return;
    }

    const valorFinanciado = valorImovel - valorEntrada;
    const prazoMeses = prazoAnos * 12;

    // 2. Taxa Mensal Nominal (Regra de mercado para financiamento imobiliário)
    const taxaMensal = (taxaAnual / 100) / 12;

    // 3. Encargos acessórios estimados (Seguros MIP/DFI + Taxa de Administração)
    const encargoEstimado = (valorFinanciado * 0.00025) + (valorImovel * 0.00005) + 25.00;

    let resultado;
    if (sistema === 'SAC') {
        resultado = calcularSAC(valorFinanciado, taxaMensal, prazoMeses);
    } else {
        resultado = calcularPrice(valorFinanciado, taxaMensal, prazoMeses);
    }

    const primeiraParcelaTotal = resultado.primeiraParcela + encargoEstimado;
    const ultimaParcelaTotal = resultado.ultimaParcela + encargoEstimado;

    // 4. Verificação de Comprometimento de Renda (Máximo de 30%)
    const limiteRenda = renda * 0.30;
    const excedeRenda = primeiraParcelaTotal > limiteRenda;

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
        comprometeuRenda: excedeRenda ? "SIM" : "NÃO",
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
        <div class="card" style="border-left-color: ${excedeRenda ? '#dc3545' : '#28a745'};">
            <div class="card-label">1ª Parcela Estimada</div>
            <div class="card-value" style="color: ${excedeRenda ? '#dc3545' : '#28a745'};">${formatarMoeda(primeiraParcelaTotal)}</div>
        </div>
        <div class="card">
            <div class="card-label">${sistema === 'SAC' ? 'Última Parcela Estimada' : 'Parcela Fixa Estimada'}</div>
            <div class="card-value">${formatarMoeda(ultimaParcelaTotal)}</div>
        </div>
    `;

    // Exibe aviso se ultrapassar 30% da renda informada
    if (excedeRenda) {
        cardsContainer.innerHTML += `
            <div style="grid-column: 1 / -1; background-color: #fff3cd; color: #856404; padding: 10px 15px; border-radius: 4px; font-size: 0.9rem; margin-top: 10px;">
                ⚠️ <strong>Atenção:</strong> A 1ª parcela excede 30% da sua renda informada (${formatarMoeda(limiteRenda)}). Fale com nosso consultor para avaliar composições de renda ou aumentar o prazo.
            </div>
        `;
    }

    // Prepara o link dinâmico do WhatsApp
    const mensagemWhatsApp = encodeURIComponent(
        `Olá! Me chamo ${nome}. Fiz uma simulação para um imóvel de ${formatarMoeda(valorImovel)} (entrada de ${formatarMoeda(valorEntrada)} e 1ª parcela de ${formatarMoeda(primeiraParcelaTotal)}). Gostaria de analisar meu crédito!`
    );
    
    document.getElementById('linkWhatsapp').href = `https://wa.me/5524988114415?text=${mensagemWhatsApp}`;

    // Exibe o bloco de resultados e rola a tela
    document.getElementById('resultado').style.display = 'block';
    document.getElementById('resultado').scrollIntoView({ behavior: 'smooth' });
}

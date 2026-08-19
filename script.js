// Endpoint do SheetMonkey
const ENDPOINT_SHEETMONKEY = "https://api.sheetmonkey.io/form/v5HTKnEFHJkrhqmVCAhDi1";

// ==========================================
// FUNÇÕES AUXILIARES DE FORMATAÇÃO E MÁSCARAS
// ==========================================

// Formata números float para visualização em Moeda BRL (ex: 300000 -> "R$ 300.000,00")
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Converte string formatada em R$ para float puro (ex: "R$ 300.000,00" -> 300000)
function converterMoedaParaFloat(texto) {
    if (!texto) return 0;
    const apenasNumeros = texto.replace(/\D/g, '');
    return parseFloat(apenasNumeros) / 100 || 0;
}

// Máscara de entrada para campos de moeda em tempo real
function aplicarMascaraMoeda(input) {
    let valor = input.value.replace(/\D/g, '');
    if (valor === '') {
        input.value = '';
        return;
    }
    const valorFloat = parseFloat(valor) / 100;
    input.value = valorFloat.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// Máscara de entrada para telefone em tempo real: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
function aplicarMascaraTelefone(input) {
    let valor = input.value.replace(/\D/g, '');
    if (valor.length > 11) valor = valor.slice(0, 11);

    if (valor.length > 10) {
        // Celular com 9 dígitos
        input.value = valor.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (valor.length > 6) {
        // Telefone fixo ou digitando celular
        input.value = valor.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    } else if (valor.length > 2) {
        input.value = valor.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
    } else {
        input.value = valor;
    }
}

// ==========================================
// CÁLCULOS FINANCEIROS
// ==========================================

// Cálculo do SAC (Parcelas Decrescentes)
function calcularSAC(valorFinanciado, taxaMensal, prazoMeses) {
    const amortizacaoConstante = valorFinanciado / prazoMeses;
    const primeiraParcelaBase = amortizacaoConstante + (valorFinanciado * taxaMensal);
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

// ==========================================
// PROCESSAMENTO DO FORMULÁRIO
// ==========================================

async function processarSimulacao(e) {
    e.preventDefault();

    // Leitura dos dados do formulário
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const telefone = document.getElementById('telefone').value;
    
    // Converte os campos formatados em moeda para float puro
    const renda = converterMoedaParaFloat(document.getElementById('renda').value);
    const valorImovel = converterMoedaParaFloat(document.getElementById('valorImovel').value);
    const valorEntrada = converterMoedaParaFloat(document.getElementById('valorEntrada').value);
    
    const prazoAnos = parseInt(document.getElementById('prazoAnos').value, 10);
    const sistema = document.getElementById('sistema').value;
    const taxaAnual = parseFloat(document.getElementById('taxaAnual').value);

    // Validação da Entrada Mínima (20% do valor do imóvel)
    const entradaMinima = valorImovel * 0.20;
    const entradaAbaixoDoMinimo = valorEntrada < entradaMinima;

    let valorFinanciado = valorImovel - valorEntrada;
    if (valorFinanciado <= 0) valorFinanciado = 0;

    const prazoMeses = prazoAnos * 12;
    const taxaMensal = (taxaAnual / 100) / 12;

    // Encargos acessórios estimados (Seguros MIP/DFI + Taxa de Administração)
    const encargoEstimado = (valorFinanciado * 0.00025) + (valorImovel * 0.00005) + 25.00;

    let resultado;
    if (sistema === 'SAC') {
        resultado = calcularSAC(valorFinanciado, taxaMensal, prazoMeses);
    } else {
        resultado = calcularPrice(valorFinanciado, taxaMensal, prazoMeses);
    }

    const primeiraParcelaTotal = resultado.primeiraParcela + encargoEstimado;
    const ultimaParcelaTotal = resultado.ultimaParcela + encargoEstimado;

    // Verificação de Comprometimento de Renda (Máximo de 30%)
    const limiteRenda = renda * 0.30;
    const excedeRenda = primeiraParcelaTotal > limiteRenda;

    // Renderização dos Resultados na Tela
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

    // Aviso de entrada abaixo de 20%
    if (entradaAbaixoDoMinimo) {
        cardsContainer.innerHTML += `
            <div style="grid-column: 1 / -1; background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 12px 15px; border-radius: 6px; font-size: 0.9rem; margin-top: 10px;">
                ⚠️ <strong>Atenção:</strong> A entrada informada (${formatarMoeda(valorEntrada)}) é menor que os 20% recomendados pelas regras bancárias (${formatarMoeda(entradaMinima)}). Fale com nosso consultor no WhatsApp para analisar opções de subsídio, uso do FGTS ou composição de entrada.
            </div>
        `;
    }

    // Aviso de comprometimento de renda
    if (excedeRenda) {
        cardsContainer.innerHTML += `
            <div style="grid-column: 1 / -1; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; padding: 12px 15px; border-radius: 6px; font-size: 0.9rem; margin-top: 10px;">
                ⚠️ <strong>Atenção:</strong> A 1ª parcela excede 30% da renda informada (${formatarMoeda(limiteRenda)}). Fale com nosso consultor no WhatsApp para analisar possibilidades de composição de renda.
            </div>
        `;
    }

    // Prepara o link dinâmico do WhatsApp
    const mensagemWhatsApp = encodeURIComponent(
        `Olá! Me chamo ${nome}. Fiz uma simulação de financiamento no valor de ${formatarMoeda(valorImovel)} e gostaria de tirar dúvidas sobre minha análise de crédito.`
    );
    document.getElementById('linkWhatsapp').href = `https://wa.me/5524988114415?text=${mensagemWhatsApp}`;

    // Exibe o bloco de resultados e rola a página
    document.getElementById('resultado').style.display = 'block';
    document.getElementById('resultado').scrollIntoView({ behavior: 'smooth' });

    // Envio dos Dados para o SheetMonkey
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
        entradaAbaixoDoMinimo: entradaAbaixoDoMinimo ? "SIM" : "NÃO",
        comprometeuRenda: excedeRenda ? "SIM" : "NÃO",
        dataHora: new Date().toLocaleString('pt-BR')
    };

    try {
        const response = await fetch(ENDPOINT_SHEETMONKEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosLead)
        });

        if (response.ok) {
            console.log("Lead salvo com sucesso no SheetMonkey!");
        } else {
            console.error("Erro ao enviar dados para o SheetMonkey. Status:", response.status);
        }
    } catch (err) {
        console.error("Erro de rede ao salvar lead:", err);
    }
}

// ==========================================
// VINCULAÇÃO DOS EVENTOS (DOM LOADED)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Vincula a máscara nos campos de moeda
    const camposMoeda = ['renda', 'valorImovel', 'valorEntrada'];
    camposMoeda.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // Garante tipo text para aceitar os caracteres R$ e vírgulas sem conflito de HTML5
            input.type = 'text';
            input.addEventListener('input', (e) => aplicarMascaraMoeda(e.target));
        }
    });

    // Vincula a máscara no campo de telefone
    const inputTelefone = document.getElementById('telefone');
    if (inputTelefone) {
        inputTelefone.addEventListener('input', (e) => aplicarMascaraTelefone(e.target));
    }
});

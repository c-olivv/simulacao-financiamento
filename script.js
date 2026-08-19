// URL do SheetMonkey configurada
const ENDPOINT_SHEETMONKEY = "https://api.sheetmonkey.io/form/v5HTKnEFHJkrhqmVCAhDi1";

// --- MÁSCARAS EM TEMPO REAL ---

// Máscara de Telefone/WhatsApp: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
function aplicarMascaraTelefone(e) {
    let valor = e.target.value.replace(/\D/g, "");
    if (valor.length > 11) valor = valor.slice(0, 11);

    if (valor.length > 10) {
        valor = valor.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    } else if (valor.length > 6) {
        valor = valor.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3");
    } else if (valor.length > 2) {
        valor = valor.replace(/^(\d{2})(\d{0,5})$/, "($1) $2");
    } else if (valor.length > 0) {
        valor = valor.replace(/^(\d*)$/, "($1");
    }
    e.target.value = valor;
}

// Máscara Moeda (Digitação a partir dos centavos)
function aplicarMascaraMoeda(e) {
    let valor = e.target.value.replace(/\D/g, "");
    if (!valor) {
        e.target.value = "";
        return;
    }
    // Converte os dígitos acumulados em número decimal (ex: 12345 -> 123.45)
    const numero = (parseFloat(valor) / 100).toFixed(2);
    
    // Formata no padrão R$ X.XXX,XX
    e.target.value = parseFloat(numero).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// Converte a string "R$ 300.000,00" para número float puro (300000.00)
function converterMoedaParaNumero(textoMoeda) {
    if (!textoMoeda) return 0;
    const apenasNumeros = textoMoeda.replace(/\D/g, "");
    return apenasNumeros ? parseFloat(apenasNumeros) / 100 : 0;
}

// Formatação padrão de exibição em tela
function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Vincula os eventos de máscara aos inputs após carregar a página
document.addEventListener("DOMContentLoaded", () => {
    // Escuta evento no campo de telefone
    document.getElementById("telefone").addEventListener("input", aplicarMascaraTelefone);

    // Escuta eventos nos campos financeiros
    const camposFinanceiros = ["renda", "valorImovel", "valorEntrada"];
    camposFinanceiros.forEach(id => {
        document.getElementById(id).addEventListener("input", aplicarMascaraMoeda);
    });
});

// --- LÓGICA DE CÁLCULO FINANCEIRO ---

function calcularSAC(valorFinanciado, taxaMensal, prazoMeses) {
    const amortizacaoConstante = valorFinanciado / prazoMeses;
    const primeiraParcelaBase = amortizacaoConstante + (valorFinanciado * taxaMensal);
    const ultimaParcelaBase = amortizacaoConstante + (amortizacaoConstante * taxaMensal);

    return {
        primeiraParcela: primeiraParcelaBase,
        ultimaParcela: ultimaParcelaBase
    };
}

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

    // Leitura e conversão dos dados do formulário
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const telefone = document.getElementById('telefone').value;
    
    // Leitura convertida dos campos formatados em R$
    const renda = converterMoedaParaNumero(document.getElementById('renda').value);
    const valorImovel = converterMoedaParaNumero(document.getElementById('valorImovel').value);
    const valorEntrada = converterMoedaParaNumero(document.getElementById('valorEntrada').value);
    
    const prazoAnos = parseInt(document.getElementById('prazoAnos').value);
    const sistema = document.getElementById('sistema').value;
    const taxaAnual = parseFloat(document.getElementById('taxaAnual').value);

    // Validação de Entrada Mínima (20%)
    const entradaMinima = valorImovel * 0.20;
    const entradaAbaixoDoMinimo = valorEntrada < entradaMinima;

    let valorFinanciado = valorImovel - valorEntrada;
    if (valorFinanciado <= 0) valorFinanciado = 0;

    const prazoMeses = prazoAnos * 12;
    const taxaMensal = (taxaAnual / 100) / 12;

    // Encargos acessórios estimados
    const encargoEstimado = (valorFinanciado * 0.00025) + (valorImovel * 0.00005) + 25.00;

    let resultado;
    if (sistema === 'SAC') {
        resultado = calcularSAC(valorFinanciado, taxaMensal, prazoMeses);
    } else {
        resultado = calcularPrice(valorFinanciado, taxaMensal, prazoMeses);
    }

    const primeiraParcelaTotal = resultado.primeiraParcela + encargoEstimado;
    const ultimaParcelaTotal = resultado.ultimaParcela + encargoEstimado;

    // Comprometimento de Renda (30%)
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
        entradaAbaixoDoMinimo: entradaAbaixoDoMinimo ? "SIM" : "NÃO",
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

    // Exibe avisos se necessário
    if (entradaAbaixoDoMinimo) {
        cardsContainer.innerHTML += `
            <div style="grid-column: 1 / -1; background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 12px 15px; border-radius: 6px; font-size: 0.9rem; margin-top: 10px;">
                ⚠️ <strong>Atenção:</strong> A entrada informada (${formatarMoeda(valorEntrada)}) é menor que os 20% recomendados pelas regras bancárias (${formatarMoeda(entradaMinima)}). Fale com nosso consultor no WhatsApp para analisar opções de subsídio, uso do FGTS ou composição de entrada.
            </div>
        `;
    }

    if (excedeRenda) {
        cardsContainer.innerHTML += `
            <div style="grid-column: 1 / -1; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; padding: 12px 15px; border-radius: 6px; font-size: 0.9rem; margin-top: 10px;">
                ⚠️ <strong>Atenção:</strong> A 1ª parcela excede 30% da renda informada (${formatarMoeda(limiteRenda)}). Podemos ajudar você a compor renda com mais familiares no atendimento.
            </div>
        `;
    }

    // Prepara o link dinâmico do WhatsApp
    const mensagemWhatsApp = encodeURIComponent(
        `Olá! Me chamo ${nome}. Fiz uma simulação de financiamento no valor de ${formatarMoeda(valorImovel)} e gostaria de tirar dúvidas sobre minha análise de crédito.`
    );
    
    document.getElementById('linkWhatsapp').href = `https://wa.me/5524988114415?text=${mensagemWhatsApp}`;

    // Exibe o bloco de resultados e rola a tela
    document.getElementById('resultado').style.display = 'block';
    document.getElementById('resultado').scrollIntoView({ behavior: 'smooth' });
}

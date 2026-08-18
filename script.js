// ==========================================
// CLASSE DE CÁLCULO (FINANCIAMENTO SAC/PRICE)
// ==========================================
class Financiar {
    constructor(vP, i, n) {
        this.vP = vP;                 // Valor Financiado
        this.i = i;                   // Taxa de Juros ao mês (%)
        this.n = n;                   // Prazo em meses
        this.pmt = [];                // Array com as prestações
        this.a = 0;                   // Amortização
        this.totalJuros = 0;          // Total de juros
        this.totalPago = 0;           // Total pago ao final
        this.listaSacText = "";       // Lista de parcelas em texto
        this.listaSacHTML = "";       // Lista de parcelas em HTML
    }

    // Trata valores vindos formatados como moeda (ex: "200.000,00")
    tratarMascaraReal() {
        if (typeof this.vP === 'string') {
            this.vP = this.vP.replace(/\./g, "").replace(",", ".");
        }
        if (typeof this.i === 'string') {
            this.i = this.i.replace(/\./g, "").replace(",", ".");
        }
    }

    // Converte tipos para cálculos matemáticos
    formataDados() {
        this.vP = parseFloat(this.vP);
        this.i = parseFloat(this.i) / 100; // Converte porcentagem para decimal
        this.n = parseInt(this.n);
    }

    // Formata o número para padrão R$
    formataMascara(label, valor) {
        let formato = { minimumFractionDigits: 2, style: 'currency', currency: label };
        return valor.toLocaleString('pt-BR', formato);
    }

    calculaAmortizacao() {
        this.a = this.vP / this.n;
        return this.a;
    }

    // Cálculo pela Tabela PRICE
    financiarPrice() {
        let prestacao = this.vP * (Math.pow((1 + this.i), this.n) * this.i) / (Math.pow((1 + this.i), this.n) - 1);
        this.pmt = [prestacao];
        return this.formataMascara('BRL', this.pmt[0]);
    }

    // Cálculo pela Tabela SAC
    financiarSac() {
        this.calculaAmortizacao();
        this.pmt = [];
        this.listaSacText = "";
        this.listaSacHTML = "";

        for (let y = 0; y < this.n; y++) {
            let prestacao = this.a + this.i * (this.vP - (y * this.a));
            this.pmt.push(prestacao);
            this.listaSacText += (y + 1) + "ª prestação: " + this.formataMascara('BRL', prestacao) + "\n\r";
            this.listaSacHTML += (y + 1) + "ª prestação: " + this.formataMascara('BRL', prestacao) + "<br>";
        }
    }

    calculaTotalPagoPrice() {
        this.totalPago = this.pmt[0] * this.n;
        return this.formataMascara('BRL', this.totalPago);
    }

    calculaTotalJurosPrice() {
        if (this.totalPago === 0) this.calculaTotalPagoPrice();
        this.totalJuros = this.totalPago - this.vP;
        return this.formataMascara('BRL', this.totalJuros);
    }

    calculaTotalPagoSac() {
        this.totalPago = 0;
        for (let p = 0; p < this.n; p++) {
            this.totalPago += this.pmt[p];
        }
        return this.formataMascara('BRL', this.totalPago);
    }

    calculaTotalJurosSac() {
        if (this.totalPago === 0) this.calculaTotalPagoSac();
        this.totalJuros = this.totalPago - this.vP;
        return this.formataMascara('BRL', this.totalJuros);
    }
}

// ==========================================
// CONFIGURAÇÃO E INTEGRAÇÃO DO SIMULADOR
// ==========================================

const ENDPOINT_SHEETMONKEY = 'https://api.sheetmonkey.io/form/SEU_ENDPOINT_AQUI';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formSimulador');
    if (form) {
        form.addEventListener('submit', processarSimulacao);
    }
});

// Helper para converter entradas com ponto/vírgula em número seguro
function parseValorSeguro(valor) {
    if (!valor) return 0;
    return parseFloat(valor.toString().replace(/\./g, "").replace(",", ".")) || 0;
}

async function processarSimulacao(e) {
    e.preventDefault();

    // 1. Leitura dos inputs
    const valorImovel = parseValorSeguro(document.getElementById('valorImovel').value);
    const entradaInformada = parseValorSeguro(document.getElementById('valorEntrada').value);
    const rendaMensal = parseValorSeguro(document.getElementById('rendaMensal').value);
    const taxaAnual = parseValorSeguro(document.getElementById('taxaAnual').value);
    const prazoAnos = parseInt(document.getElementById('prazoAnos').value) || 0;

    const prazoMeses = prazoAnos * 12;
    const taxaMensal = taxaAnual / 12; // Em porcentagem ao mês
    const i = taxaMensal / 100;        // Em decimal ao mês

    // 2. Cálculo do limite da parcela (30% da renda)
    const parcelaMaxima = rendaMensal * 0.30;

    // 3. Cálculo do valor financiado máximo permitido no SAC
    // No SAC: Parcela_1 = (vP / n) + (vP * i) = vP * (1/n + i)
    // Logo: vP_Max = Parcela_1_Max / (1/n + i)
    const fatorSac = (1 / prazoMeses) + i;
    const valorFinanciadoMaximo = parcelaMaxima / fatorSac;

    // Entrada necessária para cobrir a limitação da renda
    let entradaCalculada = valorImovel - valorFinanciadoMaximo;

    // Se a entrada calculada for menor que a informada, usa a informada pelo usuário
    let entradaFinal = Math.max(entradaCalculada, entradaInformada);

    // Garante que a entrada não supere o valor total do imóvel
    if (entradaFinal > valorImovel) {
        entradaFinal = valorImovel;
    }

    const valorFinanciadoFinal = valorImovel - entradaFinal;

    // 4. Executa a classe de cálculo com o valor financiado ajustado
    const simulacao = new Financiar(valorFinanciadoFinal, taxaMensal, prazoMeses);
    simulacao.formataDados();
    simulacao.financiarSac();

    const entradaFormatada = simulacao.formataMascara('BRL', entradaFinal);
    const primeiraParcela = simulacao.formataMascara('BRL', simulacao.pmt[0]);
    const ultimaParcela = simulacao.formataMascara('BRL', simulacao.pmt[simulacao.pmt.length - 1]);
    const totalPago = simulacao.calculaTotalPagoSac();
    const totalJuros = simulacao.calculaTotalJurosSac();

    // 5. Monta o objeto de Lead para o SheetMonkey
    const dadosLead = {
        Nome: document.getElementById('nome').value,
        Email: document.getElementById('email').value,
        Telefone: document.getElementById('telefone').value,
        ValorImovel: simulacao.formataMascara('BRL', valorImovel),
        RendaMensal: simulacao.formataMascara('BRL', rendaMensal),
        EntradaCalculada: entradaFormatada,
        ValorFinanciado: simulacao.formataMascara('BRL', simulacao.vP),
        PrazoAnos: prazoAnos,
        PrimeiraParcela: primeiraParcela,
        UltimaParcela: ultimaParcela,
        TotalPago: totalPago,
        TotalJuros: totalJuros,
        DataEnvio: new Date().toLocaleString('pt-BR')
    };

    // 6. Envio para o SheetMonkey
    try {
        await fetch(ENDPOINT_SHEETMONKEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosLead)
        });
    } catch (error) {
        console.error('Erro ao enviar para o SheetMonkey:', error);
    }

    // 7. Exibição dos resultados na tela
    const elEntrada = document.getElementById('resEntrada');
    const elPrimeira = document.getElementById('resPrimeiraParcela');
    const elUltima = document.getElementById('resUltimaParcela');
    const elTotalPago = document.getElementById('resTotalPago');
    const elTotalJuros = document.getElementById('resTotalJuros');

    if (elEntrada) elEntrada.innerText = entradaFormatada;
    if (elPrimeira) elPrimeira.innerText = primeiraParcela;
    if (elUltima) elUltima.innerText = ultimaParcela;
    if (elTotalPago) elTotalPago.innerText = totalPago;
    if (elTotalJuros) elTotalJuros.innerText = totalJuros;
}

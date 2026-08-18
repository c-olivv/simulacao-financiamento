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

// Cole o seu Endpoint do SheetMonkey aqui
const ENDPOINT_SHEETMONKEY = 'https://api.sheetmonkey.io/form/v5HTKnEFHJkrhqmVCAhDi1';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('formSimulador');
    if (form) {
        form.addEventListener('submit', processarSimulacao);
    }
});

async function processarSimulacao(e) {
    e.preventDefault();

    // 1. Leitura dos inputs do formulário
    const valorImovel = document.getElementById('valorImovel').value;
    const valorEntrada = document.getElementById('valorEntrada').value || "0";
    const taxaAnual = document.getElementById('taxaAnual').value;
    const prazoAnos = document.getElementById('prazoAnos').value;

    // Converte entrada para cálculo do valor financiado real
    const vImovelNum = parseFloat(valorImovel.toString().replace(/\./g, "").replace(",", ".")) || 0;
    const vEntradaNum = parseFloat(valorEntrada.toString().replace(/\./g, "").replace(",", ".")) || 0;
    const valorFinanciado = vImovelNum - vEntradaNum;

    // Converte prazos e taxas (Anual para Mensal)
    const prazoMeses = parseInt(prazoAnos) * 12;
    const taxaMensal = parseFloat(taxaAnual.toString().replace(",", ".")) / 12;

    // 2. Executa a classe de cálculo (SAC por padrão)
    const simulacao = new Financiar(valorFinanciado, taxaMensal, prazoMeses);
    simulacao.formataDados();
    simulacao.financiarSac();

    const primeiraParcela = simulacao.formataMascara('BRL', simulacao.pmt[0]);
    const ultimaParcela = simulacao.formataMascara('BRL', simulacao.pmt[simulacao.pmt.length - 1]);
    const totalPago = simulacao.calculaTotalPagoSac();
    const totalJuros = simulacao.calculaTotalJurosSac();

    // 3. Monta o objeto de Lead para o SheetMonkey
    const dadosLead = {
        Nome: document.getElementById('nome').value,
        Email: document.getElementById('email').value,
        Telefone: document.getElementById('telefone').value,
        ValorImovel: valorImovel,
        ValorEntrada: valorEntrada,
        ValorFinanciado: simulacao.formataMascara('BRL', simulacao.vP),
        PrazoAnos: prazoAnos,
        PrimeiraParcela: primeiraParcela,
        UltimaParcela: ultimaParcela,
        TotalPago: totalPago,
        TotalJuros: totalJuros,
        DataEnvio: new Date().toLocaleString('pt-BR')
    };

    // 4. Envio para o SheetMonkey
    try {
        await fetch(ENDPOINT_SHEETMONKEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosLead)
        });
    } catch (error) {
        console.error('Erro ao enviar para o SheetMonkey:', error);
    }

    // 5. Exibição dos resultados na tela
    const elPrimeira = document.getElementById('resPrimeiraParcela');
    const elUltima = document.getElementById('resUltimaParcela');
    const elTotalPago = document.getElementById('resTotalPago');
    const elTotalJuros = document.getElementById('resTotalJuros');

    if (elPrimeira) elPrimeira.innerText = primeiraParcela;
    if (elUltima) elUltima.innerText = ultimaParcela;
    if (elTotalPago) elTotalPago.innerText = totalPago;
    if (elTotalJuros) elTotalJuros.innerText = totalJuros;
}

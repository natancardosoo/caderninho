<p align="center"><img src="public/app-icon-192.png" width="96" alt="" /></p>

# Caderninho

O velho caderninho de contas, em versão app: finanças pessoais para uma pessoa só, rodando no seu próprio computador. Seus dados ficam num arquivo local (`data/state.json`): não tem conta, nuvem nem servidor de terceiros.

## O que ele faz

- **Visão geral do mês:** renda, contas da casa, contas pessoais, faturas e quanto sobra.
- **Fluxo de caixa:** tudo que entra e sai, dia a dia, com marcação de pago/recebido.
- **Cartões:** compras parceladas, assinaturas e a fatura de cada mês (com fechamento e vencimento).
- **Contas fixas:** aluguel, luz, internet etc., com valor estimado e ajuste mês a mês.
- **Quem paga?:** divida contas, compras e Pix com outras pessoas. O app calcula o que cada uma te deve, mês a mês ou como saldo sem prazo (ex.: um empréstimo ou uma obra). Cada fatura mostra quanto cada pessoa deve nela, com um resumo pronto para mandar.
- **Reserva, renda e financiamento da casa.**
- **Bancos conectados (opcional):** importação automática via Open Finance com a [Pluggy](https://pluggy.ai) (Meu Pluggy), com uma fila para você revisar o que chegou.

Funciona no navegador e pode ser instalado como app (PWA) no celular.

## Como rodar

Precisa do [Node.js](https://nodejs.org) 20.12 ou mais novo (recomendado 22+).

```bash
git clone https://github.com/natancardosoo/caderninho.git
cd caderninho
npm install
npm run build
npm start
```

Abra http://127.0.0.1:4320. Na primeira vez o app abre com **dados de exemplo** para você explorar; em **Minha renda** há a opção de apagar o exemplo e começar do zero.

Para desenvolver com recarregamento automático, deixe `npm start` rodando e, em outro terminal, rode `npm run dev` (o Vite repassa `/api` para o servidor).

### Acessar pelo celular

O servidor só escuta em `127.0.0.1` de propósito, porque **não tem login**: quem acessa a porta vê seus dados. Para usar no celular, exponha a porta só para os seus aparelhos, por exemplo com o [Tailscale](https://tailscale.com):

```bash
tailscale serve --bg --https=10000 http://127.0.0.1:4320
```

Não exponha o app na internet aberta.

### Iniciar com o Windows

`start-hidden.vbs` inicia o servidor sem abrir janela. Crie um atalho dele na pasta que abre com `Win + R` → `shell:startup`.

## Conectar bancos (opcional)

1. Crie uma conta em [dashboard.pluggy.ai](https://dashboard.pluggy.ai) e uma aplicação para pegar o **Client ID** e o **Client Secret**.
2. Copie `.env.example` para `.env` e preencha as duas credenciais.
3. No app, vá em **Bancos conectados → Conectar banco**, escolha **Meu Pluggy** e autorize cada banco (uma conexão por banco).
4. Toque em **Sincronizar agora**. A partir daí o app sincroniza sozinho todo dia no horário de `PLUGGY_SYNC_HOUR` (padrão 18h).

O que chega dos bancos cai em **Para revisar**: confira a categoria e quem paga antes de confirmar. Compras parceladas, pagamentos de fatura, contas fixas e reembolsos são reconhecidos automaticamente quando possível.

## Seus dados

Tudo fica na pasta `data/` (ignorada pelo git):

- `state.json`: seus lançamentos. O servidor guarda a versão anterior em `state.json.bak` a cada gravação.
- `pluggy.json`: as conexões com os bancos e o controle do que já foi importado.

Para fazer backup, copie a pasta `data/`. Nunca publique `data/` nem `.env`.

## Licença

[MIT](LICENSE). Os ícones 3D em `public/icons` são do [Fluent Emoji](https://github.com/microsoft/fluentui-emoji), da Microsoft (MIT).

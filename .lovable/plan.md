# Publicar o Vortis nas lojas Play Store e App Store

Transformar o Vortis Gestão (atualmente um app web/PWA) em um app nativo empacotado, pronto para submissão na Google Play Store e Apple App Store, sem reescrever a lógica do sistema.

## Estratégia escolhida

Usar o **Capacitor** para envolver o app web React existente. Essa abordagem mantém todo o código atual (telas, regras, backend) e gera projetos nativos Android e iOS que podem ser publicados nas lojas.

- **Mais rápido e econômico** do que reescrever apps nativos.
- **Permite recursos nativos** caso sejam necessários depois: câmera do celular para leitura de código de barras, notificações push, impressora Bluetooth etc.
- **Mesma base de código**: atualizações futuras do Vortis chegam às lojas apenas reconstruindo e reenviando.

## O que será feito

1. **Adicionar o Capacitor ao projeto**
   - Instalar `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` e `@capacitor/ios`.
   - Inicializar a configuração com `npx cap init`.
   - Definir `appId` e `appName` compatíveis com as lojas.

2. **Configurar o Capacitor para o Vortis**
   - Criar `capacitor.config.json` (ou `.ts`) apontando para a URL de produção.
   - Ajustar `webDir` para a pasta de build do Vite (`dist`).
   - Habilitar hot-reload interno para testes no sandbox quando necessário.

3. **Adaptar o app para mobile**
   - Ajustar a área segura de notch/status bar em telas iOS/Android (safe areas).
   - Garantir que toques e rolagens funcionem bem em telas pequenas.
   - Revisar inputs para abrir teclado numérico onde faz sentido (preço, quantidade).

4. **Gerar ícones e telas de abertura (splash) para as lojas**
   - Criar ícone em todas as resoluções exigidas por Android e iOS a partir do símbolo azul do Vortis.
   - Criar splash screen nas resoluções de iPhone e Android.
   - Remover o fundo branco e manter o fundo escuro (#0f172a) para consistência com o tema.

5. **Adicionar as plataformas Android e iOS**
   - `npx cap add android`
   - `npx cap add ios`
   - Sincronizar recursos nativos (`npx cap sync`).

6. **Ajustes nativos mínimos**
   - Configurar permissões básicas de internet/câmera se forem usar leitura de código de barras.
   - Garantir que a navegação interna do React Router funcione sem abrir navegador externo.

7. **Build e testes**
   - Gerar build de produção do Vite.
   - Sincronizar com Android Studio e Xcode.
   - Executar em emulador/dispositivo real para validar login, PDV, estoque e relatórios.

8. **Preparar publicação nas lojas**
   - Gerar Android App Bundle (AAB) para Play Store.
   - Gerar archive iOS para App Store Connect.
   - Listar assets necessários: screenshots, descrição, política de privacidade etc.

## Detalhes técnicos

- `appId`: `app.lovable.p28597778197140d1bc614ebfc00dd30e` (ou um ID definitivo escolhido pelo cliente, ex: `com.vortis.gestao`).
- `appName`: `Vortis Gestão`.
- `webDir`: `dist`.
- Ícones: baseados em `public/icon-512.png`, gerados via script/canvas nas resoluções Android (mipmap) e iOS (AppIcon).
- Splash: fundo `#0f172a` com o símbolo azul do Vortis centralizado.
- Não inclui service worker/offline avançado nesta entrega, salvo se solicitado depois.

## Pré-requisitos para publicação (fora do código)

- Conta Google Play Developer: taxa única de US$ 25.
- Apple Developer Program: US$ 99/ano.
- Computador Mac com Xcode para gerar e enviar o app iOS.
- Política de privacidade e termos de uso publicados em site.
- Screenshots do app em celulares em português.

## Observações

- O app continuará funcionando como site/PWA normalmente. A versão de loja será um "empacotamento" do mesmo sistema.
- Recursos nativos avançados (push, Bluetooth de impressora, leitor nativo de código de barras) podem ser adicionados em etapas futuras como plugins do Capacitor.

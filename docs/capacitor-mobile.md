# Publicação do Vortis nas lojas de aplicativos

O Vortis foi preparado para ser empacotado com o **Capacitor**, permitindo publicar o mesmo app web nas lojas **Google Play Store** e **Apple App Store** sem reescrever as telas ou as regras de negócio.

> O app continua funcionando normalmente como site/PWA. A versão de loja é um "envoltório nativo" do mesmo sistema.

---

## O que já está configurado

- `capacitor.config.ts` — configuração do app (`com.vortis.gestao`, nome, pasta de build `dist`).
- Plataformas adicionadas: `android/` e `ios/`.
- Ícones e splash screens gerados automaticamente a partir do símbolo azul do Vortis.
- Plugins nativos básicos instalados:
  - `@capacitor/status-bar` (barra de status escura)
  - `@capacitor/splash-screen` (tela de abertura)
  - `@capacitor/keyboard` (ajuste do teclado)
  - `@capacitor/app` (eventos do app nativo)
- Permissões de câmera incluídas no `AndroidManifest.xml` e `Info.plist` para leitura de código de barras.
- CSS com safe areas para notch do iPhone e gestos do Android.

---

## Pré-requisitos

### Contas de desenvolvedor

- **Google Play Store**: conta de desenvolvedor Google (taxa única de US$ 25).
- **Apple App Store**: Apple Developer Program (US$ 99/ano).

### Para build Android

- Android Studio instalado.
- JDK 17+.
- SDK Android com API level mínimo definido no projeto (geralmente API 24+).

### Para build iOS

- Computador **Mac** com macOS.
- Xcode instalado.
- Conta Apple Developer ativa.

---

## Fluxo de trabalho

Sempre que alterar o frontend, reconstrua e sincronize antes de abrir o Android Studio/Xcode:

```bash
bun run build
npx cap sync
```

Ou use o atalho:

```bash
bun run cap:sync
```

---

## Testar no celular / emulador

### Android

1. Conecte um celular com modo desenvolvedor ativado ou abra um emulador no Android Studio.
2. Abra o projeto nativo:
   ```bash
   bun run cap:android
   ```
3. No Android Studio, clique em **Run** (`▶`) para instalar e rodar.

### iOS

1. Abra o projeto no Xcode:
   ```bash
   bun run cap:ios
   ```
2. Escolha um simulador ou conecte um iPhone.
3. Clique em **Run** (`▶`) para instalar e rodar.

---

## Gerar o arquivo para a loja

### Google Play Store (Android App Bundle — AAB)

```bash
bun run cap:build:android:bundle
```

O arquivo `.aab` será gerado em:

```
android/app/build/outputs/bundle/release/app-release.aab
```

Envie esse arquivo pelo **Google Play Console**.

> Se ainda não tiver uma chave de assinatura, crie uma no Android Studio em **Build → Generate Signed Bundle / APK**.

### Apple App Store (IPA / Archive)

1. No Xcode, selecione **Any iOS Device (arm64)** como destino.
2. Vá em **Product → Archive**.
3. Quando o archive terminar, o **Organizer** abrirá.
4. Clique em **Distribute App** → **App Store Connect** → **Upload**.

---

## Hot-reload durante o desenvolvimento (sandbox)

Para testar mudanças no celular sem rebuildar toda vez, edite temporariamente o `capacitor.config.ts` e descomente a seção `server.url`, apontando para a URL do sandbox do Lovable. **Remova essa configuração antes de publicar** — o app de loja deve usar os arquivos locais de `dist`.

---

## Recursos nativos futuros

Caso queira adicionar recursos como:

- Leitor nativo de código de barras;
- Notificações push;
- Impressão térmica Bluetooth;
- Acesso a arquivos/galeria;

é possível instalar plugins oficiais do Capacitor (ex: `@capacitor/camera`, `@capacitor/push-notifications`) e depois rodar `npx cap sync` novamente.

---

## Checklist antes de publicar

- [ ] App ID/bundle ID final definido (atualmente `com.vortis.gestao`).
- [ ] Ícone e splash screen revisados.
- [ ] `server.url` removido do `capacitor.config.ts`.
- [ ] Build de produção (`bun run build`) executado sem erros.
- [ ] `npx cap sync` executado após o build.
- [ ] Política de privacidade publicada em site próprio.
- [ ] Screenshots do app em celulares (obrigatório nas duas lojas).
- [ ] Descrição, título e palavras-chave preparados.
- [ ] Contas de desenvolvedor Google/Apple ativas.

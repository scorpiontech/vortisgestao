# Novo ícone do Vortis em todo o sistema

Trocar o ícone atual pela imagem enviada (o símbolo azul em espiral), sem a moldura/fundo branco ao redor, e aplicá-lo em todos os lugares onde o ícone aparece.

## Onde o novo ícone vai aparecer

- Aba do navegador (favicon do site)
- Atalho instalado no celular (Android e iPhone)
- Atalho instalado no desktop
- Tela inicial/splash do app instalado

## O que será feito

1. Recortar a imagem enviada removendo a borda branca e o rodapé com texto, deixando apenas o símbolo.
2. Gerar as versões necessárias em tamanho quadrado:
   - ícone do site (aba do navegador)
   - ícone para iPhone (180x180)
   - ícones do app instalado (192x192 e 512x512)
   - versão "maskable" 512x512, com margem interna para Android não cortar o símbolo
3. Substituir os arquivos de ícone existentes mantendo os mesmos nomes já usados, para que celulares e navegadores encontrem o novo ícone.
4. Confirmar que o arquivo de instalação do app (manifest) e as marcações da página apontam para os ícones novos.

## Detalhes técnicos

- Fonte: `user-uploads://image-61.png`, recortada e redimensionada com ImageMagick.
- Arquivos substituídos: `public/favicon.png`, `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`.
- Fundo transparente (PNG) nos ícones normais; a versão maskable recebe fundo `#0f172a`, igual ao tema atual.
- `public/manifest.webmanifest` e as tags de `index.html` já referenciam esses caminhos; nenhuma mudança de nome de arquivo.
- Remover `public/favicon.ico`, que sobrepõe o novo ícone em alguns navegadores.

## Observação

Quem já instalou o app no celular pode continuar vendo o ícone antigo até reinstalar — o sistema operacional guarda o ícone no momento da instalação.

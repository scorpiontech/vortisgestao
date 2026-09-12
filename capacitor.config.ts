import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vortis.gestao",
  appName: "Vortis Gestão",
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    // Em desenvolvimento no sandbox, descomente a linha abaixo para usar hot-reload.
    // Em builds de produção para as lojas, esta chave deve estar ausente.
    // url: "https://28597778-1971-40d1-bc61-4ebfc00dd30e.lovableproject.com?forceHideBadge=true",
    // cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#0F172A",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
    Keyboard: {
      resize: "body",
      style: "dark",
    },
  },
};

export default config;

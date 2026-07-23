import { Mail, MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "5591996316518";
const WHATSAPP_MSG = encodeURIComponent("Solicito suporte técnico");
const EMAIL = "suporte@vortisgestao.com.br";

const Suporte = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Suporte</h1>
        <p className="text-sm text-muted-foreground">
          Fale com nossa equipe pelos canais abaixo
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
        <a
          href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col items-center justify-center gap-3 p-8 rounded-lg border bg-card shadow-card hover:shadow-lg hover:border-green-500 transition-all"
          aria-label="Falar pelo WhatsApp"
        >
          <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
            <MessageCircle className="h-8 w-8 text-green-600" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">WhatsApp</h2>
            <p className="text-sm text-muted-foreground">+55 91 99631-6518</p>
          </div>
        </a>

        <a
          href={`mailto:${EMAIL}?subject=${encodeURIComponent("Suporte técnico Vortis Gestão")}`}
          className="group flex flex-col items-center justify-center gap-3 p-8 rounded-lg border bg-card shadow-card hover:shadow-lg hover:border-primary transition-all"
          aria-label="Enviar e-mail para o suporte"
        >
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">E-mail</h2>
            <p className="text-sm text-muted-foreground">{EMAIL}</p>
          </div>
        </a>
      </div>
    </div>
  );
};

export default Suporte;

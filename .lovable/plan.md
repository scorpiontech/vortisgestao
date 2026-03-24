

## Plano: Configurar Admin Master

Para criar o usuário administrador com o email `admin@vortisgestao.com.br`, são necessários dois passos:

### 1. Criar conta de usuário
- Registrar o email `admin@vortisgestao.com.br` no sistema de autenticação (será necessário definir uma senha)
- Habilitar auto-confirm temporariamente para que a conta fique ativa imediatamente

### 2. Atribuir role de admin
- Inserir registro na tabela `user_roles` com `role = 'admin'` vinculado ao `user_id` do novo usuário
- Isso garantirá acesso ao painel `/admin/dashboard`

### 3. Atualizar placeholder no login admin
- Atualizar o placeholder do campo email em `AdminLogin.tsx` de `admin@vortis.com` para `admin@vortisgestao.com.br`

### Detalhes Tecnicas
- Usaremos a API de autenticação para criar o usuário
- A role será inserida via SQL na tabela `user_roles`
- Auto-confirm será habilitado apenas para esta operação e desabilitado em seguida


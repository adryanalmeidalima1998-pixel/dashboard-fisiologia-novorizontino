import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Usuário", type: "text" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        // Credenciais definidas pelo usuário
        if (
          credentials?.username === "bigdatanovorizontino" &&
          credentials?.password === "gremio123"
        ) {
          return { id: "1", name: "Comissão Técnica", email: "tecnico@novorizontino.com.br" }
        }
        return null
      }
    })
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt",
    maxAge: 4 * 60 * 60, // 4 horas de sessão (ajustável conforme necessidade)
    updateAge: 24 * 60 * 60, // Atualiza o token a cada 24h se ativo
  },
  callbacks: {
    async session({ session, token }) {
      // Forçar o logout se o navegador for fechado (depende do comportamento do cookie)
      return session
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "uma-chave-secreta-muito-segura-123",
})

export { handler as GET, handler as POST }

import { hashPassword } from "../lib/security/password";

const pw = process.argv[2];
if (!pw || pw.length < 12) {
  console.error('Uso: npm run hash-password -- "senha-com-12-ou-mais-caracteres"');
  process.exit(1);
}
console.log(hashPassword(pw));
console.log("\nCole o valor acima em ADMIN_PASSWORD_HASH (variável de ambiente do servidor).");

import Link from "next/link";
export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-slate-300">O endereço pode ter mudado ou não existe.</p>
      <Link href="/" className="mt-6 inline-block underline">Voltar para a página inicial</Link>
    </div>
  );
}

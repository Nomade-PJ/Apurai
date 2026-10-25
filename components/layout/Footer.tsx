import Link from "next/link";

export function Footer() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <footer className="mt-10 border-t border-navy-700 bg-navy-900">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 text-sm text-slate-300">
        <p className="rounded border border-navy-600 bg-navy-800 p-3">
          O Apuraí é um site independente. Os resultados exibidos vêm do Tribunal Superior Eleitoral (TSE); em caso de divergência, vale a fonte oficial.
        </p>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/transparencia#sobre" className="hover:text-signal">Sobre o projeto</Link>
          <Link href="/transparencia" className="hover:text-signal">Fontes e metodologia</Link>
          <Link href="/privacidade" className="hover:text-signal">Política de privacidade</Link>
          <Link href="/termos" className="hover:text-signal">Termos de uso</Link>
          <Link href="/anuncie" className="hover:text-signal">Contato comercial</Link>
        </nav>
        {email ? <p>Contato: <a className="underline" href={`mailto:${email}`}>{email}</a></p> : null}
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} Apuraí. Site independente, sem vínculo com a Justiça Eleitoral.</p>
      </div>
    </footer>
  );
}

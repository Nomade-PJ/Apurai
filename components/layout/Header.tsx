import Link from "next/link";

const NAV = [
  { href: "/#apuracao", label: "Apuração" },
  { href: "/transparencia#sobre", label: "Sobre" },
  { href: "/transparencia", label: "Transparência" },
  { href: "/anuncie", label: "Anuncie" },
];

export function Header() {
  return (
    <header className="border-b border-navy-700 bg-navy-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <span aria-hidden className="inline-block h-5 w-5 rounded-sm bg-signal" />
          Apuraí
        </Link>
        <nav aria-label="Principal" className="hidden gap-5 text-sm md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-slate-200 hover:text-signal">{n.label}</Link>
          ))}
        </nav>
        {/* Menu mobile sem JavaScript: <details> é acessível por teclado e leitores de tela. */}
        <details className="relative md:hidden">
          <summary className="cursor-pointer list-none rounded border border-navy-600 px-3 py-1.5 text-sm">Menu</summary>
          <nav aria-label="Principal (mobile)" className="absolute right-0 z-40 mt-2 w-56 rounded border border-navy-600 bg-navy-800 p-2 shadow-lg">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="block rounded px-3 py-2 text-sm hover:bg-navy-700">{n.label}</Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}

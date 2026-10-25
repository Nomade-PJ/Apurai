"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  // Não exibimos detalhes internos do erro ao visitante.
  return (
    <div className="py-16 text-center" role="alert">
      <h1 className="text-3xl font-bold">Algo deu errado</h1>
      <p className="mt-2 text-slate-300">O serviço está indisponível no momento. Tente novamente em instantes.</p>
      <button onClick={reset} className="mt-6 rounded bg-signal px-5 py-2.5 font-semibold text-navy-950">Tentar de novo</button>
    </div>
  );
}

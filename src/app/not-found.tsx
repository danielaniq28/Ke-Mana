import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0b1220] p-4 text-slate-100">
      <h2 className="text-2xl font-bold">404 — Halaman Tidak Dijumpai</h2>
      <p className="mt-2 text-slate-400">Halaman yang anda cari tidak wujud.</p>
      <Link href="/" className="mt-4 text-sky-400 hover:underline">
        Kembali ke Peta
      </Link>
    </div>
  );
}

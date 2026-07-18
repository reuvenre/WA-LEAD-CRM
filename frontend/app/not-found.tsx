import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#101E38] text-white px-6 text-center" dir="rtl">
      <span className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center overflow-hidden p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mark.png" alt="" className="w-full h-full object-contain" />
      </span>
      <p className="text-5xl font-bold">404</p>
      <p className="text-slate-300">הדף שחיפשת לא נמצא.</p>
      <Link href="/" className="mt-2 inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-6 py-3 rounded-xl transition">
        חזרה לדף הבית
      </Link>
    </div>
  );
}

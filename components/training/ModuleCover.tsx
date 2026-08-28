"use client";

/**
 * Shared AT CAPACITY education artwork with the module title rendered in HTML.
 * Keeping the words outside the image makes every cover crisp, accessible and
 * reusable when Gordy renames or adds a module.
 */
export default function ModuleCover({
  title,
  variant = "card",
}: {
  title: string;
  variant?: "card" | "banner";
}) {
  const height = variant === "banner" ? "h-44 sm:h-52" : "h-36";

  return (
    <div className={`relative ${height} w-full overflow-hidden bg-[#08080b]`}>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-[position:58%_center] transition-transform duration-700 group-hover:scale-[1.025]"
        style={{ backgroundImage: "url('/images/education/at-capacity-module-cover.webp')" }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/28 to-black/5" />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/25" />

      <div className="absolute inset-x-14 top-4 flex flex-col items-center text-center sm:inset-x-16">
        <span className="font-heading text-[10px] font-extrabold tracking-[0.28em] text-[#f06be3]">
          AT CAPACITY
        </span>
        <span className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.34em] text-white/55">
          With Gordy
        </span>
      </div>

      <div className="absolute inset-x-7 bottom-5 top-11 flex items-center justify-center sm:inset-x-10">
        <h3 className="max-w-[19rem] text-center font-heading text-xl font-extrabold leading-[1.05] tracking-[-0.02em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)] md:text-2xl">
          {title}
        </h3>
      </div>

      <div aria-hidden="true" className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#e8d9c5]/55 to-transparent" />
    </div>
  );
}

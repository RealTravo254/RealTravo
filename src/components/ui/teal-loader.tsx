/**
 * Minimalist Teal Dot Loader
 * Three teal dots with staggered wave animation
 */
export const TealLoader = ({ text = "Loading details..." }: { text?: string }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
    <div className="flex items-center gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-3.5 h-3.5 rounded-full bg-primary animate-[teal-pulse_1.4s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
      {text}
    </p>
  </div>
);

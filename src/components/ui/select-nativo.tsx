import * as React from "react";

import { cn } from "@/lib/utils";

// <select> nativo, com a mesma pele do Input. Serve os casos em que o Select
// do design system não cabe: formulários GET que precisam funcionar sem
// JavaScript e campos opcionais, que exigem uma opção vazia de verdade.
function SelectNativo({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select-nativo"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        className
      )}
      {...props}
    />
  );
}

export { SelectNativo };

import * as React from "react";

const MOBILE_BREAKPOINT = 768;

const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Meldet, ob die Anwendung gerade auf Telefonbreite läuft.
 *
 * Gegenüber der Vorlage von shadcn/ui wird `useSyncExternalStore` verwendet:
 * Der Wert steht schon beim ersten Rendern im Browser fest, statt erst über
 * einen Effekt nachgereicht zu werden. Auf dem Server wird Desktop angenommen –
 * die Seitenleiste wird dort ohnehin erst nach der Hydratation interaktiv.
 */
export function useIsMobile(): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

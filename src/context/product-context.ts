import { createContextId, Signal } from "@builder.io/qwik";

export const ProductUpdateContext =
  createContextId<Signal<{ refresh: number }>>("product.update");
